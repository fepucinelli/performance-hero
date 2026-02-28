# Architecture Decisions

This document explains every major technical decision and the reasoning behind it.

---

## Data Sources

### PageSpeed Insights API (primary)

All Lighthouse + CrUX data comes from the **PageSpeed Insights API v5** — a single Google endpoint that returns both lab data and real-user field data in one call.

```
GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed
  ?url={url}
  &strategy={mobile|desktop}
  &category=performance
  &category=seo
  &category=accessibility
  &category=best-practices
  &key={GOOGLE_API_KEY}
```

> **Important:** `URLSearchParams` won't duplicate keys via object spread — each category must be appended individually with `.append("category", ...)`.

One call returns:
- **`lighthouseResult`** — Lab data: LCP, CLS, INP, FCP, TTFB, TBT, Speed Index, full audit list + all 4 category scores (performance, SEO, accessibility, best-practices)
- **`loadingExperience`** — Page-level CrUX P75 values for LCP, CLS, INP, FCP. Falls back to **`originLoadingExperience`** (origin-level) when page-level metrics are absent.

**Why not run Lighthouse directly?**
Running Lighthouse CLI on Vercel is impractical — no headless Chrome, cold start time, and binary size limits. PSI API is free (25,000 req/day with key), always runs the latest Lighthouse version, and returns both data sources in a single call.

**Limitations:**
- Rate-limited per IP without a key (400 req/day) — always use `GOOGLE_API_KEY`
- Results are cached by Google for ~30 seconds to 1 minute
- Some URLs aren't in CrUX (low-traffic sites) — handled with a lab-data-only fallback
- Does not support authenticated pages or interaction-dependent SPAs
- INP has no Lighthouse lab value — `crux_inp` (CrUX P75) is the only INP source

**CrUX API shape gotchas:**
- P75 values live at `metrics.METRIC_NAME.percentile` (flat integer) — NOT `percentiles.p75`
- `CUMULATIVE_LAYOUT_SHIFT_SCORE` is stored ×100 (e.g. `10` = CLS `0.10`) — divide by 100 before grading
- Always read `originLoadingExperience` as fallback when `loadingExperience.metrics` is empty

---

### CrUX History API

For 25 weeks of historical real-user field data, the **Chrome UX Report History API** provides weekly P75 snapshots. Powers the "Usuários reais · 25 sem." toggle in the history chart.

```
POST https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord
```

- Same `GOOGLE_API_KEY` — requires **"Chrome UX Report API"** enabled separately in Google Cloud Console
- Tries page-level URL first, falls back to origin-level
- Returns null silently when URL isn't in CrUX dataset (low-traffic sites)
- Fetched fire-and-forget after each audit insert — never blocks the audit result
- Stored as JSONB snapshot in `audit_results.crux_history_raw`

The chart toggle only renders when `cruxHistoryRaw` is non-null, so the feature degrades gracefully for low-traffic sites.

---

## Site Health Score

A composite score displayed at the top of every project page and share link:

```typescript
const siteHealth = Math.round(perfScore * 0.4 + seoScore * 0.3 + accessibilityScore * 0.3)
```

Best Practices is shown in the 2×2 grid but excluded from the composite — it's informational. This gives agencies a single headline number to report to clients.

---

## Multi-Page Scanning

Each project supports auditing **multiple sub-pages** (e.g. `/`, `/products`, `/blog`). Pages are stored in the `project_pages` table, and every audit result is scoped to a specific page via `page_id`.

**Behavior:**
- New projects auto-create a default page from the project's primary URL
- Old audit results without a `page_id` are automatically migrated on first page view
- Page tabs appear on the project page when more than one page exists
- Each plan has a `maxPagesPerProject` limit: Free=2, Starter=10, Pro=50, Agency=unlimited

**Why per-page rather than per-project?**
Auditing a homepage vs a product page yields very different results. Agencies need granular visibility, not just an average across all pages. Per-page history is also cleaner for regression detection.

---

## Database: Neon (Serverless PostgreSQL)

**Why Neon over Supabase, PlanetScale, or Railway?**
- Native Vercel integration (connect in Vercel dashboard)
- Branch-per-preview-deployment support
- Auto-suspend scales cost to zero when idle (good for early stage)
- Full PostgreSQL — no MySQL syntax, no proxy layer

