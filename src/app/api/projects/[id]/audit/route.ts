import { auth } from "@clerk/nextjs/server"
import { db, projects, auditResults, users, projectPages } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { runAuditForProject, PSIError } from "@/lib/audit-runner"
import { PLAN_LIMITS } from "@/lib/utils/plan-limits"
import { getMonthlyRunCount } from "@/app/actions/projects"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth()
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params

  // Read pageId from request body
  const body = (await req.json().catch(() => ({}))) as { pageId?: string }
  const { pageId } = body
  if (!pageId) {
    return Response.json({ error: "pageId is required" }, { status: 400 })
  }

  // Verify project exists and belongs to this user / org
  const ownershipFilter = orgId
    ? and(eq(projects.id, projectId), eq(projects.orgId, orgId))
    : and(eq(projects.id, projectId), eq(projects.userId, userId))

  const project = await db.query.projects.findFirst({
    where: ownershipFilter,
  })
  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 })
  }

  // Verify page belongs to this project
  const page = await db.query.projectPages.findFirst({
    where: and(
      eq(projectPages.id, pageId),
      eq(projectPages.projectId, projectId)
    ),
  })
  if (!page) {
    return Response.json({ error: "Page not found" }, { status: 404 })
  }

  // Enforce monthly run limit for free plan
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { plan: true },
  })
  const plan = (user?.plan ?? "free") as keyof typeof PLAN_LIMITS
  const limits = PLAN_LIMITS[plan]

  if (limits.manualRunsPerMonth !== -1) {
    const runCount = await getMonthlyRunCount(userId)
    if (runCount >= limits.manualRunsPerMonth) {
      return Response.json(
        {
          error: `Monthly audit limit reached (${limits.manualRunsPerMonth} runs). Upgrade to continue.`,
          limitReached: true,
        },
        { status: 429 }
      )
    }
  }

  try {
    const auditId = await runAuditForProject(projectId, "manual", pageId)
    const result = await db.query.auditResults.findFirst({
      where: eq(auditResults.id, auditId),
    })
    return Response.json(result)
  } catch (err) {
    if (err instanceof PSIError) {
      return Response.json({ error: err.message }, { status: 502 })
    }
    console.error("[audit] Unexpected error:", err)
    return Response.json({ error: "Audit failed" }, { status: 500 })
  }
}
