"use client"

import { useState } from "react"
import type { LighthouseResult } from "@/types"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilmstripFrame {
  timing: number  // ms from navigation start
  data: string    // data:image/jpeg;base64,...
}

interface FilmstripDetails {
  type: "filmstrip"
  scale: number
  items: FilmstripFrame[]
}

interface FinalScreenshotDetails {
  type: "screenshot"
  timing: number
  data: string
}

export interface FilmstripViewerProps {
  lighthouseRaw: unknown
  lcp?: number | null
  fcp?: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractFilmstrip(lighthouseRaw: unknown): { frames: FilmstripFrame[]; scale: number } | null {
  const lhr = lighthouseRaw as LighthouseResult | null
  const details = lhr?.audits?.["screenshot-thumbnails"]?.details as FilmstripDetails | undefined
  if (!details || details.type !== "filmstrip" || !details.items?.length) return null
  return { frames: details.items, scale: details.scale }
}

function extractFinalScreenshot(lighthouseRaw: unknown): string | null {
  const lhr = lighthouseRaw as LighthouseResult | null
  const details = lhr?.audits?.["final-screenshot"]?.details as FinalScreenshotDetails | undefined
  return details?.data ?? null
}

function formatTiming(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`
}

// Returns the index of the frame whose timing is closest to `targetMs`
function closestFrameIndex(frames: FilmstripFrame[], targetMs: number): number {
  let best = 0
  let bestDiff = Infinity
  frames.forEach((f, i) => {
    const diff = Math.abs(f.timing - targetMs)
    if (diff < bestDiff) { bestDiff = diff; best = i }
  })
  return best
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FilmstripViewer({ lighthouseRaw, lcp, fcp }: FilmstripViewerProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const filmstrip = extractFilmstrip(lighthouseRaw)
  const finalScreenshot = extractFinalScreenshot(lighthouseRaw)

  if (!filmstrip) return null

  const { frames, scale } = filmstrip

  const fcpInWindow = fcp != null && fcp <= scale
  const lcpInWindow = lcp != null && lcp <= scale

  const fcpFrameIndex = fcp != null ? closestFrameIndex(frames, fcp) : -1
  const lcpFrameIndex = lcp != null ? closestFrameIndex(frames, lcp) : -1

  // A frame can be both the FCP and LCP frame — LCP border wins
  function getFrameBorder(i: number) {
    if (lcpInWindow && i === lcpFrameIndex) return "border-orange-400"
    if (fcpInWindow && i === fcpFrameIndex) return "border-blue-400"
    return "border-border"
  }

  function handleFrameClick(i: number) {
    setExpandedIndex(expandedIndex === i ? null : i)
  }

  return (
    <div className="space-y-3">

      {/* Timeline bar with FCP / LCP markers */}
      <div className="relative mx-1 mt-6">
        {/* FCP label */}
        {fcpInWindow && (
          <div
            className="absolute -top-5 flex flex-col items-center"
            style={{ left: `${(fcp! / scale) * 100}%`, transform: "translateX(-50%)" }}
          >
            <span className="text-[10px] font-semibold text-blue-600">FCP</span>
          </div>
        )}
        {/* LCP label */}
        {lcpInWindow && (
          <div
            className="absolute -top-5 flex flex-col items-center"
            style={{ left: `${(lcp! / scale) * 100}%`, transform: "translateX(-50%)" }}
          >
            <span className="text-[10px] font-semibold text-orange-500">LCP</span>
          </div>
        )}

        {/* Track */}
        <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
          {/* FCP tick */}
          {fcpInWindow && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-blue-500"
              style={{ left: `${(fcp! / scale) * 100}%` }}
            />
          )}
          {/* LCP tick */}
          {lcpInWindow && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-orange-500"
              style={{ left: `${(lcp! / scale) * 100}%` }}
            />
          )}
        </div>

        {/* Start / end labels */}
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] text-muted-foreground">0</span>
          <span className="text-[10px] text-muted-foreground">{formatTiming(scale)}</span>
        </div>
      </div>

      {/* Frame strip */}
      <div className="flex gap-2 overflow-x-auto px-1 py-1.5">
        {frames.map((frame, i) => (
          <button
            key={i}
            onClick={() => handleFrameClick(i)}
            className="group flex shrink-0 flex-col items-center gap-1"
          >
            <div
              className={cn(
                "overflow-hidden rounded-md border-2 transition-all",
                getFrameBorder(i),
                expandedIndex === i
                  ? "ring-2 ring-primary ring-offset-1"
                  : "group-hover:brightness-90"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frame.data}
                alt={`Page at ${formatTiming(frame.timing)}`}
                className="block h-auto w-16"
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatTiming(frame.timing)}
            </span>
          </button>
        ))}

        {/* Final screenshot */}
        {finalScreenshot && (
          <button
            onClick={() => handleFrameClick(frames.length)}
            className="group flex shrink-0 flex-col items-center gap-1"
          >
            <div
              className={cn(
                "overflow-hidden rounded-md border-2 border-dashed border-border transition-all",
                expandedIndex === frames.length
                  ? "ring-2 ring-primary ring-offset-1"
                  : "group-hover:brightness-90"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={finalScreenshot}
                alt="Final page state"
                className="block h-auto w-16"
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">final</span>
          </button>
        )}
      </div>

      {/* Expanded view */}
      {expandedIndex !== null && (() => {
        const isFinal = expandedIndex === frames.length
        const frame = isFinal ? null : frames[expandedIndex]
        const imgSrc = isFinal ? finalScreenshot : frame?.data
        if (!imgSrc) return null

        const isLCP = !isFinal && lcpInWindow && expandedIndex === lcpFrameIndex
        const isFCP = !isFinal && fcpInWindow && expandedIndex === fcpFrameIndex

        return (
          <div className="flex items-start gap-4 rounded-xl border bg-muted/20 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt={isFinal ? "Final page state" : `Page at ${formatTiming(frame!.timing)}`}
              className="block h-auto w-28 shrink-0 rounded-md border"
            />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">
                {isFinal ? "Estado final" : formatTiming(frame!.timing)}
              </p>
              {isLCP && (
                <p className="text-xs text-orange-600 font-medium">
                  ← LCP acontece aqui ({formatTiming(lcp!)})
                </p>
              )}
              {isFCP && (
                <p className="text-xs text-blue-600 font-medium">
                  ← FCP acontece aqui ({formatTiming(fcp!)})
                </p>
              )}
              {!isFinal && lcp != null && !lcpInWindow && (
                <p className="text-xs text-muted-foreground">
                  LCP ({formatTiming(lcp!)}) ocorre após a janela de {formatTiming(scale)}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Clique novamente para fechar
              </p>
            </div>
          </div>
        )
      })()}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {fcpInWindow && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-blue-400" />
            FCP ({formatTiming(fcp!)})
          </span>
        )}
        {lcpInWindow && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-orange-400" />
            LCP ({formatTiming(lcp!)})
          </span>
        )}
        {lcp != null && !lcpInWindow && (
          <span className="flex items-center gap-1 text-orange-500">
            LCP ({formatTiming(lcp!)}) — além da janela de {formatTiming(scale)}
          </span>
        )}
      </div>
    </div>
  )
}
