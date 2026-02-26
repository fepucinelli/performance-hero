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
import type { CrUXHistoryRecord } from "@/types"

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
  cruxHistory?: CrUXHistoryRecord | null
}

type Tab = "score" | "lcp" | "fcp" | "cls" | "inp"
type CrUXTab = "lcp" | "fcp" | "cls" | "inp"
type ViewMode = "audits" | "crux-history"

const TABS: { key: Tab; label: string }[] = [
  { key: "score", label: "Pontuação" },
  { key: "lcp", label: "LCP" },
  { key: "fcp", label: "FCP" },
  { key: "cls", label: "CLS" },
  { key: "inp", label: "INP" },
]

const CRUX_TABS: { key: CrUXTab; label: string }[] = [
  { key: "lcp", label: "LCP" },
  { key: "fcp", label: "FCP" },
  { key: "cls", label: "CLS" },
  { key: "inp", label: "INP" },
]

const REFS: Record<Tab, { good: number; poor: number } | null> = {
  score: { good: 90, poor: 50 },
  lcp: { good: THRESHOLDS.lcp.good, poor: THRESHOLDS.lcp.poor },
  fcp: { good: THRESHOLDS.fcp.good, poor: THRESHOLDS.fcp.poor },
  cls: { good: THRESHOLDS.cls.good, poor: THRESHOLDS.cls.poor },
  inp: { good: THRESHOLDS.inp.good, poor: THRESHOLDS.inp.poor },
}

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

function formatCrUXPeriodDate(p: CrUXHistoryRecord["collectionPeriods"][number]) {
  const d = p.lastDate
  return new Date(d.year, d.month - 1, d.day).toLocaleDateString("pt-BR", {
    month: "short",
    day: "numeric",
  })
}

function formatValue(tab: Tab, value: number) {
  if (tab === "score") return `${value}`
  if (tab === "cls") return value.toFixed(3)
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`
}

function formatCrUXValue(tab: CrUXTab, value: number) {
  if (tab === "cls") return value.toFixed(3)
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`
}

function yAxisFormatter(tab: Tab, v: number) {
  if (tab === "score") return String(v)
  if (tab === "cls") return v.toFixed(2)
  return v >= 1000 ? `${(v / 1000).toFixed(0)}s` : `${v}`
}

function cruxYAxisFormatter(tab: CrUXTab, v: number) {
  if (tab === "cls") return v.toFixed(2)
  return v >= 1000 ? `${(v / 1000).toFixed(0)}s` : `${v}`
}

function getCrUXHistoryP75s(history: CrUXHistoryRecord, tab: CrUXTab): (number | null)[] {
  const m = history.metrics
  switch (tab) {
    case "lcp": return m.largest_contentful_paint?.percentilesTimeseries.p75s ?? []
    case "fcp": return m.first_contentful_paint?.percentilesTimeseries.p75s ?? []
    case "cls": return m.cumulative_layout_shift?.percentilesTimeseries.p75s ?? []
    case "inp": return m.interaction_to_next_paint?.percentilesTimeseries.p75s ?? []
  }
}

