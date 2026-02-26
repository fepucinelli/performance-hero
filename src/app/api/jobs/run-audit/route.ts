/**
 * POST /api/jobs/run-audit
 *
 * QStash job handler. Receives a projectId, runs a PSI audit,
 * and updates nextAuditAt based on the project's schedule.
 *
 * In production: verifies the Upstash-Signature header.
 * In dev (no signing keys): skips verification for easy local testing.
 */
import { db, projects, projectPages } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { env } from "@/env"
import { runAuditForProject, PSIError } from "@/lib/audit-runner"
import { tomorrowNoonBRT } from "@/lib/utils/schedule"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const rawBody = await req.text()

  // Verify Upstash signature in production
  if (env.QSTASH_CURRENT_SIGNING_KEY && env.QSTASH_NEXT_SIGNING_KEY) {
    const { Receiver } = await import("@upstash/qstash")
    const receiver = new Receiver({
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
    })

    const signature = req.headers.get("upstash-signature") ?? ""
    const isValid = await receiver
      .verify({ signature, body: rawBody })
      .catch(() => false)

    if (!isValid) {
      return Response.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  let projectId: string
  let pageId: string | undefined
  try {
    const body = JSON.parse(rawBody) as { projectId?: unknown; pageId?: unknown }
    if (typeof body.projectId !== "string") {
      return Response.json({ error: "Missing projectId" }, { status: 400 })
    }
    projectId = body.projectId
    pageId = typeof body.pageId === "string" ? body.pageId : undefined
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Look up the project's schedule before running (needed for nextAuditAt)
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { id: true, schedule: true },
  })
  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 })
  }

  // If no pageId provided, fall back to first page of project
  if (!pageId) {
    const firstPage = await db.query.projectPages.findFirst({
      where: eq(projectPages.projectId, projectId),
      orderBy: (pp, { asc }) => [asc(pp.createdAt)],
      columns: { id: true },
    })
    if (!firstPage) {
      return Response.json({ error: "No pages found for project" }, { status: 404 })
    }
    pageId = firstPage.id
  }

  try {
    await runAuditForProject(projectId, "cron", pageId)

    // Schedule the next run based on the project's cadence
    const next = project.schedule === "hourly"
      ? new Date(Date.now() + 60 * 60 * 1000)
      : tomorrowNoonBRT()

    if (project.schedule !== "manual") {
      await db
        .update(projects)
        .set({ nextAuditAt: next, updatedAt: new Date() })
        .where(eq(projects.id, projectId))
    }

    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof PSIError) {
      // Return 200 so QStash doesn't retry on PSI API errors (permanent failure)
      console.error(`[run-audit] PSI error for project ${projectId}:`, err.message)
      return Response.json({ error: err.message, permanent: true })
    }
    console.error(`[run-audit] Unexpected error for project ${projectId}:`, err)
    // Return 500 so QStash will retry
    return Response.json({ error: "Audit failed" }, { status: 500 })
  }
}
