"use client"

import { useState } from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts"
import { THRESHOLDS } from "@/lib/utils/metrics"
import { FlaskConical, Users, InfoIcon } from "lucide-react"
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface DataPoint {
  createdAt: Date
  perfScore: number | null
  seoScore: number | null
  lcp: number | null
  cls: number | null
  inp: number | null
  fcp: number | null
  cruxLcp: number | null
  cruxCls: number | null
  cruxInp: number | null
  cruxFcp: number | null
}

interface Props {
  data: DataPoint[]
}

type Tab = "score" | "seo" | "lcp" | "fcp" | "cls" | "inp"

const TABS: { key: Tab; label: string }[] = [
  { key: "score", label: "Performance" },
  { key: "seo", label: "SEO" },
  { key: "lcp", label: "LCP" },
  { key: "fcp", label: "FCP" },
  { key: "cls", label: "CLS" },
  { key: "inp", label: "INP" },
]

// Reference lines (good / poor thresholds) per tab
const REFS: Record<Tab, { good: number; poor: number } | null> = {
  score: { good: 90, poor: 50 },
  seo: { good: 90, poor: 50 },
  lcp: { good: THRESHOLDS.lcp.good, poor: THRESHOLDS.lcp.poor },
  fcp: { good: THRESHOLDS.fcp.good, poor: THRESHOLDS.fcp.poor },
  cls: { good: THRESHOLDS.cls.good, poor: THRESHOLDS.cls.poor },
  inp: { good: THRESHOLDS.inp.good, poor: THRESHOLDS.inp.poor },
}

// Lab line = blue; CrUX line = violet
const LAB_COLOR = "#2563eb"
const CRUX_COLOR = "#7c3aed"

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("pt-BR", { month: "short", day: "numeric" })
}

function formatDateWithTime(d: Date) {
  const dt = new Date(d)
  const date = dt.toLocaleDateString("pt-BR", { month: "short", day: "numeric" })
  const time = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  return `${date} ${time}`
}

function formatValue(tab: Tab, value: number) {
  if (tab === "score" || tab === "seo") return `${value}`
  if (tab === "cls") return value.toFixed(3)
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`
}

function yAxisFormatter(tab: Tab, v: number) {
  if (tab === "score" || tab === "seo") return String(v)
  if (tab === "cls") return v.toFixed(2)
  return v >= 1000 ? `${(v / 1000).toFixed(0)}s` : `${v}`
}

export function ScoreHistoryChart({ data }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("score")

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed bg-muted/30 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Execute ao menos 2 auditorias para ver a evolução da performance.
        </p>
      </div>
    )
  }

  // Score/SEO tabs have no CrUX equivalent; INP has no lab equivalent
  const hasLabLine = activeTab !== "inp"
  const hasCruxLine = activeTab !== "score" && activeTab !== "seo"

  const chartData = data.map((d, i) => {
    const lab: number | null =
      activeTab === "score" ? d.perfScore :
      activeTab === "seo"   ? d.seoScore :
      activeTab === "lcp"   ? d.lcp :
      activeTab === "fcp"   ? d.fcp :
      activeTab === "cls"   ? d.cls :
      null // inp has no lab value

    const crux: number | null =
      activeTab === "lcp" ? d.cruxLcp :
      activeTab === "fcp" ? d.cruxFcp :
      activeTab === "cls" ? d.cruxCls :
      activeTab === "inp" ? d.cruxInp :
      null // score/seo have no crux equivalent

    return { index: i, date: formatDate(d.createdAt), label: formatDateWithTime(d.createdAt), lab, crux }
  })

  const refs = REFS[activeTab]

  return (
    <div className="space-y-3">
      {/* Tab switcher + legend */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {hasLabLine && (
            <span className="flex items-center gap-1.5">
              <FlaskConical className="h-3 w-3" style={{ color: LAB_COLOR }} />
              <span style={{ color: LAB_COLOR }} className="font-medium">Laboratório</span>
            </span>
          )}
          {hasCruxLine && (
            <span className="flex items-center gap-1.5">
              <Users className="h-3 w-3" style={{ color: CRUX_COLOR }} />
              <span style={{ color: CRUX_COLOR }} className="font-medium">Usuários reais (P75)</span>
              <UITooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground leading-none">
                    <InfoIcon className="h-3 w-3" />
                    <span className="sr-only">O que é P75?</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  P75 (percentil 75) significa que 75% dos usuários reais tiveram um resultado igual ou melhor que este valor. É o padrão do Google para medir a experiência real dos visitantes.
                </TooltipContent>
              </UITooltip>
            </span>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="index"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(i: number) => chartData[i]?.date ?? ""}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={(v) => yAxisFormatter(activeTab, v)}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const point = payload[0]?.payload as { label: string } | undefined
              const lab = payload?.find((p) => p.dataKey === "lab")?.value as number | null | undefined
              const crux = payload?.find((p) => p.dataKey === "crux")?.value as number | null | undefined
              return (
                <div style={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", padding: "8px 10px" }}>
                  <p style={{ fontWeight: 600, marginBottom: 6 }}>{point?.label}</p>
                  {hasLabLine && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "3px 0" }}>
                      <span style={{ display: "inline-block", width: 10, height: 3, borderRadius: 2, backgroundColor: LAB_COLOR, flexShrink: 0 }} />
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>Laboratório</span>
                      <span style={{ fontWeight: 600, marginLeft: "auto", paddingLeft: 12 }}>
                        {lab != null ? formatValue(activeTab, lab) : "—"}
                      </span>
                    </div>
                  )}
                  {hasCruxLine && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "3px 0" }}>
                      <span style={{ display: "inline-block", width: 10, height: 3, borderRadius: 2, background: `repeating-linear-gradient(to right, ${CRUX_COLOR} 0, ${CRUX_COLOR} 4px, transparent 4px, transparent 7px)`, flexShrink: 0 }} />
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>Usuários reais (P75)</span>
                      <span style={{ fontWeight: 600, marginLeft: "auto", paddingLeft: 12 }}>
                        {crux != null ? formatValue(activeTab, crux) : "—"}
                      </span>
                    </div>
                  )}
                </div>
              )
            }}
          />

          {/* Threshold reference lines */}
          {refs && (
            <>
              <ReferenceLine y={refs.good} stroke="#16a34a" strokeDasharray="4 4" strokeOpacity={0.5} />
              <ReferenceLine y={refs.poor} stroke="#dc2626" strokeDasharray="4 4" strokeOpacity={0.5} />
            </>
          )}

          {/* Lab line */}
          {hasLabLine && (
            <Line
              type="monotone"
              dataKey="lab"
              stroke={LAB_COLOR}
              strokeWidth={2}
              dot={{ r: 3, fill: LAB_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          )}

          {/* CrUX real-user line (dashed) */}
          {hasCruxLine && (
            <Line
              type="monotone"
              dataKey="crux"
              stroke={CRUX_COLOR}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{ r: 3, fill: CRUX_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {activeTab === "inp" && (
        <p className="text-xs text-muted-foreground">
          INP não tem dados de laboratório — apenas dados reais de usuários via CrUX.
        </p>
      )}
      {activeTab === "seo" && (
        <p className="text-xs text-muted-foreground">
          Pontuação SEO do Lighthouse — meta: 90+.
        </p>
      )}
    </div>
  )
}
