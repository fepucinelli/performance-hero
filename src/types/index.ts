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
  /** -1 = unlimited */
  maxPagesPerProject: number
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
  // Additional Lighthouse category scores
  seoScore: number
  accessibilityScore: number
  bestPracticesScore: number
  // Full lighthouse response for action plan extraction
  lighthouseRaw: LighthouseResult
  psiApiVersion: string
}

// ─── CrUX History API ────────────────────────────────────────────────────────
// 25-week weekly P75 field data from the Chrome UX Report History API.
// Null entries = insufficient traffic for that week.

export interface CrUXHistoryPeriod {
  firstDate: { year: number; month: number; day: number }
  lastDate: { year: number; month: number; day: number }
}

export interface CrUXHistoryMetric {
  percentilesTimeseries: { p75s: (number | null)[] }
}

export interface CrUXHistoryRecord {
  collectionPeriods: CrUXHistoryPeriod[]
  metrics: {
    largest_contentful_paint?: CrUXHistoryMetric
    cumulative_layout_shift?: CrUXHistoryMetric
    interaction_to_next_paint?: CrUXHistoryMetric
    first_contentful_paint?: CrUXHistoryMetric
  }
}

export interface AuditRef {
  id: string
  weight: number
  group?: string
}

// Minimal type for what we access from the Lighthouse result.
// We store the full JSON but only type the fields we read.
export interface LighthouseResult {
  lighthouseVersion: string
  categories: {
    performance: { score: number; auditRefs?: AuditRef[] }
    seo?: { score: number; auditRefs?: AuditRef[] }
    accessibility?: { score: number; auditRefs?: AuditRef[] }
    "best-practices"?: { score: number; auditRefs?: AuditRef[] }
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
