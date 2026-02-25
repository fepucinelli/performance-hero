# Phase 2 — Pro

**Goal:** Monetize. First paying customers. Scheduled monitoring + alerts + historical data.
**Status:** ✅ Complete

---

## New Features

1. Stripe subscriptions (Starter $19/month, Pro $49/month)
2. Scheduled audits (daily / hourly) via Vercel Cron + QStash
3. Email alerts when metrics degrade
4. Historical trend charts (30-day view)
5. Multi-project dashboard with health overview

---

## Steps

### 1. Stripe Setup

```bash
pnpm add stripe @stripe/stripe-js
```

**Products to create in Stripe:**
- Product: "PerfAlly Starter" — R$99/month
- Product: "PerfAlly Pro" — R$249/month
- Product: "PerfAlly Agência" — R$499/month

Store Price IDs in env:
```
STRIPE_STARTER_PRICE_ID=price_xxx
STRIPE_PRO_PRICE_ID=price_xxx
STRIPE_AGENCY_PRICE_ID=price_xxx
```

**Stripe client:**
```typescript
// src/lib/api/stripe.ts
import Stripe from "stripe"
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
})
```

**Checkout flow:**
```typescript
// src/app/api/billing/checkout/route.ts
export async function POST(req: Request) {
  const { userId } = auth()
  const { priceId } = await req.json()

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })

  const session = await stripe.checkout.sessions.create({
    customer: user.stripeCustomerId ?? undefined,
    customer_email: user.stripeCustomerId ? undefined : user.email,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { userId },
  })

  return Response.json({ url: session.url })
}
```

**Stripe webhook handler:**
```typescript
// src/app/api/webhooks/stripe/route.ts
// Handle: checkout.session.completed, customer.subscription.updated,
//         customer.subscription.deleted, invoice.payment_failed
```

On `checkout.session.completed`:
- Set `users.stripeCustomerId`
- Set `users.plan` to the purchased plan

On `customer.subscription.deleted`:
- Reset `users.plan` to 'free'

**Customer Portal (self-service):**
```typescript
// src/app/api/billing/portal/route.ts
const session = await stripe.billingPortal.sessions.create({
  customer: user.stripeCustomerId,
  return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
})
return Response.json({ url: session.url })
```

### 2. Plan Enforcement Middleware

Add to all project/audit API routes:

```typescript
// src/lib/utils/check-limits.ts
export async function checkAuditLimit(userId: string) {
  const user = await getUser(userId)
  const limits = PLAN_LIMITS[user.plan]

  // Check project count
  const projectCount = await db
    .select({ count: count() })
    .from(projects)
    .where(eq(projects.userId, userId))

  // Check run count this month
  const monthStart = startOfMonth(new Date())
  const runCount = await db
    .select({ count: count() })
    .from(auditResults)
    .innerJoin(projects, eq(auditResults.projectId, projects.id))
    .where(and(
      eq(projects.userId, userId),
      gte(auditResults.createdAt, monthStart)
    ))

  return {
    canAddProject: projectCount[0].count < limits.maxProjects,
    canRunAudit: limits.manualRunsPerMonth === -1 || runCount[0].count < limits.manualRunsPerMonth,
  }
}
```

Show upgrade prompts in UI when limits are hit (not just errors).

### 3. Scheduled Audits

**Add to schema:**
```typescript
// projects table additions
schedule: text("schedule").default("manual"),   // manual | daily | hourly
nextAuditAt: timestamptz("next_audit_at"),
lastAuditAt: timestamptz("last_audit_at"),
```

**Install Upstash:**
```bash
pnpm add @upstash/qstash @upstash/redis @upstash/ratelimit
```

