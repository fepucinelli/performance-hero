# Phase 3 — Agency

**Goal:** PDF reports, team accounts, white-label. Unlock agency ($99/month) tier.
**Duration:** 2–3 weeks
**Depends on:** Phase 2 with paying customers

---

## New Features

1. PDF report generation with @react-pdf/renderer
2. White-label: custom logo, color, footer
3. Multi-user teams via Clerk Organizations
4. Project tagging / grouping by client
5. Weekly digest email for all projects
6. Agency plan ($99/month)

---

## Steps

### 1. PDF Report Generation

```bash
pnpm add @react-pdf/renderer
```

**Why @react-pdf/renderer:** Works in Vercel Functions without Chromium. Build PDF layouts with React components. Trade-off: limited CSS, no web fonts by default, needs font registration.

**PDF Architecture:**
```
POST /api/projects/[id]/reports
  → Fetch latest audit result from DB
  → Generate PDF via renderToBuffer()
  → Upload to Vercel Blob
  → Save report record to DB (blob URL)
  → Return signed download URL
```

**PDF Component structure:**
```tsx
// src/lib/pdf/AuditReport.tsx
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer"

// Register font (use a Google Font URL or bundle the font file)
Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2" },
    { src: "...", fontWeight: 700 },
  ],
})

interface ReportProps {
  project: Project
  audit: AuditResult
  actionPlan: ActionItem[]
  branding?: {
    logoUrl?: string
    accentColor?: string
    agencyName?: string
    agencyContact?: string
  }
}

export function AuditReportPDF({ project, audit, actionPlan, branding }: ReportProps) {
  const accent = branding?.accentColor ?? "#2563eb"

  return (
    <Document title={`Performance Report — ${project.name}`}>
      {/* Cover page */}
      <Page size="A4" style={styles.page}>
        <CoverPage project={project} audit={audit} accent={accent} branding={branding} />
      </Page>

      {/* Executive Summary */}
      <Page size="A4" style={styles.page}>
        <Header branding={branding} />
        <ExecutiveSummary audit={audit} />
        <MetricsGrid audit={audit} />
        <Footer branding={branding} pageNumber={2} />
      </Page>

      {/* Action Plan */}
      <Page size="A4" style={styles.page}>
        <Header branding={branding} />
        <ActionPlanSection items={actionPlan} />
        <Footer branding={branding} pageNumber={3} />
      </Page>
    </Document>
  )
}
```

**Generate and store:**
```typescript
// src/app/api/projects/[id]/reports/route.ts
import { renderToBuffer } from "@react-pdf/renderer"
import { put } from "@vercel/blob"

export async function POST(req, { params }) {
  // Auth + ownership check...

  const audit = await getLatestAudit(params.id)
  const branding = await getProjectBranding(params.id)
  const actionPlan = getActionPlan(audit.lighthouseRaw)

  const pdfBuffer = await renderToBuffer(
    <AuditReportPDF project={project} audit={audit} actionPlan={actionPlan} branding={branding} />
  )

  const { url } = await put(
    `reports/${project.id}/${audit.id}.pdf`,
    pdfBuffer,
    { access: "public", contentType: "application/pdf" }
  )

  await db.insert(reports).values({
    projectId: project.id,
    auditId: audit.id,
    blobUrl: url,
    createdBy: userId,
  })

  return Response.json({ url })
}
```

**Add reports table to schema:**
```typescript
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  auditId: uuid("audit_id").references(() => auditResults.id),
  blobUrl: text("blob_url").notNull(),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamptz("created_at").default(sql`NOW()`),
})
```

### 2. White-Label Branding

Add branding settings table:
```typescript
export const projectBranding = pgTable("project_branding", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  // Applies to all projects for this user / org
  logoUrl: text("logo_url"),          // Vercel Blob URL
  accentColor: text("accent_color").default("#2563eb"),
  agencyName: text("agency_name"),
  agencyContact: text("agency_contact"),
  createdAt: timestamptz("created_at").default(sql`NOW()`),
})
```

**Settings UI** (`/settings/branding`):
- Upload logo (max 2MB, PNG/SVG preferred)
- Color picker for accent color
- Agency name + contact info text fields
- PDF preview button (generates a sample PDF)

