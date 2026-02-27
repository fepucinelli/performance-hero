/**
 * Shared audit execution logic.
 *
 * Called by both the manual audit route (/api/projects/[id]/audit)
 * and the scheduled job handler (/api/jobs/run-audit).
 */
import { db, projects, auditResults, users, projectPages } from "@/lib/db"
import { eq, and, gte, isNotNull, count } from "drizzle-orm"
import { runPSIAudit, PSIError } from "@/lib/api/pagespeed"
import { fetchCrUXHistory } from "@/lib/api/crux-history"
import { gradeMetric } from "@/lib/utils/metrics"
import { checkAndFireAlerts } from "@/lib/alerts"
import { PLAN_LIMITS } from "@/lib/utils/plan-limits"
import { generateAIActionPlan } from "@/lib/ai/action-plan"
import type { Strategy } from "@/lib/db/schema"

export { PSIError }

/**
 * Run a PSI audit for the given project page and persist the result.
 * Returns the new auditResult ID.
 * Throws PSIError on API failure or Error if project/page not found.
 */
export async function runAuditForProject(
  projectId: string,
  triggeredBy: "manual" | "cron" | "api",
  pageId: string
): Promise<string> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  })
  if (!project) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const page = await db.query.projectPages.findFirst({
    where: eq(projectPages.id, pageId),
  })
  if (!page) {
    throw new Error(`Page not found: ${pageId}`)
  }

  const auditData = await runPSIAudit(page.url, project.strategy as Strategy)

  const [result] = await db
    .insert(auditResults)
    .values({
      projectId: project.id,
      pageId,
      strategy: project.strategy,
      perfScore: auditData.perfScore,
      lcp: auditData.lcp,
      cls: auditData.cls,
      inp: auditData.inp,
      fcp: auditData.fcp,
      ttfb: auditData.ttfb,
      tbt: auditData.tbt,
      speedIndex: auditData.speedIndex,
      cruxLcp: auditData.cruxLcp,
      cruxCls: auditData.cruxCls,
      cruxInp: auditData.cruxInp,
      cruxFcp: auditData.cruxFcp,
      lcpGrade: auditData.lcp ? gradeMetric("lcp", auditData.lcp) : null,
      clsGrade: auditData.cls ? gradeMetric("cls", auditData.cls) : null,
      inpGrade: auditData.inp ? gradeMetric("inp", auditData.inp) : null,
      seoScore: auditData.seoScore,
      accessibilityScore: auditData.accessibilityScore,
      bestPracticesScore: auditData.bestPracticesScore,
      lighthouseRaw: auditData.lighthouseRaw,
      psiApiVersion: auditData.psiApiVersion,
      triggeredBy,
    })
    .returning()

  if (!result) throw new Error("Failed to insert audit result")

  await db
    .update(projects)
    .set({ lastAuditAt: new Date(), updatedAt: new Date() })
    .where(eq(projects.id, project.id))

  // Fetch CrUX History (25-week real-user data) — fire-and-forget
  void fetchCrUXHistory(page.url).then((cruxHistory) => {
    if (!cruxHistory) return
    return db
      .update(auditResults)
      .set({ cruxHistoryRaw: cruxHistory })
      .where(eq(auditResults.id, result.id))
  }).catch(() => {})

  // Fire alerts if any thresholds are breached (no-op if none configured)
  await checkAndFireAlerts(
    { id: project.id, userId: project.userId, name: project.name, url: page.url },
    { id: result.id, lcp: result.lcp, cls: result.cls, inp: result.inp, triggeredBy: result.triggeredBy }
  )

  // Generate AI action plan if user's plan allows it — fire-and-forget
  try {
    await maybeGenerateAIActionPlan(
      result.id,
      project.userId,
      page.url,
      {
        perfScore: result.perfScore,
        lcp: result.lcp,
        cls: result.cls,
        fcp: result.fcp,
        ttfb: result.ttfb,
        cruxInp: result.cruxInp,
        seoScore: result.seoScore,
        accessibilityScore: result.accessibilityScore,
      },
      auditData.lighthouseRaw
    )
  } catch {
    // Never let AI generation failure affect the audit result
  }

  return result.id
}

async function maybeGenerateAIActionPlan(
  auditResultId: string,
  userId: string,
  url: string,
  metrics: {
    perfScore: number | null
    lcp: number | null
    cls: number | null
    fcp: number | null
    ttfb: number | null
    cruxInp: number | null
    seoScore: number | null
    accessibilityScore: number | null
  },
  lighthouseRaw: unknown
): Promise<void> {
  // Fetch user plan
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { plan: true },
  })
  const plan = dbUser?.plan ?? "free"
  const planLimits = PLAN_LIMITS[plan]

  if (planLimits.aiActionPlansPerMonth === 0) return

  if (planLimits.aiActionPlansPerMonth !== -1) {
    // Count AI plans generated this calendar month for this user
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const [row] = await db
      .select({ count: count() })
      .from(auditResults)
      .innerJoin(projects, eq(auditResults.projectId, projects.id))
      .where(
        and(
          eq(projects.userId, userId),
          gte(auditResults.createdAt, monthStart),
          isNotNull(auditResults.aiActionPlan)
        )
      )

    const usedThisMonth = row?.count ?? 0
    if (usedThisMonth >= planLimits.aiActionPlansPerMonth) return
  }

  const aiPlan = await generateAIActionPlan(url, metrics, lighthouseRaw, plan)
  if (!aiPlan) return

  await db
    .update(auditResults)
    .set({ aiActionPlan: aiPlan })
    .where(eq(auditResults.id, auditResultId))
}
