# Architecture Decisions

This document explains every major technical decision and the reasoning behind it.

---

## Data Sources

### PageSpeed Insights API (primary)

All Lighthouse + CrUX data comes from the **PageSpeed Insights API v5** (a single endpoint from Google).

```
GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed
  ?url={url}
  &strategy={mobile|desktop}
  &key={GOOGLE_API_KEY}
```

One call returns:
- **`lighthouseResult`** — Lab data: LCP, CLS, INP, FCP, TTFB, Total Blocking Time, Speed Index, full audit list
- **`loadingExperience`** — Page-level CrUX P75 values for LCP, CLS, INP, FCP. Falls back to **`originLoadingExperience`** (origin-level) when page metrics are absent.

**Why not run Lighthouse directly?**
Running Lighthouse CLI on Vercel is impractical (no headless Chrome, cold start time).
Running it on a dedicated server adds infra cost and maintenance.
PSI API is free (25,000 req/day with API key), gives both data sources in one call, and is always up to date with the latest Lighthouse version.

**Limitations to be aware of:**
- PSI API is rate-limited per IP without a key (400 req/day) — always use GOOGLE_API_KEY
- Results are cached by Google for ~30 seconds to 1 minute
- Some URLs aren't in CrUX (low-traffic sites) — handle gracefully with a lab-data-only fallback
- Does not support authenticated pages or SPAs that require interaction
- INP has no Lighthouse lab value — it requires real user interactions. `cruxInp` is the only source of INP data.


**CrUX API shape (important gotcha):**
- P75 values live at `metrics.METRIC_NAME.percentile` (flat integer) — NOT `percentiles.p75`
- `CUMULATIVE_LAYOUT_SHIFT_SCORE` is stored ×100 (e.g. `10` = CLS `0.10`) — divide by 100 before grading/display
- Always read `originLoadingExperience` as fallback when `loadingExperience.metrics` is empty
**Future consideration (Phase 5):** Run actual Lighthouse via a long-running worker (Fly.io, Railway) for custom audits, authentication support, and multi-step flows.

### CrUX History API (Phase 4)

For trend data beyond what PSI returns, the **Chrome UX Report History API** provides 25 weeks of historical field data.

```
POST https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord
```

Use this to power the "is your site improving over time?" chart.

---

## Database: Neon (Serverless PostgreSQL)

**Why Neon over Supabase, PlanetScale, or Railway?**
- Native Vercel integration (connect in Vercel dashboard)
- Branching support (create DB branch per Vercel preview deployment)
- Auto-suspend scales cost to zero when idle (good for early-stage)
- Full PostgreSQL — no MySQL syntax, no proxy layer

**Why Drizzle over Prisma?**
- Drizzle generates plain SQL — easier to debug and reason about
- Smaller bundle size (important for Vercel Functions)
- Better TypeScript inference on queries
- Migrations are just SQL files — no engine process needed

---

## Authentication: Clerk

**Why Clerk over NextAuth / Auth.js / Lucia?**

For a SaaS project:
- Clerk handles email verification, 2FA, social logins out of the box
- User management UI at no extra development cost
- Webhook events for `user.created` / `user.deleted` to sync with your DB
- Organizations (teams) built-in — needed for Phase 3 (agency multi-user)
- Billing-friendly: first 10,000 MAUs are free

**Clerk setup pattern:**
```
ClerkProvider (root layout)
  → proxy.ts protects (dashboard) routes and redirects authenticated users from / to /dashboard
  → webhook /api/webhooks/clerk syncs user to DB
```

---

## Background Jobs: Upstash QStash

Scheduled audit runs can't happen in a Vercel Function (max 60s timeout on hobby, 300s on pro). The flow is:

```
Vercel Cron (daily/hourly)
  → POST /api/cron/trigger-audits
    → QStash: enqueue one job per project
      → QStash delivers to /api/jobs/run-audit?projectId=xxx
        → Calls PSI API
        → Saves AuditResult to DB
        → Evaluates alert conditions
        → Sends email if degraded
```