**Why Drizzle over Prisma?**
- Generates plain SQL — easier to debug
- Smaller bundle (important for Vercel Functions)
- Better TypeScript inference on query results
- Migrations are SQL files — no engine process needed

**Drizzle gotchas:**
- `timestamptz` is NOT exported from `drizzle-orm/pg-core` v0.45 — use a local alias: `const timestamptz = (name: string) => timestamp(name, { withTimezone: true })`
- `drizzle-kit` doesn't auto-load `.env.local` — call `config({ path: ".env.local" })` from `dotenv` at top of `drizzle.config.ts`
- Schema push: always use `pnpm exec drizzle-kit push --force` (not `pnpm db:push` — double-dash flag issue in pnpm scripts)

---

## Authentication: Clerk

**Why Clerk over NextAuth / Auth.js / Lucia?**
- Handles email verification, 2FA, and social logins out of the box
- User management UI at no extra dev cost
- Webhook events (`user.created`, `user.deleted`) to sync with the DB
- Organizations (teams) built-in — needed for Phase 3 (agency multi-user)
- Billing-friendly: first 10,000 MAUs are free

**Clerk setup pattern (Next.js 16):**
```
ClerkProvider (root layout)
  → proxy.ts (NOT middleware.ts — Next.js 16 convention) protects (dashboard) routes
  → webhook /api/webhooks/clerk syncs user to DB
```

> **Note:** Next.js 16 uses `proxy.ts` as the Clerk middleware file, not `middleware.ts`. The middleware is exported as `clerkMiddleware` from `@clerk/nextjs/server`.

**Organizations (Phase 3 — Agency plan):**
Clerk Organizations are used for multi-user teams. Enable via Clerk Dashboard → Settings → Organizations.

- `orgId` is available from `auth()` alongside `userId`
- All ownership queries check `orgId` (if active) or fall back to `userId` with `isNull(projects.org_id)`
- The `OrganizationSwitcher` component is shown in the dashboard header for Agency plan users only
- Creating an org is available to all Agency users; non-Agency users see only the personal workspace

---

## Background Jobs: Upstash QStash

Scheduled audit runs can't happen in a standard Vercel Function (max 60s on hobby, 300s on pro). The flow is:

```
Vercel Cron (hourly)
  → POST /api/cron/trigger-audits
    → QStash: enqueue one job per project due (nextAuditAt ≤ now)
      → QStash delivers to /api/jobs/run-audit?projectId=xxx
        → Calls PSI API (all 4 Lighthouse categories)
        → Saves AuditResult to DB
        → Evaluates alert conditions
        → Sends email if degraded (Resend)
        → Fire-and-forget: CrUX History fetch + AI action plan generation
```

**Why QStash over Vercel Cron alone?**
- Vercel Cron fires on a fixed schedule but doesn't scale per-project
- QStash handles retries, delivery guarantees, and fan-out across many projects

**Why Upstash Redis?**
- Cache PSI API responses (same URL + strategy) for 5 minutes
- Prevent duplicate cron runs
- Rate limiting per user for high-frequency endpoints
- Edge-compatible (Vercel Edge Middleware can read it)

---

## AI: Claude API (Anthropic)

**Model selection — tiered by plan:**

| Plan | DB key | Model |
|------|--------|-------|
| Grátis | `free` | — (static plan only) |
| Freelancer | `starter` | `claude-haiku-4-5-20251001` |
| Studio | `pro` | `claude-sonnet-4-6` |
| Agência | `agency` | `claude-sonnet-4-6` |

Higher-tier plans get Sonnet for better reasoning quality and more precise recommendations. This difference is a tangible product differentiator between Starter and Studio/Agency.

**What it does:**
- Generates 4–6 personalized, PT-BR action plan items per audit
- Detects tech stack from Lighthouse's built-in `stackPacks` (Next.js, Nuxt, WordPress, etc.)
- Includes all 5 CWV metrics as context: LCP, INP (CrUX P75), CLS, FCP, TTFB
- Includes SEO and Accessibility scores with failing audit IDs
- Extracts top failing performance audits with specific resource details (file names, wasted bytes, blocking times) so recommendations are file-specific, not generic

