import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { put } from "@vercel/blob"
import { db, projects, auditResults, users, reports } from "@/lib/db"
import { eq, and, desc } from "drizzle-orm"
import { PLAN_LIMITS } from "@/lib/utils/plan-limits"
import { AuditReportPDF } from "@/lib/pdf/AuditReport"
import type { Plan } from "@/lib/db/schema"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Ownership check
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, userId)),
  })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Plan check
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { plan: true },
  })
  const plan = (dbUser?.plan ?? "free") as Plan
  if (!PLAN_LIMITS[plan].pdfReports) {
    return NextResponse.json(
      { error: "PDF reports require Studio or Agência plan" },
      { status: 403 }
    )
  }

  // Latest audit
  const audit = await db.query.auditResults.findFirst({
    where: eq(auditResults.projectId, project.id),
    orderBy: [desc(auditResults.createdAt)],
  })
  if (!audit) {
    return NextResponse.json({ error: "No audit found for this project" }, { status: 404 })
  }

  // Generate PDF
  const pdfBuffer = await renderToBuffer(
    <AuditReportPDF
      project={{
        name: project.name,
        url: project.url,
        strategy: project.strategy,
      }}
      audit={{
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
      }}
      // branding: future Phase 3 white-label — omitted for now
    />
  )

  // If Blob token is configured, upload and save a persistent record.
  // Otherwise (local dev) stream the PDF directly as a download.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const filename = `${project.id}/${audit.id}.pdf`
    const { url } = await put(filename, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
    })

    await db.insert(reports).values({
      projectId: project.id,
      auditId: audit.id,
      blobUrl: url,
      createdBy: userId,
    })

    return NextResponse.json({ url })
  }

  // No Blob token — stream PDF directly
  const safeName = project.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10) // YYYY-MM-DD
  const hourPart = now.toISOString().slice(11, 13) + "h" + now.toISOString().slice(14, 16) // HHhMM
  const filename = `${safeName}-${datePart}-${hourPart}.pdf`
  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
