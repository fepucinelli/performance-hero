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
import { InfoIcon, FlaskConical, Users } from "lucide-react"

interface MetricCardProps {
  metric: MetricKey
  value: number | null
  fieldValue?: number | null // CrUX P75
  className?: string
}

export function MetricCard({ metric, value, fieldValue, className }: MetricCardProps) {
  const explanation = METRIC_EXPLANATIONS[metric]

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
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
              <span className="sr-only">Sobre {explanation.name}</span>
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

      {/* Lab data — Lighthouse synthetic */}
      <div className="border-t px-4 py-3">
        <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium">
          <FlaskConical className="h-3 w-3" />
          Laboratório · simulado
        </p>
        {value !== null ? (
          <MetricValue metric={metric} value={value} />
        ) : (
          <p className="text-muted-foreground text-sm">
            {metric === "inp"
              ? "Não mensurável sem interação real"
              : "Sem dados"}
          </p>
        )}
      </div>

      {/* CrUX field data — real Chrome users */}
      <div className="bg-muted/30 border-t px-4 py-3">
        <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium">
          <Users className="h-3 w-3" />
          Usuários reais · P75
        </p>
        {fieldValue !== null && fieldValue !== undefined ? (
          <MetricValue metric={metric} value={fieldValue} />
        ) : metric === "ttfb" ? (
          <p className="text-muted-foreground text-xs">
            TTFB não é incluído no Chrome UX Report — disponível apenas como dado de laboratório.
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Site sem dados suficientes no Chrome UX Report. Disponível apenas para sites com tráfego real significativo.
          </p>
        )}
      </div>
    </div>
  )
}

function MetricValue({ metric, value }: { metric: MetricKey; value: number }) {
  const grade = gradeMetric(metric, value)
  const styles = GRADE_STYLES[grade]

  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-2">
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
      <GradeBar metric={metric} value={value} />
    </div>
  )
}

// Segmented bar showing good / needs-improvement / poor zones
function GradeBar({ metric, value }: { metric: MetricKey; value: number }) {
  const grade = gradeMetric(metric, value)
  return (
    <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
      <div
        className={cn(
          "h-full flex-1 rounded-full transition-opacity",
          grade === "good" ? "bg-green-500" : "bg-green-200"
        )}
      />
      <div
        className={cn(
          "h-full flex-1 rounded-full transition-opacity",
          grade === "needs-improvement" ? "bg-amber-500" : "bg-amber-200"
        )}
      />
      <div
        className={cn(
          "h-full flex-1 rounded-full transition-opacity",
          grade === "poor" ? "bg-red-500" : "bg-red-200"
        )}
      />
    </div>
  )
}
