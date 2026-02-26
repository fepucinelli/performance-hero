// Public share page — no auth required.
// Anyone with the link can view a read-only report.

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { db, auditResults, projects } from "@/lib/db"
import { eq } from "drizzle-orm"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MetricCard } from "@/components/metrics/MetricCard"
import { ActionPlan } from "@/components/metrics/ActionPlan"
import { AuditList } from "@/components/metrics/AuditList"
import { SEOAuditList } from "@/components/metrics/SEOAuditList"
import { SiteHealthCard } from "@/components/metrics/SiteHealthCard"
import { Globe, Zap } from "lucide-react"
import { formatDate } from "@/lib/utils/date"
import type { AIActionItem } from "@/types"

// Cache shared reports for 5 minutes — they're immutable after creation
export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const audit = await getAuditByToken(token)
  if (!audit) return { title: "Report not found" }

  return {
    title: `Performance report — ${audit.project.name}`,
    description: `Core Web Vitals report for ${audit.project.url}. Performance score: ${audit.perfScore}/100.`,
  }
}

async function getAuditByToken(token: string) {
  return db.query.auditResults.findFirst({
    where: eq(auditResults.shareToken, token),
    with: {
      project: {
        columns: { name: true, url: true, strategy: true },
      },
    },
  })
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const audit = await getAuditByToken(token)
  if (!audit) notFound()

  const { project } = audit

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold">
            <Zap className="h-4 w-4 text-amber-500" />
            PerfAlly
          </Link>
          <Button size="sm" asChild>
            <Link href="/sign-up">Analise seu site gratuitamente →</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {/* Report header */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold">{project.name}</h1>
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
              >
                <Globe className="h-3.5 w-3.5" />
                {new URL(project.url).hostname}
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">
                {project.strategy === "mobile" ? "📱 Mobile" : "🖥️ Desktop"}
              </Badge>
              <p className="text-muted-foreground text-xs">
                {formatDate(audit.createdAt)}
              </p>
            </div>
          </div>

        </div>

        {/* Site Health */}
        <SiteHealthCard
          perfScore={audit.perfScore ?? 0}
          seoScore={audit.seoScore ?? null}
          accessibilityScore={audit.accessibilityScore ?? null}
          bestPracticesScore={audit.bestPracticesScore ?? null}
          lighthouseVersion={audit.psiApiVersion}
          auditedAt={audit.createdAt}
        />

        {/* Core Web Vitals */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Core Web Vitals
          </h2>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard metric="lcp" value={audit.lcp} fieldValue={audit.cruxLcp} />
            <MetricCard metric="inp" value={audit.inp} fieldValue={audit.cruxInp} />
            <MetricCard metric="cls" value={audit.cls} fieldValue={audit.cruxCls} />
          </div>
        </section>

        {/* Diagnostics */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Diagnósticos
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard metric="fcp" value={audit.fcp} fieldValue={audit.cruxFcp} />
            <MetricCard metric="ttfb" value={audit.ttfb} />
          </div>
        </section>

        <Separator />

        {/* Action Plan */}
        <section>
          <h2 className="mb-1 text-base font-semibold">Plano de Ação</h2>
          <p className="text-muted-foreground mb-3 text-sm">
            Problemas priorizados — corrija nessa ordem para o maior ganho de performance.
          </p>
          <ActionPlan
            lighthouseRaw={audit.lighthouseRaw}
            aiPlan={audit.aiActionPlan as AIActionItem[] | null}
          />
        </section>

        <Separator />

        {/* Full audit */}
        <AuditList lighthouseRaw={audit.lighthouseRaw} />

        {/* SEO + Accessibility */}
        <section>
          <h2 className="mb-3 text-base font-semibold">SEO e Acessibilidade</h2>
          <SEOAuditList lighthouseRaw={audit.lighthouseRaw} />
        </section>

        {/* CTA */}
        <div className="rounded-xl border bg-black p-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black">
            <Zap className="h-5 w-5" />
          </div>
          <p className="font-semibold">Analise seu próprio site gratuitamente</p>
          <p className="mt-1 text-sm text-gray-400">
            Receba um relatório de performance em linguagem simples com um plano de ação priorizado.
            Sem configuração, sem jargão.
          </p>
          <Button className="mt-4 bg-white text-black hover:bg-gray-100" asChild>
            <Link href="/sign-up">Começar gratuitamente →</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
