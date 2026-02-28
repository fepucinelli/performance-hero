/**
 * PDF report component for @react-pdf/renderer.
 *
 * Uses built-in Helvetica — no remote font fetching needed (reliable on Vercel).
 * All styling via StyleSheet (not Tailwind / CSS variables).
 */
import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
  Image,
} from "@react-pdf/renderer"
import { gradeMetric, gradeScore, formatMetricValue, GRADE_LABELS } from "@/lib/utils/metrics"
import { getActionPlan } from "@/lib/utils/explanations"
import { METRIC_EXPLANATIONS } from "@/lib/utils/explanations"
import type { AIActionItem, LighthouseResult, AuditRef } from "@/types"
import type { Grade } from "@/lib/db/schema"

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditData {
  perfScore: number | null
  seoScore: number | null
  accessibilityScore: number | null
  bestPracticesScore: number | null
  lcp: number | null
  cls: number | null
  inp: number | null
  fcp: number | null
  ttfb: number | null
  cruxLcp: number | null
  cruxCls: number | null
  cruxInp: number | null
  cruxFcp: number | null
  lighthouseRaw: unknown
  aiActionPlan: unknown
  createdAt: Date
}

export interface PageEntry {
  page: { url: string; label: string | null }
  audit: AuditData
}

interface Branding {
  accentColor?: string | null
  agencyName?: string | null
  agencyContact?: string | null
  agencyLogoUrl?: string | null
}

export interface ReportProps {
  project: { name: string; url: string; strategy: string }
  pages: PageEntry[]
  branding?: Branding | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SEO_AUDIT_LABELS: Record<string, string> = {
  "document-title": "Título da página ausente",
  "meta-description": "Meta descrição ausente",
  hreflang: "Atributos hreflang inválidos",
  canonical: "Link canônico inválido",
  "robots-txt": "Arquivo robots.txt com erro",
  "link-text": "Links com texto genérico",
  "crawlable-anchors": "Links não rastreáveis",
  "is-crawlable": "Página bloqueada para indexação",
  "tap-targets": "Alvos de toque muito pequenos",
  "font-size": "Texto muito pequeno para leitura",
  viewport: "Viewport não configurado",
  "structured-data": "Dados estruturados com erro",
}

const GRADE_COLORS: Record<Grade, string> = {
  good: "#16a34a",
  "needs-improvement": "#d97706",
  poor: "#dc2626",
}

const GRADE_BG: Record<Grade, string> = {
  good: "#f0fdf4",
  "needs-improvement": "#fffbeb",
  poor: "#fef2f2",
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111827",
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
  },

  // Cover page
  coverAccentBar: {
    height: 6,
    marginTop: -48,
    marginHorizontal: -48,
    marginBottom: 48,
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  coverUrl: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 32,
  },
  coverScoreCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  coverScoreNumber: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  coverScoreLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 6,
  },
  coverGradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  coverFooter: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    color: "#9ca3af",
  },

  // Section layout
  sectionHeader: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: "1px solid #e5e7eb",
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },

  // Score card (2×2 grid)
  scoreCard: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    border: "1px solid #e5e7eb",
    alignItems: "center",
  },
  scoreCardValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  scoreCardLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginBottom: 4,
  },
  scoreCardGrade: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },

  // Metric detail row (Page 3)
  metricRow: {
    flexDirection: "row",
    marginBottom: 14,
    padding: 12,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    gap: 16,
  },
  metricValueBlock: {
    width: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValueText: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  metricGradeBadge: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metricInfo: {
    flex: 1,
  },
  metricName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  metricWhat: {
    fontSize: 9,
    color: "#4b5563",
    marginBottom: 3,
    lineHeight: 1.5,
  },
  metricFieldRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
  },
  metricFieldItem: {
    flex: 1,
  },
  metricFieldLabel: {
    fontSize: 8,
    color: "#9ca3af",
    marginBottom: 1,
  },
  metricFieldValue: {
    fontSize: 9,
    color: "#374151",
  },

  // Action plan
  actionItem: {
    flexDirection: "row",
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    gap: 12,
  },
  actionNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  actionNumberText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  actionText: {
    fontSize: 9,
    color: "#4b5563",
    lineHeight: 1.5,
    marginBottom: 3,
  },
  actionWhy: {
    fontSize: 9,
    color: "#15803d",
    lineHeight: 1.5,
  },
  difficultyBadge: {
    fontSize: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 4,
  },

  // SEO items
  seoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderRadius: 6,
    border: "1px solid #fee2e2",
    backgroundColor: "#fef2f2",
    gap: 8,
  },
  seoItemDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  seoItemLabel: {
    fontSize: 9,
    flex: 1,
  },
  seoItemId: {
    fontSize: 8,
    color: "#9ca3af",
  },
  seoSectionLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    marginTop: 4,
    color: "#374151",
  },

  // Page number footer
  pageFooter: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9ca3af",
  },

  // Multi-page summary table
  summaryTableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  summaryTableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottom: "1px solid #f3f4f6",
  },
  summaryCell: {
    fontSize: 9,
  },

  // Per-page section label (shown on detail pages in multi-page reports)
  pageSectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 16,
    gap: 6,
  },
  pageSectionBadgeLabel: {
    fontSize: 8,
    color: "#6b7280",
    fontFamily: "Helvetica-Bold",
  },
  pageSectionBadgeUrl: {
    fontSize: 9,
    color: "#374151",
  },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pdfPathLabel(url: string): string {
  try {
    const { pathname } = new URL(url)
    return pathname === "/" ? "/" : pathname
  } catch {
    return url
  }
}

