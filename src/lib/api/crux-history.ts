/**
 * Chrome UX Report History API client.
 *
 * Returns 25 weeks of weekly P75 real-user data for LCP, CLS, INP, FCP.
 * Docs: https://developer.chrome.com/docs/crux/history-api/
 *
 * Requires the "Chrome UX Report API" enabled in Google Cloud Console
 * (same project as PageSpeed Insights). Free quota: 150 req/day.
 */
import { env } from "@/env"
import type { CrUXHistoryRecord } from "@/types"

const CRUX_HISTORY_ENDPOINT =
  "https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord"

const METRICS = [
  "largest_contentful_paint",
  "cumulative_layout_shift",
  "interaction_to_next_paint",
  "first_contentful_paint",
]

type CrUXHistoryResponse = {
  record: {
    key: Record<string, string>
    collectionPeriods: CrUXHistoryRecord["collectionPeriods"]
    metrics: CrUXHistoryRecord["metrics"]
  }
}

async function query(body: Record<string, unknown>): Promise<CrUXHistoryRecord | null> {
  const url = env.GOOGLE_API_KEY
    ? `${CRUX_HISTORY_ENDPOINT}?key=${env.GOOGLE_API_KEY}`
    : CRUX_HISTORY_ENDPOINT

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, metrics: METRICS }),
    cache: "no-store",
  })

  if (!res.ok) return null

  const data = (await res.json()) as CrUXHistoryResponse
  const record = data.record
  if (!record?.collectionPeriods?.length) return null

  return {
    collectionPeriods: record.collectionPeriods,
    metrics: record.metrics,
  }
}

/**
 * Fetch 25-week CrUX History for a URL.
 * Tries page-level first, falls back to origin-level.
 * Returns null when the URL/origin isn't in the CrUX dataset or the API key
 * doesn't have the Chrome UX Report API enabled.
 */
export async function fetchCrUXHistory(pageUrl: string): Promise<CrUXHistoryRecord | null> {
  try {
    // Try page-level first
    const pageResult = await query({ url: pageUrl })
    if (pageResult) return pageResult

    // Fall back to origin-level
    const origin = new URL(pageUrl).origin
    return await query({ origin })
  } catch {
    return null
  }
}
