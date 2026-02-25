import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  gradeMetric,
  formatMetricValue,
  GRADE_STYLES,
  GRADE_LABELS,
} from "@/lib/utils/metrics"
import type { MetricKey } from "@/lib/utils/metrics"
import { METRIC_EXPLANATIONS } from "@/lib/utils/explanations"
import { InfoIcon } from "lucide-react"

interface MetricCardProps {
  metric: MetricKey
  value: number | null
  fieldValue?: number | null // CrUX P75
  className?: string
}

export function MetricCard({ metric, value, fieldValue, className }: MetricCardProps) {
  const explanation = METRIC_EXPLANATIONS[metric]
  const grade = value !== null ? gradeMetric(metric, value) : null
  const styles = grade ? GRADE_STYLES[grade] : null

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {explanation.shortName}
          </p>
          <p className="text-sm font-medium leading-tight">{explanation.name}</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-muted-foreground mt-0.5 shrink-0 hover:text-foreground">
              <InfoIcon className="h-3.5 w-3.5" />
              <span className="sr-only">About {explanation.name}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-sm">
            <p className="font-medium">{explanation.what}</p>
            <p className="text-muted-foreground mt-1">{explanation.why}</p>
            <p className="mt-1 font-medium text-green-600">
              Meta: {explanation.target}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Value + grade */}
      {value !== null && grade && styles ? (
        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold tabular-nums">
              {formatMetricValue(metric, value)}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-medium",
                styles.badge
              )}
            >
              {GRADE_LABELS[grade]}
            </span>
          </div>

          {/* Grade bar */}
          <GradeBar metric={metric} value={value} />

          {/* Field data */}
          {fieldValue !== null && fieldValue !== undefined && (
            <div className="border-border/50 mt-2 border-t pt-2">
              <p className="text-muted-foreground text-xs">
                Usuários reais (P75):{" "}
                <span className="font-medium text-foreground">
                  {formatMetricValue(metric, fieldValue)}
                </span>
              </p>
            </div>
          )}
        </div>
      ) : fieldValue !== null && fieldValue !== undefined ? (
        // No lab value but CrUX field data is available (e.g. INP)
        (() => {
          const fieldGrade = gradeMetric(metric, fieldValue)
          const fieldStyles = GRADE_STYLES[fieldGrade]
          return (
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold tabular-nums">
                  {formatMetricValue(metric, fieldValue)}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs font-medium",
                    fieldStyles.badge
                  )}
                >
                  {GRADE_LABELS[fieldGrade]}
                </span>
              </div>
              <GradeBar metric={metric} value={fieldValue} />
              <p className="text-muted-foreground text-xs">Dados reais de usuários (P75)</p>
            </div>
          )
        })()
      ) : (
        <div className="space-y-1">
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
            {metric === "inp" ? "Requer dados de usuários reais" : "Sem dados"}
          </div>
          {metric === "inp" && (
            <p className="text-muted-foreground text-xs leading-snug">
              INP não pode ser medido em laboratório — ele aparece quando o site tem tráfego suficiente no Chrome.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Segmented bar showing good / needs-improvement / poor zones
function GradeBar({ metric, value }: { metric: MetricKey; value: number }) {
  const grade = gradeMetric(metric, value)
  return (
    <div className="flex h-1.5 w-full gap-0.5 rounded-full overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full flex-1 transition-opacity",
          grade === "good" ? "bg-green-500" : "bg-green-200"
        )}
      />
      <div
        className={cn(
          "h-full rounded-full flex-1 transition-opacity",
          grade === "needs-improvement" ? "bg-amber-500" : "bg-amber-200"
        )}
      />
      <div
        className={cn(
          "h-full rounded-full flex-1 transition-opacity",
          grade === "poor" ? "bg-red-500" : "bg-red-200"
        )}
      />
    </div>
  )
}