export function ScoreHistoryChart({ data, cruxHistory }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("score")
  const [cruxTab, setCruxTab] = useState<CrUXTab>("lcp")
  const [viewMode, setViewMode] = useState<ViewMode>("audits")

  const hasCruxHistory = !!cruxHistory?.collectionPeriods?.length

  // ── Audits view ────────────────────────────────────────────────────────────

  const hasLabLine = activeTab !== "inp"
  const hasCruxLine = activeTab !== "score"

  const auditChartData = data.map((d, i) => {
    const lab: number | null =
      activeTab === "score" ? d.perfScore :
      activeTab === "lcp"   ? d.lcp :
      activeTab === "fcp"   ? d.fcp :
      activeTab === "cls"   ? d.cls :
      null

    const crux: number | null =
      activeTab === "lcp" ? d.cruxLcp :
      activeTab === "fcp" ? d.cruxFcp :
      activeTab === "cls" ? d.cruxCls :
      activeTab === "inp" ? d.cruxInp :
      null

    return { index: i, date: formatDate(d.createdAt), label: formatDateWithTime(d.createdAt), lab, crux }
  })

  const auditRefs = REFS[activeTab]

  // ── CrUX History view ──────────────────────────────────────────────────────

  const cruxHistoryData = hasCruxHistory
    ? cruxHistory!.collectionPeriods.map((period, i) => {
        const p75s = getCrUXHistoryP75s(cruxHistory!, cruxTab)
        return {
          index: i,
          date: formatCrUXPeriodDate(period),
          value: p75s[i] ?? null,
        }
      })
    : []

  const cruxHistoryRefs = REFS[cruxTab]

  if (data.length < 2 && !hasCruxHistory) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed bg-muted/30 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Execute ao menos 2 auditorias para ver a evolução da performance.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* View mode toggle */}
      {hasCruxHistory && (
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
          <button
            onClick={() => setViewMode("audits")}
            className={[
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              viewMode === "audits"
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            Auditorias
          </button>
          <button
            onClick={() => setViewMode("crux-history")}
            className={[
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              viewMode === "crux-history"
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            Usuários reais · 25 sem.
          </button>
        </div>
      )}

      {viewMode === "audits" ? (
        <>
          {data.length < 2 ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed bg-muted/30 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Execute ao menos 2 auditorias para ver a evolução da performance.
              </p>
            </div>
          ) : (
            <>
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
                <LineChart data={auditChartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="index"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(i: number) => auditChartData[i]?.date ?? ""}
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

                  {auditRefs && (
                    <>
                      <ReferenceLine y={auditRefs.good} stroke="#16a34a" strokeDasharray="4 4" strokeOpacity={0.5} />
                      <ReferenceLine y={auditRefs.poor} stroke="#dc2626" strokeDasharray="4 4" strokeOpacity={0.5} />
                    </>
                  )}

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
            </>
          )}
        </>
      ) : (
        /* CrUX History view — 25 weeks of weekly P75 real-user data */
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {CRUX_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setCruxTab(tab.key)}
                  className={[
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    cruxTab === tab.key
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3 w-3" style={{ color: CRUX_COLOR }} />
              <span style={{ color: CRUX_COLOR }} className="font-medium">P75 semanal (CrUX)</span>
            </span>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cruxHistoryData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="index"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval={4}
                tickFormatter={(i: number) => cruxHistoryData[i]?.date ?? ""}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={(v) => cruxYAxisFormatter(cruxTab, v)}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const point = payload[0]?.payload as { date: string; value: number | null } | undefined
                  const val = point?.value
                  return (
                    <div style={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", padding: "8px 10px" }}>
                      <p style={{ fontWeight: 600, marginBottom: 6 }}>{point?.date}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ display: "inline-block", width: 10, height: 3, borderRadius: 2, backgroundColor: CRUX_COLOR, flexShrink: 0 }} />
                        <span style={{ color: "hsl(var(--muted-foreground))" }}>P75 real</span>
                        <span style={{ fontWeight: 600, marginLeft: "auto", paddingLeft: 12 }}>
                          {val != null ? formatCrUXValue(cruxTab, val) : "—"}
                        </span>
                      </div>
                    </div>
                  )
                }}
              />

              {cruxHistoryRefs && (
                <>
                  <ReferenceLine y={cruxHistoryRefs.good} stroke="#16a34a" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <ReferenceLine y={cruxHistoryRefs.poor} stroke="#dc2626" strokeDasharray="4 4" strokeOpacity={0.5} />
                </>
              )}

              <Line
                type="monotone"
                dataKey="value"
                stroke={CRUX_COLOR}
                strokeWidth={2}
                dot={{ r: 3, fill: CRUX_COLOR, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>

          <p className="text-xs text-muted-foreground">
            Dados reais de usuários Chrome coletados pelo Google ao longo das últimas 25 semanas. Semanas sem dados suficientes aparecem como lacunas.
          </p>
        </>
      )}
    </div>
  )
}
