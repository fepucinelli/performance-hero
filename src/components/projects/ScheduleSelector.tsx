"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { updateScheduleAction } from "@/app/actions/schedule"
import { PLAN_LIMITS } from "@/lib/utils/plan-limits"
import type { Plan } from "@/lib/db/schema"
import { Lock, Zap } from "lucide-react"
import Link from "next/link"

type Schedule = "manual" | "daily" | "hourly"

interface Props {
  projectId: string
  currentSchedule: Schedule
  userPlan: Plan
}

const OPTIONS: { value: Schedule; label: string; description: string }[] = [
  { value: "manual", label: "Somente manual", description: "Execute auditorias sob demanda" },
  { value: "daily", label: "Diário", description: "Execução automática uma vez por dia" },
  { value: "hourly", label: "Por hora", description: "Execução automática a cada hora" },
]

export function ScheduleSelector({ projectId, currentSchedule, userPlan }: Props) {
  const [selected, setSelected] = useState<Schedule>(currentSchedule)
  const [isPending, startTransition] = useTransition()
  const limits = PLAN_LIMITS[userPlan]
  const canSchedule = limits.scheduledRuns
  const canHourly = limits.hourlyRuns

  function handleChange(value: Schedule) {
    if (value === selected) return

    if (value !== "manual" && !canSchedule) {
      toast.error("Faça upgrade do seu plano para ativar auditorias agendadas.")
      return
    }

    if (value === "hourly" && !canHourly) {
      // Handled inline via upgrade prompt — no toast needed
      return
    }

    setSelected(value)
    startTransition(async () => {
      const result = await updateScheduleAction(projectId, value)
      if (result?.error) {
        setSelected(selected) // revert
        toast.error(result.error)
      } else {
        toast.success(
          `Agendamento atualizado para ${
            value === "manual" ? "somente manual" : value === "daily" ? "diário" : "por hora"
          }`
        )
      }
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Agendamento de monitoramento</p>
        {!canSchedule && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Plano pago necessário
          </span>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {OPTIONS.map((opt) => {
          const lockedSchedule = opt.value !== "manual" && !canSchedule
          const lockedHourly = opt.value === "hourly" && canSchedule && !canHourly
          const locked = lockedSchedule || lockedHourly
          const isSelected = selected === opt.value

          return (
            <button
              key={opt.value}
              onClick={() => handleChange(opt.value)}
              disabled={isPending || locked}
              title={lockedSchedule ? "Faça upgrade para ativar auditorias agendadas" : opt.description}
              className={[
                "rounded-lg border px-3 py-2 text-sm transition-colors text-left",
                isSelected
                  ? "border-foreground bg-foreground text-background"
                  : locked
                    ? "border-dashed opacity-50 cursor-not-allowed"
                    : "border-border hover:border-foreground/50",
                isPending && isSelected ? "opacity-70" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="font-medium">{opt.label}</span>
              {locked && <Lock className="inline ml-1 h-3 w-3" />}
            </button>
          )
        })}
      </div>

      {/* Upgrade prompt — shown only for Starter trying to use hourly */}
      {canSchedule && !canHourly && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-3">
          <Zap className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm text-muted-foreground">
            Monitoramento por hora está disponível no plano{" "}
            <span className="font-medium text-foreground">Pro</span>.{" "}
            <Link href="/settings" className="font-medium text-foreground underline underline-offset-2 hover:no-underline">
              Fazer upgrade →
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