**Why QStash over Vercel Cron alone?**
- Vercel Cron only fires on schedule, doesn't scale per-project
- QStash handles retries, delivery guarantees, and fan-out
- Free tier: 500 messages/day

**Why Upstash Redis for caching?**
- Cache PSI API responses (same URL, same strategy) for 5 minutes
- Prevent duplicate cron runs
- Rate limiting (plan limits per user)
- Edge-compatible (Vercel Edge Middleware can read it)

---

## AI: Claude API (Anthropic)

**Model:** `claude-haiku-4-5-20251001` — fast and cost-effective for action plan generation.

**What it does:**
- Generates 3–5 personalized, PT-BR action plan items per audit
- Detects tech stack from Lighthouse's built-in `stackPacks` (Next.js, WordPress, Vue, etc.)
- Includes all 5 CWV metrics as context: LCP, INP (CrUX P75), CLS, FCP, TTFB
- Output cached in `audit_results.ai_action_plan` (JSONB) — never regenerated for same audit

**Tiered access (all paid plans):**
- Free: 0 (static action plan only)
- Starter: 5/month
- Pro: 30/month
- Agency: unlimited (-1)

**Cost estimate:** Each call uses ~500-800 tokens total. At Haiku pricing (~$0.001/call), 1,000 AI plans/month ≈ $1. Negligible.

**Error handling:** `ANTHROPIC_API_KEY` optional — if missing or any error occurs, falls back to static plan. AI generation never blocks audit save.

---

## PDF Generation: @react-pdf/renderer

**Why not Puppeteer/Playwright?**
Puppeteer requires a full Chromium install. Vercel Functions don't support that (binary size + memory). Workarounds (puppeteer-core + @sparticuz/chromium) are fragile and slow.

`@react-pdf/renderer` generates PDFs using React components compiled to PDF primitives — no browser needed. Runs fine in a serverless function.

**Pattern:**
```tsx
// components/pdf/AuditReport.tsx
import { Document, Page, Text, View } from '@react-pdf/renderer'

export function AuditReportPDF({ audit }: Props) {
  return (
    <Document>
      <Page>...</Page>
    </Document>
  )
}
```

Generated PDF is streamed to Vercel Blob storage, then a signed URL is returned to the user.

---

## Email: Resend

- React Email for templates (same DX as building UI components)
- Resend has a generous free tier (3,000 emails/month)
- Excellent deliverability

**Email types in the system:**
- Welcome email on sign-up
- Alert: metric degraded below threshold
- Weekly digest: performance summary
- Report ready: PDF link
- Billing: payment failed, subscription changed

---

## Payments: Stripe

**Subscription model:**
- One product per tier (Starter, Pro, Agency)
- Metered billing NOT used — flat monthly subscription
- Stripe Customer Portal for self-service plan changes/cancellations
- Webhooks to sync subscription status with DB

**Important:** Store Stripe Customer ID and Subscription ID on the user record. Check subscription status from DB (not Stripe API) on every request to avoid latency.

---

## Vercel Deployment Strategy

```
main branch → production (perf-ally.com)
preview branches → preview URLs (auto, per PR)
```

**Environment variables per environment:**
- Production: real Stripe keys, Neon production branch
- Preview: Stripe test mode, Neon dev branch (use Neon branching)

**Vercel Cron jobs** (defined in `vercel.json`):
```json
{
  "crons": [
    { "path": "/api/cron/trigger-audits", "schedule": "0 * * * *" }
  ]
}
```
Runs hourly; the handler determines which projects are due based on their `nextAuditAt` field.

---

## Core Web Vitals: Thresholds & Grading

Google's official thresholds (as of 2025):

| Metric | Good     | Needs Improvement | Poor    |
|--------|----------|-------------------|---------|
| LCP    | ≤ 2.5s   | 2.5s – 4.0s       | > 4.0s  |
| INP    | ≤ 200ms  | 200ms – 500ms     | > 500ms |
| CLS    | ≤ 0.1    | 0.1 – 0.25        | > 0.25  |
| FCP    | ≤ 1.8s   | 1.8s – 3.0s       | > 3.0s  |
| TTFB   | ≤ 800ms  | 800ms – 1800ms    | > 1800ms|