function siteHealth(
  perf: number | null,
  seo: number | null,
  a11y: number | null
): number {
  const p = perf ?? 0
  const s = seo ?? p
  const a = a11y ?? p
  return Math.round(p * 0.4 + s * 0.3 + a * 0.3)
}

function gradeColor(grade: Grade) {
  return GRADE_COLORS[grade]
}

function gradeBg(grade: Grade) {
  return GRADE_BG[grade]
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function getFailingSEOItems(lhr: LighthouseResult) {
  const refs: AuditRef[] = [
    ...(lhr.categories.seo?.auditRefs ?? []),
    ...(lhr.categories.accessibility?.auditRefs ?? []),
  ]
  const seen = new Set<string>()
  return refs
    .filter((ref) => {
      if (seen.has(ref.id)) return false
      seen.add(ref.id)
      const audit = lhr.audits[ref.id]
      if (!audit) return false
      const score = audit.score
      return score !== null && score < 1
    })
    .slice(0, 15)
    .map((ref) => ({
      id: ref.id,
      label: SEO_AUDIT_LABELS[ref.id] ?? lhr.audits[ref.id]?.title ?? ref.id,
      score: lhr.audits[ref.id]?.score ?? null,
      isSEO: !!(lhr.categories.seo?.auditRefs ?? []).find((r) => r.id === ref.id),
    }))
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function PageFooter({ agency }: { agency?: string | null }) {
  return (
    <View style={styles.pageFooter} fixed>
      <Text>{agency ?? "PerfAlly"}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

/** Small badge shown at the top of detail pages in multi-page reports */
function PageSectionBadge({ label }: { label: string }) {
  return (
    <View style={styles.pageSectionBadge}>
      <Text style={styles.pageSectionBadgeLabel}>PÁGINA</Text>
      <Text style={styles.pageSectionBadgeUrl}>{label}</Text>
    </View>
  )
}

// ─── Project summary cover (multi-page only) ─────────────────────────────────

function ProjectCoverPage({
  project,
  pages,
  branding,
  accent,
}: {
  project: ReportProps["project"]
  pages: PageEntry[]
  branding?: Branding | null
  accent: string
}) {
  const generatedAt = new Date()

  return (
    <Page size="A4" style={styles.page}>
      <View style={[styles.coverAccentBar, { backgroundColor: accent }]} />

      {branding?.agencyLogoUrl && (
        <Image
          src={branding.agencyLogoUrl}
          style={{ width: 80, marginBottom: 8 }}
        />
      )}
      {branding?.agencyName && (
        <Text style={{ fontSize: 11, color: "#6b7280", marginBottom: 16 }}>
          {branding.agencyName}
        </Text>
      )}
      <Text
        style={{
          fontSize: 11,
          color: "#6b7280",
          marginBottom: 8,
          fontFamily: "Helvetica-Bold",
        }}
      >
        RELATÓRIO DE PERFORMANCE
      </Text>
      <Text style={styles.coverTitle}>{project.name}</Text>
      <Link src={project.url} style={styles.coverUrl}>
        {project.url}
      </Link>

      <View style={{ flexDirection: "row", gap: 20, marginBottom: 32 }}>
        <Text style={{ fontSize: 9, color: "#9ca3af" }}>
          {project.strategy === "mobile" ? "Mobile" : "Desktop"}
        </Text>
        <Text style={{ fontSize: 9, color: "#9ca3af" }}>
          {pages.length} página{pages.length === 1 ? "" : "s"} auditadas
        </Text>
        <Text style={{ fontSize: 9, color: "#9ca3af" }}>
          Gerado em {formatDate(generatedAt)}
        </Text>
      </View>

      <Text style={styles.sectionHeader}>Resumo por Página</Text>

      {/* Table header */}
      <View style={styles.summaryTableHeader}>
        <Text
          style={[
            styles.summaryCell,
            { flex: 3, fontFamily: "Helvetica-Bold" },
          ]}
        >
          Página
        </Text>
        <Text
          style={[
            styles.summaryCell,
            { width: 42, textAlign: "center", fontFamily: "Helvetica-Bold" },
          ]}
        >
          Saúde
        </Text>
        <Text
          style={[
            styles.summaryCell,
            { width: 38, textAlign: "center", fontFamily: "Helvetica-Bold" },
          ]}
        >
          Perf.
        </Text>
        <Text
          style={[
            styles.summaryCell,
            { width: 32, textAlign: "center", fontFamily: "Helvetica-Bold" },
          ]}
        >
          SEO
        </Text>
        <Text
          style={[
            styles.summaryCell,
            { width: 32, textAlign: "center", fontFamily: "Helvetica-Bold" },
          ]}
        >
          A11y
        </Text>
        <Text
          style={[
            styles.summaryCell,
            { width: 48, textAlign: "right", fontFamily: "Helvetica-Bold" },
          ]}
        >
          LCP
        </Text>
      </View>

      {/* Table rows */}
      {pages.map(({ page, audit }) => {
        const health = siteHealth(
          audit.perfScore,
          audit.seoScore,
          audit.accessibilityScore
        )
        const healthGrade = gradeScore(health)
        const perfGrade = gradeScore(audit.perfScore ?? 0)
        const seoGrade = gradeScore(audit.seoScore ?? 0)
        const a11yGrade = gradeScore(audit.accessibilityScore ?? 0)
        const lcpValue = audit.cruxLcp ?? audit.lcp
        const lcpGrade = lcpValue !== null ? gradeMetric("lcp", lcpValue) : null

        return (
          <View key={page.url} style={styles.summaryTableRow}>
            <Text style={[styles.summaryCell, { flex: 3 }]}>
              {page.label ?? pdfPathLabel(page.url)}
            </Text>
            <Text
              style={[
                styles.summaryCell,
                {
                  width: 42,
                  textAlign: "center",
                  color: gradeColor(healthGrade),
                  fontFamily: "Helvetica-Bold",
                },
              ]}
            >
              {health}
            </Text>
            <Text
              style={[
                styles.summaryCell,
                {
                  width: 38,
                  textAlign: "center",
                  color: gradeColor(perfGrade),
                },
              ]}
            >
              {audit.perfScore ?? "—"}
            </Text>
            <Text
              style={[
                styles.summaryCell,
                {
                  width: 32,
                  textAlign: "center",
                  color: gradeColor(seoGrade),
                },
              ]}
            >
              {audit.seoScore ?? "—"}
            </Text>
            <Text
              style={[
                styles.summaryCell,
                {
                  width: 32,
                  textAlign: "center",
                  color: gradeColor(a11yGrade),
                },
              ]}
            >
              {audit.accessibilityScore ?? "—"}
            </Text>
            <Text
              style={[
                styles.summaryCell,
                {
                  width: 48,
                  textAlign: "right",
                  color: lcpGrade ? gradeColor(lcpGrade) : "#6b7280",
                },
              ]}
            >
              {lcpValue !== null ? formatMetricValue("lcp", lcpValue) : "—"}
            </Text>
          </View>
        )
      })}

      <View style={styles.coverFooter}>
        <Text>{branding?.agencyContact ?? "perfally.com"}</Text>
        <Text>Gerado por PerfAlly</Text>
      </View>
      <PageFooter agency={branding?.agencyName} />
    </Page>
  )
}

// ─── Page 1: Cover + Executive Summary ───────────────────────────────────────

function CoverSummaryPage({
  project,
  audit,
  branding,
  accent,
  pageLabel,
}: {
  project: ReportProps["project"]
  audit: AuditData
  branding?: Branding | null
  accent: string
  pageLabel?: string
}) {
  const health = siteHealth(audit.perfScore, audit.seoScore, audit.accessibilityScore)
  const healthGrade = gradeScore(health)
  const metrics: {
    key: "lcp" | "cls" | "inp" | "fcp" | "ttfb"
    lab: number | null
    field: number | null
  }[] = [
    { key: "lcp", lab: audit.lcp, field: audit.cruxLcp },
    { key: "cls", lab: audit.cls, field: audit.cruxCls },
    { key: "inp", lab: audit.inp, field: audit.cruxInp },
    { key: "fcp", lab: audit.fcp, field: audit.cruxFcp },
    { key: "ttfb", lab: audit.ttfb, field: null },
  ]
  const categoryScores = [
    { label: "Performance", value: audit.perfScore },
    { label: "SEO", value: audit.seoScore },
    { label: "Acessibilidade", value: audit.accessibilityScore },
    { label: "Boas Práticas", value: audit.bestPracticesScore },
  ]
  return (
    <Page size="A4" style={styles.page}>
      <View style={[styles.coverAccentBar, { backgroundColor: accent }]} />
      {pageLabel && <PageSectionBadge label={pageLabel} />}
      {branding?.agencyLogoUrl && (
        <Image
          src={branding.agencyLogoUrl}
          style={{ width: 80, marginBottom: 8 }}
        />
      )}
      {branding?.agencyName && (
        <Text style={{ fontSize: 11, color: "#6b7280", marginBottom: 16 }}>
          {branding.agencyName}
        </Text>
      )}
      <Text
        style={{
          fontSize: 11,
          color: "#6b7280",
          marginBottom: 8,
          fontFamily: "Helvetica-Bold",
        }}
      >
        RELATÓRIO DE PERFORMANCE
      </Text>
      <Text style={styles.coverTitle}>{project.name}</Text>
      <Link src={project.url} style={styles.coverUrl}>
        {project.url}
      </Link>
      <View style={{ flexDirection: "row", gap: 16, marginBottom: 24 }}>
        <Text style={{ fontSize: 9, color: "#9ca3af" }}>
          {project.strategy === "mobile" ? "📱 Mobile" : "🖥️ Desktop"}
        </Text>
        <Text style={{ fontSize: 9, color: "#9ca3af" }}>
          Auditado em {formatDate(audit.createdAt)}
        </Text>
      </View>
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}
      >
        <View style={{ alignItems: "center", marginRight: 32 }}>
          <View
            style={[
              styles.coverScoreCircle,
              { backgroundColor: gradeColor(healthGrade) },
            ]}
          >
            <Text style={styles.coverScoreNumber}>{health}</Text>
          </View>
          <Text style={styles.coverScoreLabel}>Saúde do Site</Text>
          <View
            style={[
              styles.coverGradeBadge,
              {
                backgroundColor: gradeBg(healthGrade),
                color: gradeColor(healthGrade),
              },
            ]}
          >
            <Text>{GRADE_LABELS[healthGrade].toUpperCase()}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionHeader}>Resumo Executivo</Text>
          <View style={styles.row}>
            {categoryScores.slice(0, 2).map((cat) => {
              const score = cat.value ?? 0
              const grade = gradeScore(score)
              return (
                <View
                  key={cat.label}
                  style={[
                    styles.scoreCard,
                    { backgroundColor: gradeBg(grade) },
                  ]}
                >
                  <Text
                    style={[
                      styles.scoreCardValue,
                      { color: gradeColor(grade) },
                    ]}
                  >
                    {score}
                  </Text>
                  <Text style={styles.scoreCardLabel}>{cat.label}</Text>
                  <View
                    style={[
                      styles.scoreCardGrade,
                      { backgroundColor: gradeColor(grade), color: "#fff" },
                    ]}
                  >
                    <Text>{GRADE_LABELS[grade]}</Text>
                  </View>
                </View>
              )
            })}
          </View>
          <View style={styles.row}>
            {categoryScores.slice(2).map((cat) => {
              const score = cat.value ?? 0
              const grade = gradeScore(score)
              return (
                <View
                  key={cat.label}
                  style={[
                    styles.scoreCard,
                    { backgroundColor: gradeBg(grade) },
                  ]}
                >
                  <Text
                    style={[
                      styles.scoreCardValue,
                      { color: gradeColor(grade) },
                    ]}
                  >
                    {score}
                  </Text>
                  <Text style={styles.scoreCardLabel}>{cat.label}</Text>
                  <View
                    style={[
                      styles.scoreCardGrade,
                      { backgroundColor: gradeColor(grade), color: "#fff" },
                    ]}
                  >
                    <Text>{GRADE_LABELS[grade]}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      </View>
      <Text
        style={[styles.sectionHeader, { marginTop: 0, fontSize: 11 }]}
      >
        Core Web Vitals
      </Text>
      {metrics.map(({ key, lab, field }) => {
        const exp = METRIC_EXPLANATIONS[key]
        const value = field ?? lab
        const grade =
          value !== null ? gradeMetric(key, value) : "needs-improvement"
        return (
          <View
            key={key}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 6,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Helvetica-Bold",
                flex: 1,
              }}
            >
              {exp.shortName}
            </Text>
            <Text style={{ fontSize: 9, color: "#6b7280", flex: 2 }}>
              {exp.name}
            </Text>
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Helvetica-Bold",
                width: 60,
                textAlign: "right",
                color: gradeColor(grade),
              }}
            >
              {value !== null ? formatMetricValue(key, value) : "—"}
            </Text>
            <View style={{ width: 50, alignItems: "flex-end" }}>
              <View
                style={[
                  styles.metricGradeBadge,
                  { backgroundColor: gradeBg(grade), color: gradeColor(grade) },
                ]}
              >
                <Text>{GRADE_LABELS[grade]}</Text>
              </View>
            </View>
          </View>
        )
      })}
      <View style={styles.coverFooter}>
        <Text>{branding?.agencyContact ?? "perfally.com"}</Text>
        <Text>Gerado por PerfAlly</Text>
      </View>
      <PageFooter agency={branding?.agencyName} />
    </Page>
  )
}

// ─── Metrics detail ───────────────────────────────────────────────────────────

function MetricsPage({
  audit,
  accent,
  pageLabel,
}: {
  audit: AuditData
  accent: string
  pageLabel?: string
}) {
  const metrics: {
    key: "lcp" | "cls" | "inp" | "fcp" | "ttfb"
    lab: number | null
    field: number | null
  }[] = [
    { key: "lcp", lab: audit.lcp, field: audit.cruxLcp },
    { key: "inp", lab: audit.inp, field: audit.cruxInp },
    { key: "cls", lab: audit.cls, field: audit.cruxCls },
    { key: "fcp", lab: audit.fcp, field: audit.cruxFcp },
    { key: "ttfb", lab: audit.ttfb, field: null },
  ]

  return (
    <Page size="A4" style={styles.page}>
      <View style={[styles.coverAccentBar, { backgroundColor: accent }]} />
      {pageLabel && <PageSectionBadge label={pageLabel} />}
      <Text style={styles.sectionHeader}>Métricas Detalhadas</Text>

      {metrics.map(({ key, lab, field }) => {
        const exp = METRIC_EXPLANATIONS[key]
        const displayValue = field ?? lab
        const grade: Grade =
          displayValue !== null
            ? gradeMetric(key, displayValue)
            : "needs-improvement"

        return (
          <View key={key} style={styles.metricRow}>
            <View style={styles.metricValueBlock}>
              <Text
                style={[
                  styles.metricValueText,
                  { color: gradeColor(grade) },
                ]}
              >
                {displayValue !== null
                  ? formatMetricValue(key, displayValue)
                  : "—"}
              </Text>
              <View
                style={[
                  styles.metricGradeBadge,
                  { backgroundColor: gradeBg(grade), color: gradeColor(grade) },
                ]}
              >
                <Text>{GRADE_LABELS[grade]}</Text>
              </View>
            </View>

            <View style={styles.metricInfo}>
              <Text style={styles.metricName}>
                {exp.shortName} — {exp.name}
              </Text>
              <Text style={styles.metricWhat}>{exp.what}</Text>
              <Text style={{ fontSize: 8, color: "#9ca3af" }}>
                Meta: {exp.target}
              </Text>

              {(lab !== null || field !== null) && (
                <View style={styles.metricFieldRow}>
                  {lab !== null && (
                    <View style={styles.metricFieldItem}>
                      <Text style={styles.metricFieldLabel}>Laboratório</Text>
                      <Text style={styles.metricFieldValue}>
                        {formatMetricValue(key, lab)}
                      </Text>
                    </View>
                  )}
                  {field !== null && (
                    <View style={styles.metricFieldItem}>
                      <Text style={styles.metricFieldLabel}>
                        Usuários reais (P75)
                      </Text>
                      <Text style={styles.metricFieldValue}>
                        {formatMetricValue(key, field)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )
      })}

      <PageFooter agency={undefined} />
    </Page>
  )
}

// ─── Action Plan ─────────────────────────────────────────────────────────────

function ActionPlanPage({
  audit,
  accent,
  pageLabel,
}: {
  audit: AuditData
  accent: string
  pageLabel?: string
}) {
  const aiPlan = audit.aiActionPlan as AIActionItem[] | null
  const hasAIPlan = aiPlan && aiPlan.length > 0
  const staticPlan = getActionPlan(audit.lighthouseRaw)

  const DIFFICULTY_COLORS: Record<string, string> = {
    Fácil: "#15803d",
    Médio: "#d97706",
    Difícil: "#dc2626",
  }
  const DIFFICULTY_BG: Record<string, string> = {
    Fácil: "#f0fdf4",
    Médio: "#fffbeb",
    Difícil: "#fef2f2",
  }

  return (
    <Page size="A4" style={styles.page}>
      <View style={[styles.coverAccentBar, { backgroundColor: accent }]} />
      {pageLabel && <PageSectionBadge label={pageLabel} />}
      <Text style={styles.sectionHeader}>
        Plano de Ação{hasAIPlan ? " (IA)" : ""}
      </Text>

      {hasAIPlan
        ? aiPlan.map((item, i) => (
            <View key={i} style={styles.actionItem}>
              <View style={styles.actionNumber}>
                <Text style={styles.actionNumberText}>{i + 1}</Text>
              </View>
              <View style={styles.actionContent}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 3,
                  }}
                >
                  <Text style={[styles.actionTitle, { flex: 1 }]}>
                    {item.title}
                  </Text>
                  <View
                    style={[
                      styles.difficultyBadge,
                      {
                        backgroundColor:
                          DIFFICULTY_BG[item.difficulty] ?? "#f3f4f6",
                        color:
                          DIFFICULTY_COLORS[item.difficulty] ?? "#374151",
                      },
                    ]}
                  >
                    <Text>{item.difficulty}</Text>
                  </View>
                </View>
                <Text style={styles.actionText}>{item.action}</Text>
                {item.steps && item.steps.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    {item.steps.map((step, si) => (
                      <View
                        key={si}
                        style={{ flexDirection: "row", marginBottom: 2 }}
                      >
                        <Text
                          style={{
                            fontSize: 8,
                            color: "#374151",
                            marginRight: 4,
                            minWidth: 12,
                          }}
                        >
                          {si + 1}.
                        </Text>
                        <Text style={{ fontSize: 8, color: "#374151", flex: 1 }}>
                          {step}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={styles.actionWhy}>{item.why}</Text>
                {item.stackTip && (
                  <Text
                    style={{ fontSize: 8, color: "#7c3aed", marginTop: 3 }}
                  >
                    Dica: {item.stackTip}
                  </Text>
                )}
              </View>
            </View>
          ))
        : staticPlan.length > 0
          ? staticPlan.map((item, i) => (
              <View key={item.auditId} style={styles.actionItem}>
                <View style={styles.actionNumber}>
                  <Text style={styles.actionNumberText}>{i + 1}</Text>
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>{item.title}</Text>
                  <Text style={styles.actionText}>{item.fix}</Text>
                  {item.savings && (
                    <Text style={styles.actionWhy}>
                      Economia potencial: {item.savings}
                    </Text>
                  )}
                </View>
              </View>
            ))
          : (
              <View
                style={{
                  padding: 16,
                  borderRadius: 8,
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: "#15803d",
                    fontFamily: "Helvetica-Bold",
                  }}
                >
                  Nenhum problema crítico encontrado
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    color: "#16a34a",
                    marginTop: 4,
                  }}
                >
                  Esta página passou em todas as auditorias de performance.
                </Text>
              </View>
            )}

      <PageFooter agency={undefined} />
    </Page>
  )
}

// ─── SEO & Accessibility ─────────────────────────────────────────────────────

function SEOPage({
  audit,
  accent,
  pageLabel,
}: {
  audit: AuditData
  accent: string
  pageLabel?: string
}) {
  const lhr = audit.lighthouseRaw as LighthouseResult | null
  if (!lhr?.audits) return null

  const items = getFailingSEOItems(lhr)
  const seoItems = items.filter((i) => i.isSEO)
  const a11yItems = items.filter((i) => !i.isSEO)
  const allPassing = items.length === 0

  return (
    <Page size="A4" style={styles.page}>
      <View style={[styles.coverAccentBar, { backgroundColor: accent }]} />
      {pageLabel && <PageSectionBadge label={pageLabel} />}
      <Text style={styles.sectionHeader}>SEO e Acessibilidade</Text>

      {allPassing ? (
        <View
          style={{
            padding: 16,
            borderRadius: 8,
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: "#15803d",
              fontFamily: "Helvetica-Bold",
            }}
          >
            Tudo certo!
          </Text>
          <Text
            style={{ fontSize: 9, color: "#16a34a", marginTop: 4 }}
          >
            Nenhum problema de SEO ou acessibilidade encontrado.
          </Text>
        </View>
      ) : (
        <>
          {seoItems.length > 0 && (
            <>
              <Text style={styles.seoSectionLabel}>
                SEO ({seoItems.length}{" "}
                {seoItems.length === 1 ? "problema" : "problemas"})
              </Text>
              {seoItems.map((item) => (
                <View key={item.id} style={styles.seoItem}>
                  <View
                    style={[
                      styles.seoItemDot,
                      {
                        backgroundColor:
                          item.score === 0 ? "#dc2626" : "#d97706",
                      },
                    ]}
                  />
                  <Text style={styles.seoItemLabel}>{item.label}</Text>
                  <Text style={styles.seoItemId}>{item.id}</Text>
                </View>
              ))}
            </>
          )}

          {a11yItems.length > 0 && (
            <>
              <Text
                style={[
                  styles.seoSectionLabel,
                  { marginTop: seoItems.length > 0 ? 12 : 0 },
                ]}
              >
                Acessibilidade ({a11yItems.length}{" "}
                {a11yItems.length === 1 ? "problema" : "problemas"})
              </Text>
              {a11yItems.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.seoItem,
                    { borderColor: "#fed7aa", backgroundColor: "#fff7ed" },
                  ]}
                >
                  <View
                    style={[
                      styles.seoItemDot,
                      { backgroundColor: "#d97706" },
                    ]}
                  />
                  <Text style={styles.seoItemLabel}>{item.label}</Text>
                  <Text style={styles.seoItemId}>{item.id}</Text>
                </View>
              ))}
            </>
          )}
        </>
      )}

      <PageFooter agency={undefined} />
    </Page>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function AuditReportPDF({ project, pages, branding }: ReportProps) {
  const accent = branding?.accentColor ?? "#2563eb"
  const isMultiPage = pages.length > 1

  return (
    <Document
      title={`Relatório de Performance — ${project.name}`}
      author={branding?.agencyName ?? "PerfAlly"}
      subject="Relatório de Core Web Vitals"
    >
      {isMultiPage && (
        <ProjectCoverPage
          project={project}
          pages={pages}
          branding={branding}
          accent={accent}
        />
      )}
      {pages.map(({ page, audit }) => {
        const pageLabel = isMultiPage
          ? (page.label ?? pdfPathLabel(page.url))
          : undefined
        return (
          <React.Fragment key={page.url}>
            <CoverSummaryPage
              project={{ ...project, url: page.url }}
              audit={audit}
              branding={branding}
              accent={accent}
              pageLabel={pageLabel}
            />
            <MetricsPage audit={audit} accent={accent} pageLabel={pageLabel} />
            <ActionPlanPage audit={audit} accent={accent} pageLabel={pageLabel} />
            <SEOPage audit={audit} accent={accent} pageLabel={pageLabel} />
          </React.Fragment>
        )
      })}
    </Document>
  )
}
