import { gradeScore, GRADE_STYLES, GRADE_LABELS } from "@/lib/utils/metrics"
import { ScoreGauge } from "@/components/metrics/ScoreGauge"
import { cn } from "@/lib/utils"
import type { Grade } from "@/lib/db/schema"

interface SiteHealthCardProps {
  perfScore: number
  seoScore: number | null
  accessibilityScore: number | null
  bestPracticesScore: number | null
  lighthouseVersion?: string | null
  auditedAt: Date
  shareSlot?: React.ReactNode
}

interface QuadrantProps {
  label: string
  score: number | null
  grade: Grade
}

function Quadrant({ label, score, grade }: QuadrantProps) {
  const styles = GRADE_STYLES[grade]
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border bg-muted/30 p-3 text-center">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{score ?? "—"}</p>
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-xs font-medium border",
          styles.badge
        )}
      >
        {GRADE_LABELS[grade]}
      </span>
    </div>
  )
}

export function SiteHealthCard({
  perfScore,
  seoScore,
  accessibilityScore,
  bestPracticesScore,
  lighthouseVersion,
  auditedAt,
  shareSlot,
}: SiteHealthCardProps) {
  // Composite "Saúde do Site" score: perf 40%, seo 30%, a11y 30%
  const siteHealth = Math.round(
    perfScore * 0.4 +
    (seoScore ?? perfScore) * 0.3 +
    (accessibilityScore ?? perfScore) * 0.3
  )

  const perfGrade = gradeScore(perfScore)
  const seoGrade = gradeScore(seoScore ?? 0)
  const a11yGrade = gradeScore(accessibilityScore ?? 0)
  const bpGrade = gradeScore(bestPracticesScore ?? 0)

  const when = new Date(auditedAt).toLocaleString("pt-BR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <ScoreGauge score={siteHealth} size="lg" />
          <div className="space-y-0.5">
            <p className="text-lg font-semibold">Saúde do Site</p>
            <p className="text-sm text-muted-foreground">
              {siteHealth}/100 · Lighthouse {lighthouseVersion ?? "audit"}
            </p>
            <p className="text-xs text-muted-foreground">{when}</p>
          </div>
        </div>
        {shareSlot}
      </div>

      {/* 2×2 grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Quadrant label="Performance" score={perfScore} grade={perfGrade} />
        <Quadrant label="SEO" score={seoScore} grade={seoGrade} />
        <Quadrant label="Acessibilidade" score={accessibilityScore} grade={a11yGrade} />
        <Quadrant label="Boas Práticas" score={bestPracticesScore} grade={bpGrade} />
      </div>
    </div>
  )
}