**Output format** — each item in the JSON array:
```json
{
  "title": "Short title (≤8 words)",
  "action": "Problem + solution summary (≤2 sentences)",
  "steps": [
    "Concrete implementation step — may include a terminal command or code snippet",
    "Step 2",
    "Step 3"
  ],
  "why": "Measurable business or SEO impact (1 sentence)",
  "difficulty": "Fácil | Médio | Difícil",
  "stackTip": "Stack-specific instruction (omitted when stack not detected)"
}
```

Backtick-wrapped code in `steps`, `action`, and `stackTip` is rendered as styled `<code>` elements in the UI (`InlineCode` component in `ActionPlan.tsx`).

**Token budget:**
- `max_tokens: 4096` — required to fit a complete 4–6 item response with multi-step content without truncation

**Tiered access limits:**

| Plan | AI Plans/Month |
|------|---------------|
| `free` | 0 — static plan only |
| `starter` | 5 |
| `pro` | 30 |
| `agency` | Unlimited |

**Caching:** Output saved in `audit_results.ai_action_plan` (JSONB). Never regenerated for the same audit record — the limit quota is consumed once per audit.

**Cost estimate:** Each call uses ~800–1,500 tokens. At Sonnet pricing, 1,000 AI plans/month ≈ $3–5. Negligible relative to subscription revenue.

**Error handling:** `ANTHROPIC_API_KEY` is optional. Any error (missing key, API failure, malformed JSON) silently falls back to the static plan. AI generation never blocks the audit save.

---

## PDF Generation: @react-pdf/renderer

**Why not Puppeteer/Playwright?**
Puppeteer requires a full Chromium install. Vercel Functions don't support it (binary size + memory limits). `@react-pdf/renderer` generates PDFs using React components compiled to PDF primitives — no browser needed, runs in any serverless function.

**Pattern:**
```tsx
// src/lib/pdf/AuditReport.tsx
import { Document, Page, Text, View, Image } from '@react-pdf/renderer'

export function AuditReportPDF({ audit, project, branding }: Props) {
  return (
    <Document>
      <Page>...</Page>
    </Document>
  )
}
```

Generated PDFs are uploaded to Vercel Blob storage. The URL is saved in the `reports` table and returned to the user for download.

**White-label branding (Agency plan):**
The `branding` prop accepts:
- `agencyLogoUrl` — remote image URL rendered on the cover page using `<Image>`
- `agencyName` — shown above the report title and in the page footer
- `agencyContact` — shown in the cover page footer (replaces "perfally.com")
- `accentColor` — hex string applied as the top accent bar color on every page

**Important: logo URLs must be absolute.** `@react-pdf/renderer` fetches images in the Node.js API route context, where relative paths like `/uploads/logos/…` cannot resolve. The reports route converts any relative `agencyLogoUrl` to an absolute URL using the incoming request's origin before passing it to the PDF component:

```typescript
function absoluteUrl(url: string | null | undefined, origin: string): string | null {
  if (!url) return null
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`
}
```

**Local dev fallback for logo uploads:**
When `BLOB_READ_WRITE_TOKEN` is not set, logos are saved to `public/uploads/logos/{userId}/` and served at `/uploads/logos/…`. These paths are gitignored. The absolute URL conversion above makes them work in local PDF generation. In production, Vercel Blob always returns absolute `https://…` URLs.

---

## Email: Resend

- React Email for templates (same component DX as building UI)
- Generous free tier (3,000 emails/month)
- Excellent deliverability out of the box

**Email types in the system:**
- **Alert** — metric degraded below a configured threshold
- **Weekly digest** — performance summary across all projects (Phase 3)
- **Report ready** — PDF download link (Phase 3)
- **Billing** — payment failed, subscription changed

---

## Payments: Stripe

**Subscription model:**
- Flat monthly subscriptions — no metered billing
- One product per tier: Freelancer R$89, Studio R$199, Agência R$449
- DB `plan` enum values are fixed: `"starter"`, `"pro"`, `"agency"` — display names are UI-only and can change without migration
- Stripe Customer Portal for self-service plan changes and cancellations
- Webhooks sync subscription lifecycle events (`customer.subscription.updated`, `customer.subscription.deleted`) to the DB

