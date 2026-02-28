export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import Link from "next/link"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db, projects, auditResults } from "@/lib/db"
import { eq, and, desc, inArray, isNull } from "drizzle-orm"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScoreGauge } from "@/components/metrics/ScoreGauge"
import { PlusCircle, Zap, Globe, ArrowRight } from "lucide-react"
import { formatDistanceToNow } from "@/lib/utils/date"
import { gradeMetric } from "@/lib/utils/metrics"
import { cn } from "@/lib/utils"
import { GRADE_STYLES, GRADE_LABELS } from "@/lib/utils/metrics"
import type { Grade } from "@/lib/db/schema"

export const metadata: Metadata = {
  title: "Dashboard",
}

export default async function DashboardPage() {
  const { userId, orgId } = await auth()
  const user = await currentUser()
  const firstName = user?.firstName ?? "there"

  // Fetch projects scoped to org (if active) or personal workspace
  const userProjects = userId
    ? await db.query.projects.findMany({
        where: orgId
          ? eq(projects.orgId, orgId)
          : and(eq(projects.userId, userId), isNull(projects.orgId)),
        orderBy: [desc(projects.createdAt)],
      })
    : []

  // Batch-fetch latest audit for each project
  const latestAudits =
    userProjects.length > 0
      ? await db.query.auditResults.findMany({
          where: inArray(
            auditResults.projectId,
            userProjects.map((p) => p.id)
          ),
          orderBy: [desc(auditResults.createdAt)],
        })
      : []

  // Build a map: projectId → latest audit
  const auditByProject = new Map<string, (typeof latestAudits)[0]>()
  for (const audit of latestAudits) {
    if (!auditByProject.has(audit.projectId)) {
      auditByProject.set(audit.projectId, audit)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Olá, {firstName} 👋</h1>
          <p className="text-muted-foreground text-sm">
            {userProjects.length > 0
              ? `Monitorando ${userProjects.length} projeto${userProjects.length === 1 ? "" : "s"}`
              : "Acompanhe os Core Web Vitals de todos os seus projetos."}
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar projeto
          </Link>
        </Button>
      </div>

      {userProjects.length === 0 ? (
        /* Empty state */
        <div className="rounded-xl border border-dashed bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-black text-white">
            <Zap className="h-6 w-6" />
          </div>
          <p className="font-semibold">Nenhum projeto ainda</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Adicione seu primeiro projeto para começar a monitorar os Core Web Vitals.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/projects/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar primeiro projeto
            </Link>
          </Button>
        </div>
      ) : (
        /* Project cards */
        <div className="grid gap-4 sm:grid-cols-2">
          {userProjects.map((project) => {
            const audit = auditByProject.get(project.id)
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{project.name}</p>
                    <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                      <Globe className="h-3 w-3 shrink-0" />
                      {new URL(project.url).hostname}
                    </p>
                  </div>
                  {audit ? (
                    <ScoreGauge
                      score={audit.perfScore ?? 0}
                      size="sm"
                      showLabel={false}
                    />
                  ) : (
                    <div className="text-muted-foreground rounded-full border p-1.5 text-xs">
                      —
                    </div>
                  )}
                </div>

                {audit ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(
                      [
                        { metric: "lcp" as const, value: audit.lcp },
                        { metric: "inp" as const, value: audit.inp },
                        { metric: "cls" as const, value: audit.cls },
                      ] as const
                    ).map(({ metric, value }) => {
                      if (!value) return null
                      const grade = gradeMetric(metric, value)
                      return (
                        <span
                          key={metric}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-xs font-medium",
                            GRADE_STYLES[grade].badge
                          )}
                        >
                          {metric.toUpperCase()} {GRADE_LABELS[grade as Grade]}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground mt-3 text-xs">
                    Sem auditoria — clique para executar
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">
                    {audit
                      ? `Última execução ${formatDistanceToNow(audit.createdAt)}`
                      : "Nunca auditado"}
                  </p>
                  <ArrowRight className="text-muted-foreground h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