**Note:** INP replaces FID as a Core Web Vital. Lighthouse lab data cannot produce an INP value — only CrUX field data provides it.
**Performance Score mapping** (Lighthouse composite):
- 90–100: Good (green)
- 50–89: Needs Improvement (orange)
- 0–49: Poor (red)

Store raw values + computed grade in DB. Never rely on re-computing grades from raw values in UI — grades may change as Google updates thresholds.

---

## Database Schema (Core Tables)

```sql
-- users (synced from Clerk webhooks)
users (
  id            TEXT PRIMARY KEY,   -- Clerk user ID
  email         TEXT NOT NULL,
  name          TEXT,
  stripe_customer_id TEXT,
  plan          TEXT DEFAULT 'free', -- free | starter | pro | agency
  plan_expires_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
)

-- projects (a URL to monitor)
projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  strategy    TEXT DEFAULT 'mobile',  -- mobile | desktop | both
  schedule    TEXT DEFAULT 'daily',   -- manual | daily | hourly
  next_audit_at TIMESTAMPTZ,
  alert_lcp   REAL,   -- threshold to trigger alert (optional)
  alert_cls   REAL,
  alert_inp   REAL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
)

-- audit_results (one row per Lighthouse run)
audit_results (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  strategy    TEXT NOT NULL,
  -- Lab data (Lighthouse)
  perf_score  REAL,
  lcp         REAL,
  cls         REAL,
  inp         REAL,
  fcp         REAL,
  ttfb        REAL,
  tbt         REAL,
  speed_index REAL,
  -- Field data (CrUX) — nullable, not all URLs have CrUX
  crux_lcp    REAL,
  crux_cls    REAL,
  crux_inp    REAL,
  crux_fcp    REAL,
  -- Grades (good | needs-improvement | poor)
  lcp_grade   TEXT,
  cls_grade   TEXT,
  inp_grade   TEXT,
  -- Full Lighthouse JSON (for action plans, full audit list)
  lighthouse_raw JSONB,
  -- Source metadata
  psi_api_version TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
)

-- reports (PDF reports)
reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  audit_id    UUID REFERENCES audit_results(id),
  blob_url    TEXT NOT NULL,
  created_by  TEXT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
)

-- alerts (alert history)
alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  audit_id    UUID REFERENCES audit_results(id),
  metric      TEXT NOT NULL,   -- lcp | cls | inp
  value       REAL NOT NULL,
  threshold   REAL NOT NULL,
  sent_at     TIMESTAMPTZ DEFAULT NOW()
)
```

---

## Plain-English Explanations

A core differentiator. Every metric needs:
1. **What it is** (one sentence)
2. **Why it matters** (user impact)
3. **Your score** (contextual)
4. **Top 3 actions** (specific to their audit result)

Explanations are generated from the Lighthouse audit list. Each failed audit maps to an action item. This static lookup (`getActionPlan()`) is the fallback for free users and when AI generation fails.

**Phase 2+:** Paid users get AI-powered plans from Claude Haiku (tiered limits). The static plan is always the fallback. See [AI: Claude API](#ai-claude-api-anthropic) section above.

---

## Rate Limiting & Plan Enforcement

Use Upstash Redis with a sliding window rate limiter:

```typescript
// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit"

export const auditRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(PLAN_LIMITS[plan].runsPerDay, "1 d"),
  prefix: "audit",
})
```

Plan limits enforced at the API route level before calling PSI.

---

## Security Considerations

- All PSI calls happen server-side — GOOGLE_API_KEY never exposed to client
- Clerk middleware protects all `/dashboard` routes
- Project ownership verified on every API call (`WHERE user_id = currentUser.id`)
- Stripe webhooks verified with `stripe.webhooks.constructEvent`
- No user-provided HTML rendered unsanitized
- URL validation before PSI call (reject localhost, private IPs, non-HTTP)
