/**
 * Template for src/lib/ai/prompts.ts (the gitignored file with real prompts).
 *
 * After cloning, run:
 *   pnpm prepare:prompts
 * Then replace the placeholder strings in src/lib/ai/prompts.ts with your
 * actual prompt content.
 *
 * THIS FILE IS COMMITTED as a reference — do not add real prompt content here.
 */

export function getSystemPrompt(): string {
  return `You are a senior web performance and SEO expert. [Add your system prompt here]`
}

export function buildUserPrompt(params: {
  url: string
  stackPacks: string
  metrics: {
    perfScore: number | null
    seoScore: number | null
    accessibilityScore: number | null
    lcp: number | null
    cruxInp: number | null
    cls: number | null
    fcp: number | null
    ttfb: number | null
  }
  perfBlock: string
  seoBlock: string
}): string {
  const { url, stackPacks, perfBlock, seoBlock } = params
  return `Analyze the audit data for ${url} (stack: ${stackPacks}) and return a JSON action plan.

Performance issues:
${perfBlock}

SEO issues:
${seoBlock}

[Add your full user prompt here. Return a JSON array of action items.]`
}
