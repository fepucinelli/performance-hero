/**
 * GET /api/cron/trigger-audits
 *
 * Called by Vercel Cron every hour (see vercel.json).
 * Finds all projects due for a scheduled audit and dispatches jobs.
 *
 * In production (QSTASH_TOKEN set): publishes one QStash message per project.
 * In dev (no token): runs audits inline for easy local testing.
 *
 * Protected by CRON_SECRET to prevent unauthorized triggers.
 */
import { NextRequest } from "next/server"
import { db, projects, projectPages } from "@/lib/db"
import { ne, or, isNull, lte, eq } from "drizzle-orm"
import { env } from "@/env"
import { runAuditForProject } from "@/lib/audit-runner"
import { tomorrowNoonBRT } from "@/lib/utils/schedule"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  // Verify the caller is Vercel Cron or an authorized admin
  const authHeader = req.headers.get("authorization")
  const cronSecret = env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  // Find all projects with a schedule that are due
  const dueProjects = await db.query.projects.findMany({
    where: (p) =>
      ne(p.schedule, "manual") &&
      or(isNull(p.nextAuditAt), lte(p.nextAuditAt, now)),
    columns: { id: true, schedule: true },
  })

  if (dueProjects.length === 0) {
    return Response.json({ dispatched: 0 })
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL

  // Fetch all pages for each due project
  const projectIds = dueProjects.map((p) => p.id)
  const allPages = projectIds.length > 0
    ? await db.query.projectPages.findMany({
        where: (pp, { inArray }) => inArray(pp.projectId, projectIds),
        columns: { id: true, projectId: true },
      })
    : []

  // Build (projectId, pageId) pairs
  const jobs = dueProjects.flatMap((project) => {
    const pages = allPages.filter((pp) => pp.projectId === project.id)
    // If no pages yet (old project, not yet migrated), skip — will migrate on next page view
    return pages.map((page) => ({ project, pageId: page.id }))
  })

  if (jobs.length === 0) {
    return Response.json({ dispatched: 0 })
  }

  if (env.QSTASH_TOKEN) {
    // Production: fan out via QStash so each job runs independently with retries
    const { Client } = await import("@upstash/qstash")
    const client = new Client({ token: env.QSTASH_TOKEN })

    await Promise.all(
      jobs.map(({ project, pageId }) =>
        client.publishJSON({
          url: `${appUrl}/api/jobs/run-audit`,
          body: { projectId: project.id, pageId },
          retries: 3,
        })
      )
    )
  } else {
    // Dev: run audits inline (no QStash hop)
    await Promise.allSettled(
      jobs.map(async ({ project, pageId }) => {
        try {
          await runAuditForProject(project.id, "cron", pageId)
          await updateNextAuditAt(project.id, project.schedule)
        } catch (err) {
          console.error(`[cron] Audit failed for project ${project.id} page ${pageId}:`, err)
        }
      })
    )
  }

  return Response.json({ dispatched: jobs.length })
}

async function updateNextAuditAt(
  projectId: string,
  schedule: "manual" | "daily" | "hourly"
) {
  const next = schedule === "hourly"
    ? new Date(Date.now() + 60 * 60 * 1000)
    : tomorrowNoonBRT()

  await db
    .update(projects)
    .set({ nextAuditAt: next, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
}
