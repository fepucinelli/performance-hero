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

interface AuditListProps {
  lighthouseRaw: unknown
}

// Audits to surface (ordered by importance to a non-technical user)
const AUDITS_TO_SHOW = [
  // Core performance
  "largest-contentful-paint",
  "interaction-to-next-paint",
  "total-blocking-time",
  "cumulative-layout-shift",
  "first-contentful-paint",
  "speed-index",
  "server-response-time",
  // Opportunities
  "render-blocking-resources",
  "unused-javascript",
  "unused-css-rules",
  "uses-optimized-images",
  "uses-text-compression",
  "uses-long-cache-ttl",
  "uses-responsive-images",
  "offscreen-images",
  "unminified-javascript",
  "unminified-css",
]

function scoreToGrade(score: number | null): "pass" | "average" | "fail" | "info" {
  if (score === null) return "info"
  if (score >= 0.9) return "pass"
  if (score >= 0.5) return "average"
  return "fail"
}

const GRADE_STYLES = {
  pass: "bg-green-100 text-green-700",
  average: "bg-amber-100 text-amber-700",
  fail: "bg-red-100 text-red-700",
  info: "bg-gray-100 text-gray-600",
}

const GRADE_DOT = {
  pass: "bg-green-500",
  average: "bg-amber-500",
  fail: "bg-red-500",
  info: "bg-gray-400",
}

// Converts Lighthouse markdown links [text](url) to <a> elements.
// Lighthouse descriptions contain only this pattern — no need for a full parser.
function renderDescription(text: string): React.ReactNode {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (match) {
      return (
        <a
          key={i}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground transition-colors"
        >
          {match[1]}
        </a>
      )
    }
    return part
  })
}

export function AuditList({ lighthouseRaw }: AuditListProps) {
  const [open, setOpen] = useState(false)
  const lhr = lighthouseRaw as LighthouseResult | null
  if (!lhr?.audits) return null

  const audits = AUDITS_TO_SHOW.flatMap((id) => {
    const a = lhr.audits[id]
    if (!a) return []
    return [{
      id,
      title: a.title,
      description: a.description,
      score: a.score,
      displayValue: a.displayValue,
      grade: scoreToGrade(a.score),
    }]
  })

  const failCount = audits.filter((a) => a.grade === "fail" || a.grade === "average").length

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="font-medium">Auditoria completa do Lighthouse</span>
          {failCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {failCount} {failCount === 1 ? "problema" : "problemas"}
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
          {audits.map((audit) => (
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
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {renderDescription(audit.description)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
