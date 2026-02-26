"use client"

import { useState } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { LighthouseResult } from "@/types"

interface SEOAuditListProps {
  lighthouseRaw: unknown
}

const SEO_AUDIT_LABELS: Record<string, string> = {
  "document-title": "Título da página ausente",
  "meta-description": "Meta descrição ausente",
  hreflang: "Atributos hreflang inválidos",
  canonical: "Link canônico inválido",
  "robots-txt": "Arquivo robots.txt com erro",
  "link-text": "Links com texto genérico ('clique aqui')",
  "crawlable-anchors": "Links não rastreáveis",
  "is-crawlable": "Página bloqueada para indexação",
  "tap-targets": "Alvos de toque muito pequenos (mobile)",
  "font-size": "Texto muito pequeno para leitura",
  viewport: "Viewport não configurado",
  "structured-data": "Dados estruturados com erro",
}

const GRADE_STYLES = {
  pass: "bg-green-100 text-green-700",
  average: "bg-amber-100 text-amber-700",
  fail: "bg-red-100 text-red-700",
}

const GRADE_DOT = {
  pass: "bg-green-500",
  average: "bg-amber-500",
  fail: "bg-red-500",
}

function scoreToGrade(score: number | null): "pass" | "average" | "fail" {
  if (score === null || score < 0.5) return "fail"
  if (score < 0.9) return "average"
  return "pass"
}

export function SEOAuditList({ lighthouseRaw }: SEOAuditListProps) {
  const [open, setOpen] = useState(false)
  const lhr = lighthouseRaw as LighthouseResult | null
  if (!lhr?.audits) return null

  const seoRefs = lhr.categories.seo?.auditRefs ?? []
  const a11yRefs = lhr.categories.accessibility?.auditRefs ?? []

  // Collect failing/partial audits from SEO and accessibility categories
  const allRefs = [...seoRefs, ...a11yRefs]
  const seen = new Set<string>()

  const failingAudits = allRefs.flatMap((ref) => {
    if (seen.has(ref.id)) return []
    seen.add(ref.id)
    const audit = lhr.audits[ref.id]
    if (!audit) return []
    // Only show failed (score < 1) and non-informational (score !== null)
    if (audit.score === null || audit.score >= 1) return []
    const grade = scoreToGrade(audit.score)
    return [{
      id: ref.id,
      title: SEO_AUDIT_LABELS[ref.id] ?? audit.title,
      description: audit.description,
      displayValue: audit.displayValue,
      grade,
    }]
  })

  if (failingAudits.length === 0) {
    return (
      <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          <span className="text-sm font-medium">SEO e Acessibilidade</span>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Sem problemas
          </span>
        </div>
      </div>
    )
  }

  const failCount = failingAudits.filter((a) => a.grade === "fail").length
  const warnCount = failingAudits.filter((a) => a.grade === "average").length

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="font-medium">SEO e Acessibilidade</span>
          {failCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {failCount} {failCount === 1 ? "erro" : "erros"}
            </span>
          )}
          {warnCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {warnCount} {warnCount === 1 ? "aviso" : "avisos"}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div className="rounded-xl border bg-white shadow-sm divide-y overflow-hidden">
          {failingAudits.map((audit) => (
            <div key={audit.id} className="flex items-start gap-3 px-4 py-3">
              <div
                className={cn(
                  "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                  GRADE_DOT[audit.grade]
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{audit.title}</p>
                  {audit.displayValue && (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-medium",
                        GRADE_STYLES[audit.grade]
                      )}
                    >
                      {audit.displayValue}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs line-clamp-2">
                  {audit.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