> **Important:** Store the Stripe Customer ID and plan on the user record in your DB. Always check `users.plan` (not the Stripe API) on each request to avoid latency.

---

## Vercel Deployment

```
main branch     → production (perf-ally.com)
preview branches → preview URLs (auto, per PR)
```

**Environment variables per environment:**
- Production: real Stripe keys, Neon production branch
- Preview: Stripe test mode keys, Neon dev branch (use Neon branching feature)

**Vercel Cron** (defined in `vercel.json`):
```json
{
  "crons": [
    { "path": "/api/cron/trigger-audits", "schedule": "0 * * * *" }
  ]
}
```

Runs hourly; the handler queries `nextAuditAt ≤ now` to determine which projects are due. Daily audits fire at 15:00 UTC (noon BRT).

---

## Core Web Vitals: Thresholds & Grading

Google's official thresholds (as of 2025):

| Metric | Good     | Needs Improvement | Poor     |
|--------|----------|-------------------|----------|
| LCP    | ≤ 2.5s   | 2.5s – 4.0s       | > 4.0s   |
| INP    | ≤ 200ms  | 200ms – 500ms     | > 500ms  |
| CLS    | ≤ 0.1    | 0.1 – 0.25        | > 0.25   |
| FCP    | ≤ 1.8s   | 1.8s – 3.0s       | > 3.0s   |
| TTFB   | ≤ 800ms  | 800ms – 1,800ms   | > 1,800ms|

> **Note:** INP replaced FID as a Core Web Vital. Lighthouse lab data cannot produce an INP value — only CrUX field data provides it.

**Performance Score mapping** (Lighthouse composite):
- 90–100: Good (green)
- 50–89: Needs Improvement (amber)
- 0–49: Poor (red)

Pre-computed grades are stored in the DB (`lcp_grade`, `cls_grade`, `inp_grade`). Never rely on re-computing grades from raw values in the UI — the thresholds may be updated by Google without a schema change.

---

## Database Schema

