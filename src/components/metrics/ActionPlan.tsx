import { cn } from "@/lib/utils"
import { getActionPlan } from "@/lib/utils/explanations"
import type { ActionItem } from "@/lib/utils/explanations"
import type { AIActionItem } from "@/types"
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Sparkles } from "lucide-react"

interface ActionPlanProps {
  lighthouseRaw: unknown
  aiPlan?: AIActionItem[] | null
}

const IMPACT_CONFIG = {
  high: {
    icon: AlertTriangle,
    label: "Alto impacto",
    iconClass: "text-red-500",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
  },
  medium: {
    icon: AlertCircle,
    label: "Médio impacto",
    iconClass: "text-amber-500",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  low: {
    icon: Info,
    label: "Baixo impacto",
    iconClass: "text-blue-500",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
}

const DIFFICULTY_CONFIG = {
  "Fácil": "bg-green-50 text-green-700 border-green-200",
  "Médio": "bg-amber-50 text-amber-700 border-amber-200",
  "Difícil": "bg-red-50 text-red-700 border-red-200",
}

export function ActionPlan({ lighthouseRaw, aiPlan }: ActionPlanProps) {
  // Use AI plan if available and non-empty
  if (aiPlan && aiPlan.length > 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-xs font-medium text-violet-600">Gerado por IA</span>
        </div>
        {aiPlan.map((item, i) => (
          <AIActionItemCard key={i} item={item} index={i + 1} />
        ))}
      </div>
    )
  }

  // Fallback to static plan
  const items = getActionPlan(lighthouseRaw)

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-green-50 p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
        <div>
          <p className="font-medium text-green-800">Nenhum problema crítico encontrado</p>
          <p className="text-sm text-green-700">
            Esta página passou em todas as auditorias de performance. Ótimo trabalho!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <StaticActionItem key={item.auditId} item={item} index={i + 1} />
      ))}
    </div>
  )
}

function AIActionItemCard({ item, index }: { item: AIActionItem; index: number }) {
  const difficultyClass =
    DIFFICULTY_CONFIG[item.difficulty] ?? "bg-gray-50 text-gray-700 border-gray-200"

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {/* Number */}
        <div className="bg-muted text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
          {index}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {/* Title + difficulty badge */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-medium leading-snug">{item.title}</p>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                difficultyClass
              )}
            >
              {item.difficulty}
            </span>
          </div>

          {/* Action */}
          <p className="text-muted-foreground text-sm leading-relaxed">{item.action}</p>

          {/* Implementation steps */}
          {item.steps && item.steps.length > 0 && (
            <ol className="space-y-1 pl-1">
              {item.steps.map((step, si) => (
                <li key={si} className="flex gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0 font-mono text-xs leading-5">
                    {si + 1}.
                  </span>
                  <span className="text-foreground/80 leading-snug">{step}</span>
                </li>
              ))}
            </ol>
          )}

          {/* Why it matters */}
          <p className="text-xs font-medium text-green-700">{item.why}</p>

          {/* Stack tip */}
          {item.stackTip && (
            <p className="text-muted-foreground rounded-md bg-violet-50 px-2.5 py-1.5 text-xs">
              <span className="font-medium text-violet-700">Dica para sua stack:</span>{" "}
              {item.stackTip}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function StaticActionItem({ item, index }: { item: ActionItem; index: number }) {
  const config = IMPACT_CONFIG[item.impact]
  const Icon = config.icon

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {/* Number */}
        <div className="bg-muted text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
          {index}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {/* Title + impact badge */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-medium leading-snug">{item.title}</p>
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                config.badgeClass
              )}
            >
              <Icon className={cn("h-3 w-3", config.iconClass)} />
              {config.label}
            </span>
          </div>

          {/* Fix guidance */}
          <p className="text-muted-foreground text-sm leading-relaxed">
            {item.fix}
          </p>

          {/* Savings estimate if available */}
          {item.savings && (
            <p className="text-xs font-medium text-green-700">
              Economia potencial: {item.savings}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