**Cron trigger (runs every hour):**
```typescript
// src/app/api/cron/trigger-audits/route.ts
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"
import { Client } from "@upstash/qstash"

const qstash = new Client({ token: process.env.QSTASH_TOKEN! })

export const POST = verifySignatureAppRouter(async () => {
  const now = new Date()

  // Find all projects due for an audit
  const dueProjects = await db.query.projects.findMany({
    where: and(
      ne(projects.schedule, "manual"),
      or(
        isNull(projects.nextAuditAt),
        lte(projects.nextAuditAt, now)
      )
    ),
    with: { user: true }
  })

  // Enqueue one QStash job per project
  await Promise.all(
    dueProjects.map(project =>
      qstash.publishJSON({
        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/run-audit`,
        body: { projectId: project.id },
        retries: 3,
      })
    )
  )

  return Response.json({ enqueued: dueProjects.length })
})
```

**vercel.json (add cron):**
```json
{
  "crons": [
    {
      "path": "/api/cron/trigger-audits",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Audit job handler:**
```typescript
// src/app/api/jobs/run-audit/route.ts
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"

export const POST = verifySignatureAppRouter(async (req) => {
  const { projectId } = await req.json()

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: { user: true }
  })
  if (!project) return new Response("Not found", { status: 404 })

  const auditData = await runPSIAudit(project.url, project.strategy as "mobile" | "desktop")

  const [result] = await db.insert(auditResults).values({
    projectId: project.id,
    ...auditData,
    lcpGrade: auditData.lcp ? gradeMetric("lcp", auditData.lcp) : null,
    clsGrade: auditData.cls ? gradeMetric("cls", auditData.cls) : null,
    inpGrade: auditData.inp ? gradeMetric("inp", auditData.inp) : null,
  }).returning()

  // Check alert conditions
  await checkAndSendAlerts(project, result)

  // Update next audit time
  const nextAuditAt = project.schedule === "hourly"
    ? addHours(new Date(), 1)
    : addDays(new Date(), 1)

  await db.update(projects)
    .set({ nextAuditAt, lastAuditAt: new Date() })
    .where(eq(projects.id, project.id))

  return Response.json({ ok: true, auditId: result.id })
})
```

### 4. Email Alerts

```bash
pnpm add resend react-email @react-email/components
```

**Alert check logic:**
```typescript
// src/lib/utils/alerts.ts
export async function checkAndSendAlerts(project: Project, result: AuditResult) {
  const degraded: string[] = []

  if (project.alertLcp && result.lcp && result.lcp > project.alertLcp) {
    degraded.push(`LCP: ${formatMs(result.lcp)} (threshold: ${formatMs(project.alertLcp)})`)
  }
  if (project.alertCls && result.cls && result.cls > project.alertCls) {
    degraded.push(`CLS: ${result.cls.toFixed(3)} (threshold: ${project.alertCls.toFixed(3)})`)
  }
  if (project.alertInp && result.inp && result.inp > project.alertInp) {
    degraded.push(`INP: ${formatMs(result.inp)} (threshold: ${formatMs(project.alertInp)})`)
  }

  if (degraded.length === 0) return

  // Check we haven't already alerted for this project in the last hour
  // (prevent alert spam from multiple runs)
  const recentAlert = await db.query.alerts.findFirst({
    where: and(
      eq(alerts.projectId, project.id),
      gte(alerts.sentAt, subHours(new Date(), 1))
    )
  })
  if (recentAlert) return

  await sendAlertEmail({
    to: project.user.email,
    projectName: project.name,
    projectUrl: project.url,
    degradedMetrics: degraded,
    auditId: result.id,
  })

  // Log alert to DB
  await db.insert(alerts).values(
    degraded.map(d => ({
      projectId: project.id,
      auditId: result.id,
      metric: d.split(":")[0].toLowerCase(),
      value: 0, // simplified
      threshold: 0,
    }))
  )
}
```

**Email template (React Email):**
```tsx
// src/lib/email/templates/AlertEmail.tsx
import { Html, Head, Body, Container, Text, Button, Heading } from "@react-email/components"

export function AlertEmail({ projectName, projectUrl, degradedMetrics, auditId }) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Heading>Performance alert: {projectName}</Heading>
          <Text>Your site's Core Web Vitals need attention:</Text>
          {degradedMetrics.map(m => <Text key={m}>• {m}</Text>)}
          <Button href={`https://performanceradar.com/audits/${auditId}`}>
            View full report →
          </Button>
        </Container>
      </Body>
    </Html>
  )
}
```

### 5. Historical Trend Charts

Install Recharts:
```bash
pnpm add recharts
```

**API route for history:**
```typescript
// src/app/api/projects/[id]/history/route.ts
// Returns last 30 audit results for a project
const history = await db.query.auditResults.findMany({
  where: eq(auditResults.projectId, projectId),
  orderBy: [desc(auditResults.createdAt)],
  limit: 30,
  columns: {
    id: true, createdAt: true, perfScore: true,
    lcp: true, cls: true, inp: true, fcp: true,
    cruxLcp: true, cruxCls: true, cruxInp: true, cruxFcp: true,
  }
})

Chart tabs: Pontuação, LCP, FCP, CLS, INP. Each tab shows two lines — blue solid (Lighthouse lab) and violet dashed (CrUX real users P75). Custom tooltip always renders both lines even when CrUX data is null.
```

**Chart component:**
```tsx
// src/components/charts/HistoryChart.tsx
// Line chart showing perfScore + LCP + CLS over time
// X-axis: date, Y-axis: score/ms
// Color-coded zones (red/amber/green bands)
// Tooltip shows exact values
```

**Add to schema (Phase 2 migration):**
```sql
-- Add to alerts table
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  audit_id UUID REFERENCES audit_results(id),
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  threshold REAL NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6. Project Settings Page

`/projects/[id]/settings`:
- Rename project
- Change URL
- Change schedule (manual / daily / hourly) — gated by plan
- Set alert thresholds (per metric)
- Delete project (with confirmation)

---

## Upgrade Flow UX

When a free user hits a limit:
```
┌─────────────────────────────────────────────┐
│  ⚡ Unlock scheduled monitoring              │
│                                              │
│  Your free plan includes manual runs only.  │
│  Upgrade to Starter to get daily audits +   │
│  email alerts.                               │
│                                              │
│  [Upgrade to Starter — $19/month]           │
└─────────────────────────────────────────────┘
```

Use shadcn Dialog or a persistent banner, not a full page redirect.

---

## Pricing Page

Build `/pricing` with a comparison table:

| Feature                    | Free | Starter $19 | Pro $49 |
|----------------------------|------|-------------|---------|
| Projects                   | 1    | 5           | 20      |
| Manual audits              | 10/mo| Unlimited   | Unlimited|
| Scheduled audits           | -    | Daily       | Hourly  |
| Email alerts               | -    | ✓           | ✓       |
| Historical data            | -    | 30 days     | 90 days |
| PDF reports                | -    | -           | ✓       |
| Slack alerts               | -    | -           | ✓       |

---

---

## Track F — AI-Powered Action Plans

Promoted from Phase 4. Claude Haiku generates personalized action plans for every audit on paid plans.

### How it works

1. After each audit result is saved, `maybeGenerateAIActionPlan()` checks the user's monthly quota
2. If under quota, calls `generateAIActionPlan()` which hits Claude Haiku
3. AI plan is stored in `audit_results.ai_action_plan` (JSONB) — cached forever, never regenerated
4. UI renders AI plan with a "✨ Gerado por IA" badge; falls back to static plan if null

### Tiered limits

| Plan    | AI Plans/Month | Cost rationale |
|---------|---------------|----------------|
| Free    | 0 (disabled)  | No AI access   |
| Starter | 5             | One per project per month |
| Pro     | 30            | Daily cadence for ~20 projects |
| Agency  | Unlimited     | R$499/mês — no limit |

### Prompt design

- **System:** Positions Claude as a CWV specialist targeting non-technical founders
- **User context:** URL, perf score, detected stack (from `lighthouseRaw.stackPacks`), all 5 metrics (LCP, INP via CrUX, CLS, FCP, TTFB), top failing audit IDs
- **Output:** PT-BR, 3–5 items, max 60 words each, JSON with `title`, `action`, `why`, `difficulty`, `stackTip`
- **Model:** `claude-haiku-4-5-20251001` — fast and cheap (~$0.001/call)

### Stack auto-detection

Lighthouse's `stackPacks` field identifies Next.js, Nuxt, React, Vue, WordPress, Shopify, etc. automatically. No user input required. The prompt passes the detected stacks to Claude for stack-specific tips.

### Error handling

Any failure in AI generation is silently caught and ignored — the audit result is always saved first. Missing `ANTHROPIC_API_KEY` disables AI generation gracefully.

---

## Definition of Done

- [x] Stripe Checkout working end-to-end (test mode)
- [x] Subscription status persisted in DB
- [x] Downgrade flow tested (subscription cancelled → plan reverts to free)
- [x] Cron job running on Vercel and triggering QStash jobs
- [x] Audit jobs running automatically for scheduled projects
- [x] Alert emails sending when thresholds exceeded
- [x] Historical chart rendering with real data
- [x] Upgrade prompts shown when limits hit
- [x] First paid customer (even if a friend — validate the checkout)
