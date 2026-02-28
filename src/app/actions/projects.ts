"use server"

import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db, projects, users, auditResults, projectPages } from "@/lib/db"
import { eq, and, count, gte, isNull } from "drizzle-orm"
import { validateAuditUrl } from "@/lib/utils/validate-url"
import { PLAN_LIMITS } from "@/lib/utils/plan-limits"
import { z } from "zod"

// Shape returned by createProjectAction (compatible with useActionState)
export type CreateProjectState = {
  error?: string
  limitReached?: boolean
} | null

const createProjectSchema = z.object({
  url: z.string().min(1),
  name: z.string().optional(),
  strategy: z.enum(["mobile", "desktop"]).default("mobile"),
})

export async function createProjectAction(
  _prevState: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const { userId, orgId } = await auth()
  if (!userId) redirect("/sign-in")

  const raw = {
    url: formData.get("url") as string,
    name: (formData.get("name") as string) || undefined,
    strategy: (formData.get("strategy") as string) || "mobile",
  }

  const parsed = createProjectSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid form data" }
  }

  // Validate URL
  const validation = validateAuditUrl(parsed.data.url)
  if (!validation.valid) {
    return { error: validation.error }
  }

  const url = validation.normalized!

  // Upsert user row — Clerk webhook may not be wired yet in dev
  const clerkUser = await currentUser()
  if (clerkUser) {
    await db
      .insert(users)
      .values({
        id: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
        name: clerkUser.fullName ?? null,
      })
      .onConflictDoNothing()
  }

  // Enforce plan limits
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })
  const plan = (user?.plan ?? "free") as keyof typeof PLAN_LIMITS
  const limits = PLAN_LIMITS[plan]

  const countResult = await db
    .select({ value: count() })
    .from(projects)
    .where(
      orgId
        ? eq(projects.orgId, orgId)
        : and(eq(projects.userId, userId), isNull(projects.orgId))
    )

  const projectCount = countResult[0]?.value ?? 0

  if (projectCount >= limits.maxProjects) {
    return {
      error: `Your ${plan} plan allows ${limits.maxProjects} project${limits.maxProjects === 1 ? "" : "s"}. Upgrade to add more.`,
      limitReached: true,
    }
  }

  // Auto-generate name from hostname if not provided
  const hostname = new URL(url).hostname.replace(/^www\./, "")
  const name = parsed.data.name?.trim() || hostname

  const inserted = await db
    .insert(projects)
    .values({
      userId,
      orgId: orgId ?? null,
      url,
      name,
      strategy: parsed.data.strategy as "mobile" | "desktop",
    })
    .returning({ id: projects.id })

  const projectId = inserted[0]?.id
  if (!projectId) {
    return { error: "Failed to create project. Please try again." }
  }

  // Create default page for the project URL
  await db.insert(projectPages).values({ projectId, url })

  redirect(`/projects/${projectId}`)
}

export async function deleteProjectAction(projectId: string): Promise<void> {
  const { userId, orgId } = await auth()
  if (!userId) redirect("/sign-in")

  const ownershipFilter = orgId
    ? and(eq(projects.id, projectId), eq(projects.orgId, orgId))
    : and(eq(projects.id, projectId), eq(projects.userId, userId))

  await db.delete(projects).where(ownershipFilter)

  redirect("/dashboard")
}

// Returns current month run count for the authenticated user
export async function getMonthlyRunCount(userId: string): Promise<number> {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const result = await db
    .select({ value: count() })
    .from(auditResults)
    .innerJoin(projects, eq(auditResults.projectId, projects.id))
    .where(
      and(eq(projects.userId, userId), gte(auditResults.createdAt, monthStart))
    )

  return result[0]?.value ?? 0
}

// Returns all pages for a project (assumes caller verified ownership)
export async function getProjectPages(projectId: string) {
  return db.query.projectPages.findMany({
    where: eq(projectPages.projectId, projectId),
    orderBy: (pp, { asc }) => [asc(pp.createdAt)],
  })
}

export type AddPageState = { error?: string; pageId?: string } | null

export async function addPageAction(
  projectId: string,
  url: string,
  label?: string
): Promise<AddPageState> {
  const { userId, orgId } = await auth()
  if (!userId) return { error: "Não autenticado" }

  // Verify ownership
  const ownershipFilter = orgId
    ? and(eq(projects.id, projectId), eq(projects.orgId, orgId))
    : and(eq(projects.id, projectId), eq(projects.userId, userId))

  const project = await db.query.projects.findFirst({
    where: ownershipFilter,
    columns: { id: true, url: true },
  })
  if (!project) return { error: "Projeto não encontrado" }

  // Validate URL
  const validation = validateAuditUrl(url)
  if (!validation.valid) return { error: validation.error }
  const normalizedUrl = validation.normalized!

  // Domain must match the project's root URL
  const projectHostname = new URL(project.url).hostname
  const pageHostname = new URL(normalizedUrl).hostname
  if (pageHostname !== projectHostname) {
    return { error: `O domínio deve ser ${projectHostname}` }
  }

  // Enforce page limit
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { plan: true },
  })
  const plan = (dbUser?.plan ?? "free") as keyof typeof PLAN_LIMITS
  const maxPages = PLAN_LIMITS[plan].maxPagesPerProject

  if (maxPages !== -1) {
    const [row] = await db
      .select({ value: count() })
      .from(projectPages)
      .where(eq(projectPages.projectId, projectId))
    const current = row?.value ?? 0
    if (current >= maxPages) {
      return {
        error: `Seu plano permite ${maxPages} página${maxPages === 1 ? "" : "s"} por projeto. Faça upgrade para adicionar mais.`,
      }
    }
  }

  const [inserted] = await db
    .insert(projectPages)
    .values({ projectId, url: normalizedUrl, label: label?.trim() || null })
    .returning({ id: projectPages.id })

  if (!inserted) return { error: "Falha ao adicionar página. Tente novamente." }

  return { pageId: inserted.id }
}

export type RemovePageState = { error?: string } | null

export async function removePageAction(
  projectId: string,
  pageId: string
): Promise<RemovePageState> {
  const { userId, orgId } = await auth()
  if (!userId) return { error: "Não autenticado" }

  // Verify project ownership
  const ownershipFilter = orgId
    ? and(eq(projects.id, projectId), eq(projects.orgId, orgId))
    : and(eq(projects.id, projectId), eq(projects.userId, userId))

  const project = await db.query.projects.findFirst({
    where: ownershipFilter,
    columns: { id: true },
  })
  if (!project) return { error: "Projeto não encontrado" }

  // Refuse to delete the last page
  const [row] = await db
    .select({ value: count() })
    .from(projectPages)
    .where(eq(projectPages.projectId, projectId))
  if ((row?.value ?? 0) <= 1) {
    return { error: "Não é possível remover a única página do projeto." }
  }

  // Verify page belongs to project, then delete
  await db
    .delete(projectPages)
    .where(and(eq(projectPages.id, pageId), eq(projectPages.projectId, projectId)))

  return {}
}
