/**
 * Shared application types.
 * DB entity types live in @/lib/db/schema — import them from there.
 */

// ─── Result type ─────────────────────────────────────────────────────────────
// Use instead of throwing errors in data-fetching functions.
// Keeps error handling explicit and co-located with the call site.
//
// Usage:
//   const result = await runAudit(url)
//   if (!result.success) { ... handle error ... }
//   const audit = result.data

export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E }

// ─── API response wrapper ─────────────────────────────────────────────────────

export interface ApiError {
  message: string
  code?: string
}

// ─── Plan limits ─────────────────────────────────────────────────────────────

export interface PlanLimits {
  maxProjects: number
  /** -1 = unlimited */
  manualRunsPerMonth: number
  scheduledRuns: boolean
  hourlyRuns: boolean
  emailAlerts: boolean
  pdfReports: boolean
  slackAlerts: boolean
  historyDays: number
  /** 0 = disabled, -1 = unlimited */
  aiActionPlansPerMonth: number
}

export type PlanName = "free" | "starter" | "pro" | "agency"

// ─── AI Action Plan ───────────────────────────────────────────────────────────

export interface AIActionItem {
  title: string
  action: string
  why: string
  difficulty: "Fácil" | "Médio" | "Difícil"
  stackTip?: string
}

// ─── PageSpeed Insights ───────────────────────────────────────────────────────

export interface PSIAuditData {
  perfScore: number
  lcp: number | null
  cls: number | null
  inp: number | null
  fcp: number | null
  ttfb: number | null
  tbt: number | null
  speedIndex: number | null
  // CrUX field data — null when origin isn't in CrUX dataset
  cruxLcp: number | null
  cruxCls: number | null
  cruxInp: number | null
  cruxFcp: number | null
  // Full lighthouse response for action plan extraction
  lighthouseRaw: LighthouseResult
  psiApiVersion: string
}

// Minimal type for what we access from the Lighthouse result.
// We store the full JSON but only type the fields we read.
export interface LighthouseResult {
  lighthouseVersion: string
  categories: {
    performance: { score: number }
    seo?: { score: number }
    accessibility?: { score: number }
    "best-practices"?: { score: number }
  }
  audits: Record<string, LighthouseAudit>
  stackPacks?: Array<{ id: string; title: string }>
}

export interface LighthouseAudit {
  id: string
  title: string
  description: string
  score: number | null
  numericValue?: number
  displayValue?: string
  details?: unknown
}
