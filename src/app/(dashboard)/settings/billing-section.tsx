"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createCheckoutSession, createBillingPortalSession } from "@/app/actions/billing"
import type { Plan } from "@/lib/db/schema"
import type { PlanKey } from "@/app/actions/billing"
import { Check, Loader2 } from "lucide-react"

interface PlanOption {
  key: PlanKey
  name: string
  price: number
  features: string[]
}

const PLANS: PlanOption[] = [
  {
    key: "starter",
    name: "Starter",
    price: 99,
    features: [
      "5 projetos",
      "Auditorias ilimitadas",
      "Monitoramento diário automático",
      "Alertas por e-mail",
      "Histórico de 30 dias",
      "5 planos de ação por IA/mês",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: 249,
    features: [
      "20 projetos",
      "Auditorias ilimitadas",
      "Monitoramento por hora automático",
      "Alertas e-mail + Slack",
      "Relatórios em PDF",
      "Histórico de 90 dias",
      "30 planos de ação por IA/mês",
    ],
  },
  {
    key: "agency",
    name: "Agência",
    price: 499,
    features: [
      "100 projetos",
      "Auditorias ilimitadas",
      "Monitoramento por hora automático",
      "Alertas e-mail + Slack",
      "PDFs white-label",
      "Histórico de 1 ano",
      "Planos de ação por IA ilimitados",
    ],
  },
]

interface Props {
  plan: Plan
  hasStripeCustomer: boolean
}

export function BillingSection({ plan, hasStripeCustomer }: Props) {
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null)
  const [portalPending, startPortalTransition] = useTransition()

  async function handleUpgrade(key: PlanKey) {
    setLoadingPlan(key)
    try {
      const result = await createCheckoutSession(key)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        window.location.href = result.url
      }
    } finally {
      setLoadingPlan(null)
    }
  }

  function handleBillingPortal() {
    startPortalTransition(async () => {
      const result = await createBillingPortalSession()
      if ("error" in result) {
        toast.error(result.error)
      } else {
        window.location.href = result.url
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assinatura</CardTitle>
        <CardDescription>
          {plan === "free"
            ? "Faça upgrade para desbloquear monitoramento agendado, alertas e mais."
            : "Gerencie sua assinatura."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Manage existing subscription */}
        {hasStripeCustomer && plan !== "free" && (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="text-sm">
              <p className="font-medium capitalize">Plano {plan}</p>
              <p className="text-muted-foreground text-xs">
                Trocar plano, atualizar pagamento ou cancelar.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBillingPortal}
              disabled={portalPending}
            >
              {portalPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Gerenciar assinatura
            </Button>
          </div>
        )}

        {/* Plan cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          {PLANS.map((p) => {
            const isCurrent = plan === p.key
            const isLoading = loadingPlan === p.key

            return (
              <div
                key={p.key}
                className={[
                  "flex flex-col rounded-lg border p-4",
                  isCurrent ? "border-foreground bg-muted/30" : "",
                ].join(" ")}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-muted-foreground text-sm">
                      R${p.price}
                      <span className="text-xs">/mês</span>
                    </p>
                  </div>
                  {isCurrent && (
                    <Badge variant="secondary" className="text-xs">
                      Atual
                    </Badge>
                  )}
                </div>

                <ul className="mb-4 flex-1 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  size="sm"
                  variant={isCurrent ? "secondary" : "default"}
                  disabled={isCurrent || isLoading || loadingPlan !== null || portalPending}
                  onClick={() => handleUpgrade(p.key)}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isCurrent ? (
                    "Plano atual"
                  ) : (
                    "Fazer upgrade"
                  )}
                </Button>
              </div>
            )
          })}
        </div>

        <p className="text-muted-foreground text-xs">
          Todos os planos são cobrados mensalmente. Cancele a qualquer momento pelo portal de assinatura.
        </p>
      </CardContent>
    </Card>
  )
}
