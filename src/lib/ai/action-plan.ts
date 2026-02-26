/**
 * AI-powered action plan generation using Claude Haiku.
 *
 * Called after each audit for paid users (within their monthly quota).
 * Returns null on any failure — caller always falls back to static plan.
 */
import Anthropic from "@anthropic-ai/sdk"
import { env } from "@/env"
import type { AIActionItem } from "@/types"
import type { LighthouseResult } from "@/types"

let _client: Anthropic | null = null

function getClient(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null
  if (!_client) {
    _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  }
  return _client
}

interface MetricContext {
  perfScore: number | null
  lcp: number | null
  cls: number | null
  fcp: number | null
  ttfb: number | null
  cruxInp: number | null
  seoScore: number | null
  accessibilityScore: number | null
}

function formatMs(ms: number | null): string {
  if (ms === null) return "N/A"
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
}

function formatCls(cls: number | null): string {
  if (cls === null) return "N/A"
  return cls.toFixed(3)
}

function extractStackPacks(lighthouseRaw: unknown): string {
  const raw = lighthouseRaw as LighthouseResult | null
  const packs = raw?.stackPacks
  if (!packs || packs.length === 0) return "não detectado"
  return packs.map((p) => p.title).join(", ")
}

function extractTopFailedAudits(lighthouseRaw: unknown): string[] {
  const raw = lighthouseRaw as LighthouseResult | null
  if (!raw?.audits) return []

  return Object.values(raw.audits)
    .filter(
      (a) =>
        a.score !== null &&
        a.score < 0.9 &&
        a.numericValue !== undefined &&
        a.numericValue > 0
    )
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    .slice(0, 8)
    .map((a) => a.id)
}

function extractTopFailedSEOAudits(lighthouseRaw: unknown): string[] {
  const raw = lighthouseRaw as LighthouseResult | null
  if (!raw?.audits || !raw.categories.seo?.auditRefs) return []

  return raw.categories.seo.auditRefs
    .map((ref) => raw.audits[ref.id])
    .filter((a): a is NonNullable<typeof a> => !!a && a.score !== null && a.score < 1)
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    .slice(0, 5)
    .map((a) => a.id)
}

export async function generateAIActionPlan(
  url: string,
  metrics: MetricContext,
  lighthouseRaw: unknown
): Promise<AIActionItem[] | null> {
  const client = getClient()
  if (!client) return null

  const stackPacks = extractStackPacks(lighthouseRaw)
  const topFailedAudits = extractTopFailedAudits(lighthouseRaw)
  const topFailedSEOAudits = extractTopFailedSEOAudits(lighthouseRaw)

  const systemPrompt = `Você é um especialista mundial em performance web e SEO com profundo conhecimento em Core Web Vitals (LCP, CLS, INP, FCP, TTFB), SEO técnico e acessibilidade. Você ajuda desenvolvedores e agências a identificar e corrigir problemas para seus clientes em linguagem clara e objetiva.`

  const userPrompt = `Analise o relatório de performance, SEO e acessibilidade abaixo e gere um plano de ação priorizado.

URL: ${url}
Stack detectada pelo Lighthouse: ${stackPacks}

Pontuações:
- Performance: ${metrics.perfScore ?? "N/A"}/100
- SEO: ${metrics.seoScore ?? "N/A"}/100 — meta: 90+
- Acessibilidade: ${metrics.accessibilityScore ?? "N/A"}/100 — meta: 90+

Métricas de Performance:
- LCP (Maior Elemento Visível): ${formatMs(metrics.lcp)} — meta: < 2,5s
- INP (Interação → Pintura, dados reais): ${formatMs(metrics.cruxInp)} — meta: < 200ms
- CLS (Mudança de Layout): ${formatCls(metrics.cls)} — meta: < 0,1
- FCP (Primeira Pintura de Conteúdo): ${formatMs(metrics.fcp)} — meta: < 1,8s
- TTFB (Tempo até Primeiro Byte): ${formatMs(metrics.ttfb)} — meta: < 800ms

Principais problemas de performance: ${topFailedAudits.length > 0 ? topFailedAudits.join(", ") : "nenhum crítico identificado"}
Principais problemas de SEO: ${topFailedSEOAudits.length > 0 ? topFailedSEOAudits.join(", ") : "nenhum crítico identificado"}

Instruções:
- Escreva em português brasileiro
- Use linguagem direta para desenvolvedores e agências — pode usar termos técnicos mas seja objetivo
- Gere entre 3 e 6 recomendações priorizadas pelo maior impacto (inclua problemas de SEO se pontuação < 90)
- Cada recomendação deve ter no máximo 60 palavras no campo "action"
- Se a stack foi detectada (ex: Next.js, WordPress), inclua uma dica específica para essa tecnologia no campo "stackTip"
- Foque nos problemas reais detectados, não em conselhos genéricos

Retorne APENAS um array JSON válido com este formato exato (sem markdown, sem texto extra):
[
  {
    "title": "Título curto e direto",
    "action": "O que fazer — instrução clara e específica",
    "why": "Por que isso importa para o negócio — impacto em conversão ou SEO",
    "difficulty": "Fácil|Médio|Difícil",
    "stackTip": "Dica específica para a stack detectada (omitir se stack não identificada)"
  }
]`

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    })

    const text =
      message.content[0]?.type === "text" ? message.content[0].text : ""

    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return null

    const parsed = JSON.parse(match[0]) as AIActionItem[]
    if (!Array.isArray(parsed) || parsed.length === 0) return null

    return parsed
  } catch {
    return null
  }
}
