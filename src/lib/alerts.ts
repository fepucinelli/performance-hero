/**
 * Alert threshold checking and email dispatch.
 *
 * Called from audit-runner after each audit completes.
 * Fires at most once per metric per 24h to avoid flooding.
 */
import { db, projects, alerts, users } from "@/lib/db"
import { eq, and, gte } from "drizzle-orm"
import { env } from "@/env"
import type { AuditResult } from "@/lib/db/schema"

type AlertMetric = "lcp" | "cls" | "inp"

interface AlertCheck {
  metric: AlertMetric
  value: number
  threshold: number
}

/**
 * Check audit values against project thresholds and fire alerts if needed.
 * Silently no-ops if RESEND_API_KEY is not set.
 */
export async function checkAndFireAlerts(
  project: { id: string; userId: string; name: string; url: string },
  audit: Pick<AuditResult, "id" | "lcp" | "cls" | "inp" | "triggeredBy">
): Promise<void> {
  // Fetch project alert thresholds
  const projectRow = await db.query.projects.findFirst({
    where: eq(projects.id, project.id),
    columns: { alertLcp: true, alertCls: true, alertInp: true },
  })
  if (!projectRow) return

  // Determine which metrics are breached
  const breached: AlertCheck[] = []

  if (projectRow.alertLcp != null && audit.lcp != null && audit.lcp > projectRow.alertLcp) {
    breached.push({ metric: "lcp", value: audit.lcp, threshold: projectRow.alertLcp })
  }
  if (projectRow.alertCls != null && audit.cls != null && audit.cls > projectRow.alertCls) {
    breached.push({ metric: "cls", value: audit.cls, threshold: projectRow.alertCls })
  }
  if (projectRow.alertInp != null && audit.inp != null && audit.inp > projectRow.alertInp) {
    breached.push({ metric: "inp", value: audit.inp, threshold: projectRow.alertInp })
  }

  if (breached.length === 0) return

  // Dedupe: skip metrics that already fired an alert in the last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const toFire: AlertCheck[] = []

  for (const check of breached) {
    const recent = await db.query.alerts.findFirst({
      where: and(
        eq(alerts.projectId, project.id),
        eq(alerts.metric, check.metric),
        gte(alerts.sentAt, oneDayAgo)
      ),
      columns: { id: true },
    })
    if (!recent) {
      toFire.push(check)
    }
  }

  if (toFire.length === 0) return

  // Insert alert rows
  await db.insert(alerts).values(
    toFire.map((c) => ({
      projectId: project.id,
      auditId: audit.id,
      metric: c.metric,
      value: c.value,
      threshold: c.threshold,
      emailSent: false,
    }))
  )

  // Send email if Resend is configured
  if (!env.RESEND_API_KEY) return

  const user = await db.query.users.findFirst({
    where: eq(users.id, project.userId),
    columns: { email: true },
  })
  if (!user?.email) return

  try {
    const { Resend } = await import("resend")
    const { render } = await import("@react-email/components")
    const { AlertEmail } = await import("@/emails/alert-email")

    const resend = new Resend(env.RESEND_API_KEY)
    const appUrl = env.NEXT_PUBLIC_APP_URL
    const projectPageUrl = `${appUrl}/projects/${project.id}`

    const html = await render(
      AlertEmail({
        projectName: project.name,
        projectUrl: project.url,
        projectPageUrl,
        alerts: toFire,
        auditTriggeredBy: audit.triggeredBy,
      })
    )

    await resend.emails.send({
      from: "PerfAlly <alerts@perf-ally.com>",
      to: user.email,
      subject: `Performance alert: ${project.name} — ${toFire.length} metric${toFire.length > 1 ? "s" : ""} exceeded threshold`,
      html,
    })

    // Mark alerts as email sent
    await db
      .update(alerts)
      .set({ emailSent: true })
      .where(
        and(
          eq(alerts.projectId, project.id),
          eq(alerts.auditId, audit.id)
        )
      )
  } catch (err) {
    console.error("[alerts] Failed to send alert email:", err)
  }
}