**Logo upload:**
```typescript
// src/app/api/branding/logo/route.ts
import { put } from "@vercel/blob"

export async function POST(req) {
  const form = await req.formData()
  const file = form.get("file") as File

  const { url } = await put(`logos/${userId}-${Date.now()}.png`, file, {
    access: "public",
  })

  await db.update(projectBranding)
    .set({ logoUrl: url })
    .where(eq(projectBranding.userId, userId))

  return Response.json({ url })
}
```

### 3. Multi-User Teams (Clerk Organizations)

**Enable Organizations in Clerk dashboard.**

Clerk Organizations handle:
- Creating an org (account owner becomes admin)
- Inviting members by email
- Roles (admin, member)
- Billing tied to org (not individual users)

**Schema changes:**
```typescript
// Add org_id to users (populated when user joins an org)
// Add org_id to projects (projects belong to org, not individual user)

export const projects = pgTable("projects", {
  // ...existing fields...
  orgId: text("org_id"),   // Clerk Org ID — null for personal accounts
})
```

**Middleware update:**
```typescript
// Projects owned by user OR user's org
const projects = await db.query.projects.findMany({
  where: or(
    eq(projects.userId, userId),
    eq(projects.orgId, orgId)  // orgId from Clerk auth()
  )
})
```

**Team settings page** (`/settings/team`):
- Current members list
- Invite by email (triggers Clerk invitation)
- Remove member
- Transfer ownership

**Note:** For simplicity in Phase 3, limit team features to Agency plan only. Don't over-engineer permissions — admin/member is sufficient.

### 4. Project Tagging

```typescript
// Add to projects table
tags: text("tags").array().default([]),
```

Tags are free-form strings (e.g., "client: Acme Corp", "production", "staging").

**UI:** Tag input on project settings. Filter projects by tag on dashboard.

```
Dashboard filter bar:
[All] [client: Acme] [client: Beta Co.] [staging] [+ Add filter]
```

### 5. Weekly Digest Email

Vercel Cron: every Monday at 8am

```typescript
// src/app/api/cron/weekly-digest/route.ts
// For each Pro/Agency user:
//   1. Get all their projects
//   2. Get latest audit for each
//   3. Compare to audit from 7 days ago
//   4. Send digest email: summary table + biggest improvements/regressions
```

**Digest email structure:**
```
Performance Weekly: 5 sites monitored

IMPROVED ↑
  acme.com       72 → 85    +13 points

STABLE →
  beta.com       68           no change

DEGRADED ↓
  gamma.com      91 → 76    -15 points ⚠️

View all reports →
```

Add `digest_enabled` boolean to users table (default true, users can unsubscribe).

### 6. Agency Plan Setup

**Stripe:**
- Product: "PerfAlly Agency" — $99/month
- Store `STRIPE_AGENCY_PRICE_ID` in env

**Plan enforcement:**
- Clerk Organizations required for Agency (team features)
- 100 projects per org
- White-label PDF: plan check before generating
- Weekly digest: all paid plans

---

## Reports List Page

`/reports`:
- Table of generated reports with download links
- Filter by project
- "Generate new report" button per project
- Reports expire from Blob storage after 90 days (Pro) / 1 year (Agency)

---

## PDF Report Content

A complete report should include:

**Page 1 — Cover**
- Agency logo (if white-label)
- Site name + URL
- Audit date + strategy
- Overall grade (A/B/C/D/F)

**Page 2 — Executive Summary**
- Performance score gauge
- CWV at a glance (colored badges)
- "Key Finding" (worst metric, plain English)
- "Quick Win" (easiest fix with highest impact)

**Page 3 — Detailed Metrics**
- Each CWV: value, grade, explanation, benchmark context
- Field data vs Lab data comparison (if CrUX available)

**Page 4 — Action Plan**
- Numbered list of issues (high → medium → low)
- Each: title, plain-English explanation, estimated effort (Low/Med/High)

**Page 5 — About This Report** (optional)
- Methodology note (PSI API, Lighthouse version)
- "Generated by PerfAlly" (or white-labeled)

---

## Definition of Done

- [ ] PDF generated and downloadable from dashboard
- [ ] White-label logo and color customization works
- [ ] PDF is agency-ready (professional layout, no broken fonts)
- [ ] Clerk Organizations setup, invite flow works
- [ ] Projects scoped to org when user is in an org
- [ ] Project tagging and dashboard filtering works
- [ ] Weekly digest cron running and sending emails
- [ ] Agency plan in Stripe, purchasable
- [ ] First agency plan customer
