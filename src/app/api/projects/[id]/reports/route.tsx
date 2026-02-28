import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { put } from "@vercel/blob"
import { db, projects, auditResults, users, reports, projectPages } from "@/lib/db"
import { eq, and, desc } from "drizzle-orm"
import { PLAN_LIMITS } from "@/lib/utils/plan-limits"
import { AuditReportPDF } from "@/lib/pdf/AuditReport"
import type { PageEntry } from "@/lib/pdf/AuditReport"
import type { Plan } from "@/lib/db/schema"

/** Resolve a possibly-relative URL to absolute using the incoming request's origin. */
function absoluteUrl(url: string | null | undefined, origin: string): string | null {
  if (!url) return null
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const origin = new URL(_req.url).origin
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Ownership check (org-aware)
  const ownershipFilter = orgId
    ? and(eq(projects.id, id), eq(projects.orgId, orgId))
    : and(eq(projects.id, id), eq(projects.userId, userId))

  const project = await db.query.projects.findFirst({
    where: ownershipFilter,
  })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Plan check + fetch branding
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      plan: true,
      agencyName: true,
      agencyContact: true,
      agencyAccentColor: true,
      agencyLogoUrl: true,
    },
  })
  const plan = (dbUser?.plan ?? "free") as Plan
  if (!PLAN_LIMITS[plan].pdfReports) {
    return NextResponse.json(
      { error: "PDF reports require Studio or Agência plan" },
      { status: 403 }
    )
  }

  // Fetch all pages for this project
  const allPages = await db.query.projectPages.findMany({
    where: eq(projectPages.projectId, project.id),
    orderBy: (pp, { asc }) => [asc(pp.createdAt)],
  })

  // Fetch latest audit per page and build page entries
  const pageEntries: PageEntry[] = []
  for (const page of allPages) {
    const audit = await db.query.auditResults.findFirst({
      where: and(
        eq(auditResults.projectId, project.id),
        eq(auditResults.pageId, page.id)
      ),
      orderBy: [desc(auditResults.createdAt)],
    })
    if (audit) {
      pageEntries.push({
        page: { url: page.url, label: page.label },
        audit: {
          perfScore: audit.perfScore,
          seoScore: audit.seoScore,
          accessibilityScore: audit.accessibilityScore,
          bestPracticesScore: audit.bestPracticesScore,
          lcp: audit.lcp,
          cls: audit.cls,
          inp: audit.inp,
          fcp: audit.fcp,
          ttfb: audit.ttfb,
          cruxLcp: audit.cruxLcp,
          cruxCls: audit.cruxCls,
          cruxInp: audit.cruxInp,
          cruxFcp: audit.cruxFcp,
          lighthouseRaw: audit.lighthouseRaw,
          aiActionPlan: audit.aiActionPlan,
          createdAt: audit.createdAt,
        },
      })
    }
  }

  if (pageEntries.length === 0) {
    return NextResponse.json({ error: "No audits found for this project" }, { status: 404 })
  }

  // Generate PDF
  const pdfBuffer = await renderToBuffer(
    <AuditReportPDF
      project={{
        name: project.name,
        url: project.url,
        strategy: project.strategy,
      }}
      pages={pageEntries}
      branding={
        plan === "agency"
          ? {
              agencyName: dbUser?.agencyName ?? null,
              agencyContact: dbUser?.agencyContact ?? null,
              accentColor: dbUser?.agencyAccentColor ?? null,
              agencyLogoUrl: absoluteUrl(dbUser?.agencyLogoUrl, origin),
            }
          : null
      }
    />
  )

  // If Blob token is configured, upload and save a persistent record.
  // Otherwise (local dev) stream the PDF directly as a download.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const firstAuditId = pageEntries[0]
      ? await db.query.auditResults.findFirst({
          where: and(
            eq(auditResults.projectId, project.id),
            eq(auditResults.pageId, allPages[0]?.id ?? "")
          ),
          orderBy: [desc(auditResults.createdAt)],
          columns: { id: true },
        }).then((r) => r?.id)
      : undefined

    const filename = `${project.id}/report-${Date.now()}.pdf`
    const { url } = await put(filename, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
    })

    if (firstAuditId) {
      await db.insert(reports).values({
        projectId: project.id,
        auditId: firstAuditId,
        blobUrl: url,
        createdBy: userId,
      })
    }

    return NextResponse.json({ url })
  }

  // No Blob token — stream PDF directly
  const safeName = project.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const hourPart = `${pad(now.getHours())}h${pad(now.getMinutes())}`
  const filename = `${safeName}-${datePart}-${hourPart}.pdf`
  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