```sql
-- users: synced from Clerk webhooks
users (
  id                 TEXT PRIMARY KEY,       -- Clerk user ID
  email              TEXT NOT NULL,
  name               TEXT,
  stripe_customer_id TEXT UNIQUE,
  plan               TEXT DEFAULT 'free',    -- free | starter | pro | agency
  plan_expires_at    TIMESTAMPTZ,
  -- White-label branding (Agency plan only)
  agency_name          TEXT,
  agency_contact       TEXT,
  agency_accent_color  TEXT,                    -- hex string e.g. "#6366f1"
  agency_logo_url      TEXT,                    -- Vercel Blob URL (or local /uploads/… in dev)
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
)

-- projects: one project = one site being monitored
projects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  url            TEXT NOT NULL,             -- canonical URL (used for display and default page)
  strategy       TEXT DEFAULT 'mobile',     -- mobile | desktop
  schedule       TEXT DEFAULT 'manual',     -- manual | daily | hourly
  next_audit_at  TIMESTAMPTZ,
  last_audit_at  TIMESTAMPTZ,
  alert_lcp      REAL,                      -- ms threshold; null = no alert
  alert_cls      REAL,                      -- ratio threshold
  alert_inp      REAL,                      -- ms threshold
  org_id         TEXT,                      -- Clerk org ID for team projects (Phase 3)
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
)

-- project_pages: individual URLs audited within a project
project_pages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  label       TEXT,                         -- optional display name (e.g. "Homepage", "Pricing")
  url         TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
)

-- audit_results: one row per Lighthouse run; immutable once written
audit_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  page_id         UUID REFERENCES project_pages(id) ON DELETE SET NULL,

  strategy        TEXT NOT NULL,            -- mobile | desktop

  -- Lighthouse lab data
  perf_score      REAL,                     -- 0–100
  lcp             REAL,                     -- ms
  cls             REAL,                     -- unitless ratio
  inp             REAL,                     -- ms (lab; usually null — use crux_inp)
  fcp             REAL,                     -- ms
  ttfb            REAL,                     -- ms
  tbt             REAL,                     -- ms
  speed_index     REAL,                     -- ms

  -- CrUX P75 real-user values (null for low-traffic sites)
  crux_lcp        REAL,
  crux_cls        REAL,
  crux_inp        REAL,
  crux_fcp        REAL,

  -- Pre-computed grades (stored to survive threshold changes)
  lcp_grade       TEXT,                     -- good | needs-improvement | poor
  cls_grade       TEXT,
  inp_grade       TEXT,

  -- Additional Lighthouse category scores
  seo_score            REAL,               -- 0–100
  accessibility_score  REAL,               -- 0–100
  best_practices_score REAL,               -- 0–100

  -- Full Lighthouse JSON (for action plans and full audit list rendering)
  lighthouse_raw   JSONB,

  -- AI-generated action plan (null = not generated or limit reached)
  ai_action_plan   JSONB,

  -- CrUX History API snapshot (25 weeks weekly P75; null = URL not in dataset)
  crux_history_raw JSONB,

  -- Public share link token
  share_token      TEXT NOT NULL DEFAULT gen_random_uuid()::text,

  psi_api_version  TEXT,
  triggered_by     TEXT DEFAULT 'manual',   -- manual | cron | api

  created_at       TIMESTAMPTZ DEFAULT NOW()
)

-- alerts: history of fired alerts (de-duped: max 1 per project per hour)
alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  audit_id    UUID REFERENCES audit_results(id) ON DELETE CASCADE,
  metric      TEXT NOT NULL,                -- lcp | cls | inp
  value       REAL NOT NULL,
  threshold   REAL NOT NULL,
  email_sent  BOOLEAN DEFAULT FALSE,
  slack_sent  BOOLEAN DEFAULT FALSE,
  sent_at     TIMESTAMPTZ DEFAULT NOW()
)

-- reports: generated PDFs stored in Vercel Blob (Phase 3)
reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  audit_id    UUID REFERENCES audit_results(id) ON DELETE CASCADE,
  page_id     UUID REFERENCES project_pages(id) ON DELETE SET NULL,
  blob_url    TEXT NOT NULL,
  created_by  TEXT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
)
```

---

## Plan Enforcement

Plan limits are defined in `src/lib/utils/plan-limits.ts` as a `PLAN_LIMITS` constant keyed by plan string.

| Limit | Enforcement point |
|-------|-------------------|
| `maxProjects` | `createProjectAction` (server action) |
| `maxPagesPerProject` | `addPageAction` (server action) |
| `manualRunsPerMonth` | Audit route via `getMonthlyRunCount` |
| `historyDays` | Date filter on history queries (not row limit) |
| `aiActionPlansPerMonth` | `maybeGenerateAIActionPlan` in `audit-runner.ts` |
| `scheduledRuns` / `hourlyRuns` | Schedule selector UI + cron trigger handler |
| `pdfReports` | PDF route + download button + ReportHistory component |

Upstash Redis is available for sliding-window rate limits on high-frequency endpoints (e.g. the public `/check` analyzer in Phase 4).

---

## Plain-English Action Plans (Static Fallback)

Every metric has a static explanation and action plan in `src/lib/utils/explanations.ts`. The `getActionPlan()` function maps failed Lighthouse audit IDs to prioritized fix recommendations. This is always the fallback for:
- Free plan users (`aiActionPlansPerMonth: 0`)
- Users who have exhausted their monthly AI quota
- Any AI generation failure (missing key, API error, malformed response)

The static plan is a safety net — the product is never left without recommendations.

---

## Security

- All PSI calls happen server-side — `GOOGLE_API_KEY` never exposed to the client
- Clerk middleware protects all `/dashboard` routes via `proxy.ts`
- Project and page ownership verified on every API call — org-aware: checks `org_id` when an org session is active, otherwise checks `user_id` with `IS NULL` guard on `org_id`
- Stripe webhooks verified with `stripe.webhooks.constructEvent`
- No user-provided HTML rendered unsanitized
- URL validation before PSI call (reject localhost, private IPs, non-HTTP schemes)
- Share tokens are random UUIDs — not guessable, not sequential
