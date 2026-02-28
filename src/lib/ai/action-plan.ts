/**
 * AI-powered action plan generation using Claude.
 *
 * Model selection:
 *   - Starter → claude-haiku-4-5-20251001 (fast, cost-effective)
 *   - Pro / Agency → claude-sonnet-4-6 (higher quality, justifies paid plan)
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// Loose type covering the varying detail item shapes across Lighthouse audits
interface AuditDetailItem {
  url?: string
  label?: string
  entity?: string | { text: string }
  groupLabel?: string
  wastedBytes?: number
  wastedMs?: number
  totalBytes?: number
  transferSize?: number
  blockingTime?: number
  total?: number      // bootup-time: total JS execution ms
  duration?: number   // mainthread-work-breakdown: duration ms
}

interface AuditDetail {
  id: string
  title: string
  score: number  // 0–100
  displayValue?: string
  items: string[]  // pre-formatted bullet points
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMs(ms: number | null): string {
  if (ms === null) return "N/A"
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
}

function formatCls(cls: number | null): string {
  if (cls === null) return "N/A"
  return cls.toFixed(3)
}

function formatKB(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${bytes} B`
}

function extractStackPacks(lighthouseRaw: unknown): string {
  const raw = lighthouseRaw as LighthouseResult | null
  const packs = raw?.stackPacks
  if (!packs || packs.length === 0) return "não detectado"
  return packs.map((p) => p.title).join(", ")
}

/** Format a single audit detail item into a readable bullet point. */
function formatItem(item: AuditDetailItem): string | null {
  // Resolve the resource name
  const name =
    item.url ??
    (typeof item.entity === "string"
      ? item.entity
      : item.entity?.text) ??
    item.label ??
    item.groupLabel

  if (!name) return null

  const savings: string[] = []

  if (item.wastedMs !== undefined && item.wastedMs > 0)
    savings.push(`economia: ${Math.round(item.wastedMs)}ms`)
  else if (item.wastedBytes !== undefined && item.wastedBytes > 0)
    savings.push(`economia: ${formatKB(item.wastedBytes)}`)

  if (item.total !== undefined && item.total > 0)
    savings.push(`execução: ${Math.round(item.total)}ms`)
  else if (item.duration !== undefined && item.duration > 0)
    savings.push(`duração: ${Math.round(item.duration)}ms`)

  if (item.blockingTime !== undefined && item.blockingTime > 0)
    savings.push(`bloqueando: ${Math.round(item.blockingTime)}ms`)

  if (item.transferSize !== undefined && item.transferSize > 0 && savings.length === 0)
    savings.push(`tamanho: ${formatKB(item.transferSize)}`)
  else if (item.totalBytes !== undefined && item.totalBytes > 0 && savings.length === 0)
    savings.push(`tamanho: ${formatKB(item.totalBytes)}`)

  return savings.length > 0
    ? `${name} — ${savings.join(", ")}`
    : name
}

/**
 * Extracts the top failing performance audits with their specific resource
 * details (file names, bytes wasted, blocking times) so the AI can give
 * file-specific recommendations instead of generic advice.
 */
function extractFailedAuditDetails(lighthouseRaw: unknown): AuditDetail[] {
  const raw = lighthouseRaw as LighthouseResult | null
  if (!raw?.audits) return []

  const perfRefs = new Set(
    raw.categories.performance?.auditRefs?.map((r) => r.id) ?? []
  )

  return Object.values(raw.audits)
    .filter(
      (a) =>
        a.score !== null &&
        a.score < 0.9 &&
        perfRefs.has(a.id)
    )
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    .slice(0, 10)
    .map((audit) => {
      const details = audit.details as { items?: AuditDetailItem[] } | undefined
      const items = (details?.items ?? [])
        .slice(0, 4)
        .map(formatItem)
        .filter((s): s is string => s !== null)

      return {
        id: audit.id,
        title: audit.title,
        score: Math.round((audit.score ?? 0) * 100),
        displayValue: audit.displayValue,
        items,
      }
    })
    .filter((d) => d.items.length > 0 || d.displayValue)
}

function extractFailedSEODetails(lighthouseRaw: unknown): AuditDetail[] {
  const raw = lighthouseRaw as LighthouseResult | null
  if (!raw?.audits || !raw.categories.seo?.auditRefs) return []

  return raw.categories.seo.auditRefs
    .map((ref) => raw.audits[ref.id])
    .filter(
      (a): a is NonNullable<typeof a> =>
        !!a && a.score !== null && a.score < 1
    )
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    .slice(0, 5)
    .map((audit) => ({
      id: audit.id,
      title: audit.title,
      score: Math.round((audit.score ?? 0) * 100),
      displayValue: audit.displayValue,
      items: [],  // SEO audit items are DOM nodes — not useful raw
    }))
}

