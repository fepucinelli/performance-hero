export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { db, projects, auditResults, users, projectPages } from "@/lib/db"
import { eq, and, desc, gte, isNull } from "drizzle-orm"
import { sql } from "drizzle-orm"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MetricCard } from "@/components/metrics/MetricCard"
import { ActionPlan } from "@/components/metrics/ActionPlan"
import { AuditList } from "@/components/metrics/AuditList"
import { SEOAuditList } from "@/components/metrics/SEOAuditList"
import { SiteHealthCard } from "@/components/metrics/SiteHealthCard"
import { RunAuditButton } from "@/components/metrics/RunAuditButton"
import { ChevronLeft, Share2, Globe } from "lucide-react"
import { DownloadPDFButton } from "@/components/projects/DownloadPDFButton"
import { ScoreHistoryChart } from "@/components/metrics/ScoreHistoryChart"
import { ScheduleSelector } from "@/components/projects/ScheduleSelector"
import { AlertThresholds } from "@/components/projects/AlertThresholds"
import { PageTabs } from "@/components/projects/PageTabs"
import { PLAN_LIMITS } from "@/lib/utils/plan-limits"
import { getMonthlyRunCount } from "@/app/actions/projects"
import type { Plan } from "@/lib/db/schema"
import type { AIActionItem, CrUXHistoryRecord } from "@/types"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return {}

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, userId)),
    columns: { name: true },
  })

  return { title: project?.name ?? "Project" }
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { id } = await params
  const { page: pageParam } = await searchParams
  const { userId } = await auth()
  if (!userId) notFound()

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, userId)),
  })
  if (!project) notFound()

  // User plan — needed to determine history window, run limits, and page limits
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { plan: true },
  })
  const userPlan: Plan = (dbUser?.plan ?? "free") as Plan
  const planLimits = PLAN_LIMITS[userPlan]

  // Fetch all pages for this project
  let pages = await db.query.projectPages.findMany({
    where: eq(projectPages.projectId, project.id),
    orderBy: (pp, { asc }) => [asc(pp.createdAt)],
  })

  // Auto-migration: if no pages exist yet, create default from project.url
  // and tag all existing auditResults that have no pageId
  if (pages.length === 0) {
    const [newPage] = await db
      .insert(projectPages)
      .values({ projectId: project.id, url: project.url })
      .returning()

    if (newPage) {
      // Tag existing audit results
      await db
        .update(auditResults)
        .set({ pageId: newPage.id })
        .where(
          and(
            eq(auditResults.projectId, project.id),
            isNull(auditResults.pageId)
          )
        )

      pages = [newPage]
    }
  }

  // Resolve selected page — from ?page= param, else first
  const selectedPage =
    pages.find((p) => p.id === pageParam) ?? pages[0]

  if (!selectedPage) notFound()

  // History start date based on plan's historyDays limit
  const historyStart = new Date()
  historyStart.setDate(historyStart.getDate() - planLimits.historyDays)

  // Fetch latest audit, history, and monthly run count in parallel
  const [latestAudit, historyDesc, monthlyRunCount] = await Promise.all([
    db.query.auditResults.findFirst({
      where: and(
        eq(auditResults.projectId, project.id),
        eq(auditResults.pageId, selectedPage.id)
      ),
      orderBy: [desc(auditResults.createdAt)],
    }),
    db.query.auditResults.findMany({
      where: and(
        eq(auditResults.projectId, project.id),
        eq(auditResults.pageId, selectedPage.id),
        gte(auditResults.createdAt, historyStart),
      ),
      orderBy: [desc(auditResults.createdAt)],
      limit: 500,
      columns: {
        id: true,
        perfScore: true,
        seoScore: true,
        lcp: true,
        cls: true,
        inp: true,
        fcp: true,
        cruxLcp: true,
        cruxCls: true,
        cruxInp: true,
        cruxFcp: true,
        createdAt: true,
      },
    }),
    planLimits.manualRunsPerMonth !== -1
      ? getMonthlyRunCount(userId)
      : Promise.resolve(-1),
  ])
  const history = [...historyDesc].reverse()

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" asChild>
            <Link href="/dashboard">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Todos os projetos
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <div className="text-muted-foreground flex items-center gap-3 text-sm">
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              {new URL(project.url).hostname}
            </a>
            <Badge variant="secondary" className="text-xs">
              {project.strategy === "mobile" ? "📱 Mobile" : "🖥️ Desktop"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DownloadPDFButton
            projectId={project.id}
            canGeneratePDF={planLimits.pdfReports}
          />
          <RunAuditButton
            projectId={project.id}
            pageId={selectedPage.id}
            runsUsed={monthlyRunCount === -1 ? undefined : monthlyRunCount}
            maxRuns={planLimits.manualRunsPerMonth === -1 ? undefined : planLimits.manualRunsPerMonth}
          />
        </div>
      </div>

      {/* Page tabs */}
      <PageTabs
        pages={pages}
        selectedPageId={selectedPage.id}
        projectId={project.id}
        maxPages={planLimits.maxPagesPerProject}
        userPlan={userPlan}
      />

      {latestAudit ? (
        <>
          {/* Site Health — composite 4-category score */}
          <SiteHealthCard
            perfScore={latestAudit.perfScore ?? 0}
            seoScore={latestAudit.seoScore ?? null}
            accessibilityScore={latestAudit.accessibilityScore ?? null}
            bestPracticesScore={latestAudit.bestPracticesScore ?? null}
            lighthouseVersion={latestAudit.psiApiVersion}
            auditedAt={latestAudit.createdAt}
            shareSlot={
              <Button variant="outline" size="sm" asChild>
                <Link href={`/share/${latestAudit.shareToken}`} target="_blank">
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  Compartilhar
                </Link>
              </Button>
            }
          />

          {/* Run history dots — newest on the right, up to 10 */}
          {historyDesc.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Execuções recentes:</span>
              <div className="flex gap-1.5">
                {[...historyDesc].reverse().slice(-10).map((run) => (
                  <div
                    key={run.id}
                    title={`Score: ${run.perfScore}`}
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        (run.perfScore ?? 0) >= 90
                          ? "#16a34a"
                          : (run.perfScore ?? 0) >= 50
                            ? "#d97706"
                            : "#dc2626",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Core Web Vitals */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Core Web Vitals
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                metric="lcp"
                value={latestAudit.lcp}
                fieldValue={latestAudit.cruxLcp}
              />
              <MetricCard
                metric="inp"
                value={latestAudit.inp}
                fieldValue={latestAudit.cruxInp}
              />
              <MetricCard
                metric="cls"
                value={latestAudit.cls}
                fieldValue={latestAudit.cruxCls}
              />
            </div>
          </section>

          {/* Diagnostic metrics */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Diagnósticos
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard metric="fcp" value={latestAudit.fcp} fieldValue={latestAudit.cruxFcp} />
              <MetricCard metric="ttfb" value={latestAudit.ttfb} />
            </div>
          </section>

          <Separator />

          {/* Performance Trend */}
          <section>
            <h2 className="mb-3 text-base font-semibold">Evolução da Performance</h2>
            <ScoreHistoryChart
              data={history}
              cruxHistory={latestAudit.cruxHistoryRaw as CrUXHistoryRecord | null}
            />
          </section>

          <Separator />

          {/* Action Plan */}
          <section>
            <h2 className="mb-1 text-base font-semibold">Plano de Ação</h2>
            <p className="text-muted-foreground mb-3 text-sm">
              Corrija esses problemas na ordem — do maior para o menor impacto.
            </p>
            <ActionPlan
              lighthouseRaw={latestAudit.lighthouseRaw}
              aiPlan={latestAudit.aiActionPlan as AIActionItem[] | null}
            />
          </section>

          <Separator />

          {/* Full audit */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              Auditoria Completa do Lighthouse
            </h2>
            <AuditList lighthouseRaw={latestAudit.lighthouseRaw} />
          </section>

          {/* SEO + Accessibility */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              SEO e Acessibilidade
            </h2>
            <SEOAuditList lighthouseRaw={latestAudit.lighthouseRaw} />
          </section>

          <Separator />

          {/* Monitoring schedule */}
          <section>
            <h2 className="mb-1 text-base font-semibold">Monitoramento</h2>
            <p className="text-muted-foreground mb-3 text-sm">
              Re-execute esta auditoria automaticamente em um agendamento.
            </p>
            <ScheduleSelector
              projectId={project.id}
              currentSchedule={project.schedule}
              userPlan={userPlan}
            />
          </section>

          <Separator />

          {/* Alert thresholds */}
          <section>
            <h2 className="mb-1 text-base font-semibold">Alertas</h2>
            <AlertThresholds
              projectId={project.id}
              initialLcp={project.alertLcp ?? null}
              initialCls={project.alertCls ?? null}
              initialInp={project.alertInp ?? null}
              hasEmailAlerts={planLimits.emailAlerts}
            />
          </section>
        </>
      ) : (
        /* No audit yet */
        <div className="space-y-6">
          <div className="rounded-xl border border-dashed bg-white p-10 text-center">
            <p className="font-medium">Nenhuma auditoria ainda</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Clique em &ldquo;Executar auditoria&rdquo; para analisar os Core Web
              Vitals deste site. Leva cerca de 10 segundos.
            </p>
          </div>

          <Separator />

          <section>
            <h2 className="mb-1 text-base font-semibold">Monitoramento</h2>
            <p className="text-muted-foreground mb-3 text-sm">
              Re-execute esta auditoria automaticamente em um agendamento.
            </p>
            <ScheduleSelector
              projectId={project.id}
              currentSchedule={project.schedule}
              userPlan={userPlan}
            />
          </section>

          <Separator />

          <section>
            <h2 className="mb-1 text-base font-semibold">Alertas</h2>
            <AlertThresholds
              projectId={project.id}
              initialLcp={project.alertLcp ?? null}
              initialCls={project.alertCls ?? null}
              initialInp={project.alertInp ?? null}
              hasEmailAlerts={planLimits.emailAlerts}
            />
          </section>
        </div>
      )}
    </div>
  )
}