function formatAuditBlock(d: AuditDetail): string {
  const header = `[${d.id}] "${d.title}" (score: ${d.score}/100)${d.displayValue ? ` — ${d.displayValue}` : ""}`
  if (d.items.length === 0) return header
  return `${header}\n${d.items.map((i) => `  • ${i}`).join("\n")}`
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateAIActionPlan(
  url: string,
  metrics: MetricContext,
  lighthouseRaw: unknown,
  plan: "free" | "starter" | "pro" | "agency" = "starter"
): Promise<AIActionItem[] | null> {
  const client = getClient()
  if (!client) return null

  // Pro and Agency get Sonnet; Starter gets Haiku
  const model =
    plan === "pro" || plan === "agency"
      ? "claude-sonnet-4-6"
      : "claude-haiku-4-5-20251001"

  const stackPacks = extractStackPacks(lighthouseRaw)
  const perfAudits = extractFailedAuditDetails(lighthouseRaw)
  const seoAudits = extractFailedSEODetails(lighthouseRaw)

  const perfBlock =
    perfAudits.length > 0
      ? perfAudits.map(formatAuditBlock).join("\n\n")
      : "Nenhum problema crítico de performance detectado."

  const seoBlock =
    seoAudits.length > 0
      ? seoAudits.map(formatAuditBlock).join("\n")
      : "Nenhum problema crítico de SEO detectado."

  const systemPrompt = `Você é um especialista sênior em performance web e SEO técnico.
Sua tarefa é gerar um plano de ação altamente específico e acionável para um desenvolvedor.

Regras absolutas:
- SEMPRE cite os arquivos, URLs e recursos reais fornecidos nos dados do audit
- NUNCA dê conselhos genéricos como "otimize suas imagens" sem especificar quais
- Cada passo deve ser algo que o desenvolvedor pode executar agora
- Inclua comandos, configurações ou trechos de código quando relevante
- Escreva em português brasileiro, linguagem técnica e direta
- FORMATAÇÃO: envolva qualquer nome de arquivo, função, propriedade, comando ou trecho de código em backticks (\`assim\`). Exemplos: \`next.config.js\`, \`loading="lazy"\`, \`window.addEventListener\`, \`npm run build\``

  const userPrompt = `Analise os dados de performance abaixo e gere um plano de ação preciso e acionável.

URL auditada: ${url}
Stack detectada: ${stackPacks}

SCORES:
- Performance: ${metrics.perfScore ?? "N/A"}/100
- SEO: ${metrics.seoScore ?? "N/A"}/100 (meta: 90+)
- Acessibilidade: ${metrics.accessibilityScore ?? "N/A"}/100 (meta: 90+)

CORE WEB VITALS:
- LCP: ${formatMs(metrics.lcp)} (meta: < 2,5s)
- INP: ${formatMs(metrics.cruxInp)} (meta: < 200ms)
- CLS: ${formatCls(metrics.cls)} (meta: < 0,1)
- FCP: ${formatMs(metrics.fcp)} (meta: < 1,8s)
- TTFB: ${formatMs(metrics.ttfb)} (meta: < 800ms)

AUDITS DE PERFORMANCE COM PROBLEMAS (com recursos específicos):
${perfBlock}

AUDITS DE SEO COM PROBLEMAS:
${seoBlock}

INSTRUÇÕES:
- Gere entre 4 e 6 recomendações priorizadas por maior impacto
- Para cada recomendação, inclua "steps": array com 3 a 5 passos concretos de implementação
  - Os steps devem referenciar arquivos/URLs reais dos dados acima quando disponíveis
  - Podem incluir comandos de terminal, configurações ou trechos de código curtos
  - Use backticks para qualquer código inline: ex. "Adicione \`loading=\\"lazy\\"\` na tag \`<img>\`"
- O campo "action" deve resumir o problema e a solução em até 2 frases; use backticks para termos técnicos
- Se a stack foi detectada (ex: Next.js, WordPress), inclua stackTip com instrução específica e use backticks para nomes de arquivos/propriedades

Retorne APENAS um array JSON válido sem markdown, sem texto extra:
[
  {
    "title": "Título curto e direto (máximo 8 palavras)",
    "action": "Resumo do problema e solução — máximo 2 frases diretas",
    "steps": [
      "Passo 1 concreto — pode incluir comando ou código",
      "Passo 2 concreto",
      "Passo 3 concreto"
    ],
    "why": "Impacto mensurável para o negócio ou SEO — máximo 1 frase",
    "difficulty": "Fácil|Médio|Difícil",
    "stackTip": "Instrução específica para ${stackPacks !== "não detectado" ? stackPacks : "a stack detectada"} (omitir se stack não identificada)"
  }
]`

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 4096,
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
