# PerfAlly

> **Auditorias profissionais de performance e SEO para desenvolvedores que vendem consultoria.**
> Monitore os sites dos seus clientes. Gere relatórios impressionantes. Cobre como especialista.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Neon](https://img.shields.io/badge/Neon-PostgreSQL-green?style=flat-square)](https://neon.tech)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com)

---

## What It Does

PerfAlly runs PageSpeed Insights audits on your clients' sites and turns raw Lighthouse data into something you can actually deliver — a Site Health score, failing SEO/accessibility items labeled in plain Portuguese, AI-generated action plans with concrete implementation steps, and 25 weeks of real-user trend data.

Building a website is no longer the challenge; maintaining speed and performance at scale is.

---

## Current Status

**Phases 0, 1, and 2 complete.**

| Phase | What | Status |
|-------|------|--------|
| 0 — Foundation | Auth, DB, Vercel deploy, CI | ✅ Done |
| 1 — MVP | URL → audit → report, free tier | ✅ Done |
| 2 — Pro | Stripe billing, scheduled monitoring, email alerts, history charts, AI action plans, SEO/A11y audits, multi-page scanning, CrUX 25-week data | ✅ Done (needs env vars in prod) |
| 3 — Agency | PDF reports, white-label, multi-user teams | Planned |
| 4 — Growth | `/check` public analyzer, Slack alerts, embeddable badge | Planned |

---

## Features

### Grátis (R$0)
- 1 project, 2 pages per project, 5 manual audits/month
- Site Health score (perf×0.4 + SEO×0.3 + accessibility×0.3 composite)
- Core Web Vitals: LCP, INP, CLS, FCP, TTFB with CrUX P75 real-user field data
- SEO + Accessibility failing audit items with PT-BR labels
- Resource diagnostics: transfer size, render-blocking resources, image savings, JS execution
- Static action plan (rule-based, from Lighthouse audit list)
- Public share link (`/share/[token]`)
- 7-day history

### Freelancer (R$89/mês)
- 5 projects, 10 pages per project
- Daily scheduled monitoring
- Email alerts when metrics degrade (configurable thresholds per metric per project)
- AI action plans: 5/month — stack-aware, PT-BR, powered by Claude Haiku
- 30-day history

### Studio (R$199/mês)
- 20 projects, 50 pages per project
- Hourly scheduled monitoring
- AI action plans: 30/month — powered by Claude Sonnet (higher quality than Freelancer)
- PDF reports
- 90-day history

### Agência (R$449/mês)
- 100 projects, unlimited pages per project
- Unlimited AI action plans — Claude Sonnet
- White-label PDF reports (custom logo, color, footer)
- Multi-user teams via Clerk Organizations (Phase 3)
- 1-year history

---

## AI Action Plans

Each plan includes an AI-generated section with 4–6 prioritized recommendations. The AI:

- Detects the tech stack from Lighthouse `stackPacks` (Next.js, Nuxt, WordPress, etc.)
- References actual failing resources by name — no generic advice
- Provides concrete `steps[]` per recommendation, including terminal commands and code snippets
- Renders backtick-wrapped code as styled `<code>` blocks in the UI
- Outputs in PT-BR throughout
- Falls back to the static rule-based plan for free users, quota exhaustion, or API failure

| Plan | Model | Plans/month |
|------|-------|-------------|
| Grátis | — | 0 (static only) |
| Freelancer | Claude Haiku | 5 |
| Studio | Claude Sonnet | 30 |
| Agência | Claude Sonnet | Unlimited |

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 16.1.6 + React 19, App Router | Server Components + Server Actions |
| Styling | Tailwind CSS v4 + shadcn/ui (new-york) | CSS-based config (`@import "tailwindcss"`) |
| Database | Neon (serverless PostgreSQL) + Drizzle ORM | Auto-suspend, Vercel native integration, DB branching |
| Auth | Clerk v6 | Built-in orgs for Phase 3 teams, webhook sync |
| Payments | Stripe | Subscriptions + Customer Portal |
| Email | Resend + React Email | Alert emails, weekly digests |
| Jobs | Upstash QStash + Vercel Cron | Fan-out scheduled audit jobs per project |
| Cache | Upstash Redis | Rate limiting, PSI response cache, dedup |
| Storage | Vercel Blob | PDF reports, logos (Phase 3) |
| AI | Claude Haiku / Sonnet (Anthropic) | Tiered by plan — Haiku for Freelancer, Sonnet for Studio/Agency |
| Charts | Recharts | Score history + CrUX 25-week field data view |
| Data | PageSpeed Insights API v5 + CrUX History API | Lighthouse lab + real-user data in one call |
| Monitoring | Sentry | Error tracking |
| Deployment | Vercel | Serverless functions, cron, blob storage |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/                    # Sign-in / sign-up pages (Clerk)
│   ├── (dashboard)/               # Protected app routes
│   │   ├── dashboard/             # Project list
│   │   ├── projects/[id]/         # Project detail, per-page tabs, audit history
│   │   └── settings/              # Billing, alert thresholds
│   ├── (marketing)/               # Landing page (/)
│   ├── share/[token]/             # Public read-only audit report
│   └── api/
│       ├── webhooks/stripe/       # Subscription lifecycle
│       ├── webhooks/clerk/        # User sync to DB
│       ├── projects/[id]/audit/   # Manual audit trigger
│       ├── projects/[id]/pdf/     # PDF generation + Vercel Blob upload
│       ├── cron/trigger-audits/   # Vercel Cron → QStash fan-out
│       └── jobs/run-audit/        # QStash job handler
├── components/
│   ├── metrics/
│   │   ├── SiteHealthCard.tsx     # 2×2 composite score grid (headline)
│   │   ├── MetricCard.tsx         # Individual CWV card (lab + field values)
│   │   ├── ScoreGauge.tsx         # Circular SVG gauge 0–100
│   │   ├── ActionPlan.tsx         # AI + static action plan with inline code rendering
│   │   ├── AuditList.tsx          # Collapsible full Lighthouse audit list
│   │   ├── SEOAuditList.tsx       # Failing SEO + a11y items (PT-BR)
│   │   ├── DiagnosticsGrid.tsx    # Resource breakdown: transfer size, blocking, image savings
│   │   ├── ScoreHistoryChart.tsx  # Line chart + CrUX 25-week real-user toggle
│   │   └── RunAuditButton.tsx     # Button with free-tier run counter
│   └── projects/
│       ├── PageTabs.tsx           # Sub-page navigation tabs
│       ├── ScheduleSelector.tsx   # Daily / hourly monitoring toggle
│       ├── AlertThresholds.tsx    # Per-project alert threshold config
│       └── DownloadPDFButton.tsx  # PDF download (Studio + Agência)
├── lib/
│   ├── api/
│   │   ├── pagespeed.ts           # PSI API client (all 4 Lighthouse categories)
│   │   └── crux-history.ts        # CrUX History API (25-week P75 data)
│   ├── ai/
│   │   └── action-plan.ts         # AI action plan generation (tiered model per plan)
│   ├── db/
│   │   ├── index.ts               # Drizzle + Neon client
│   │   └── schema.ts              # Single source of truth for all tables
│   ├── utils/
│   │   ├── metrics.ts             # CWV thresholds, gradeMetric, GRADE_STYLES
│   │   ├── plan-limits.ts         # PLAN_LIMITS per tier
│   │   ├── explanations.ts        # Static action plan fallback
│   │   └── schedule.ts            # nextNoonBRT, tomorrowNoonBRT
│   ├── alerts.ts                  # checkAndFireAlerts (threshold check + Resend)
│   ├── audit-runner.ts            # runAuditForProject (shared: manual + cron)
│   └── stripe.ts                  # Stripe client singleton
├── app/actions/
│   ├── projects.ts                # createProjectAction, deleteProjectAction
│   ├── billing.ts                 # createCheckoutSession, createBillingPortalSession
│   ├── alerts.ts                  # updateAlertThresholdsAction
│   └── schedule.ts                # updateScheduleAction
├── emails/
│   └── alert-email.tsx            # React Email alert template
├── types/
│   └── index.ts                   # PSIAuditData, LighthouseResult, AIActionItem, etc.
├── env.ts                         # Typed env validation (@t3-oss/env-nextjs + zod)
└── proxy.ts                       # Clerk middleware (Next.js 16: proxy.ts not middleware.ts)
```

---

## Local Development

### Prerequisites

- Node.js 20+ and pnpm
- Accounts: [Neon](https://neon.tech), [Clerk](https://clerk.com), [Google Cloud](https://console.cloud.google.com) (PSI + CrUX API key)

### 1. Clone & Install

```bash
git clone https://github.com/fepucinelli/perf-ally.git
cd perf-ally
pnpm install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
```

Minimum required to run locally:

```env
# Database (Neon)
DATABASE_URL=postgresql://...

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Google PSI + CrUX APIs
GOOGLE_API_KEY=AIza...

# AI — optional, falls back to static plan if missing
ANTHROPIC_API_KEY=sk-ant-...
```

Full Phase 2 features (billing, alerts) also need:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...   # Freelancer R$89
STRIPE_PRO_PRICE_ID=price_...       # Studio R$199
STRIPE_AGENCY_PRICE_ID=price_...    # Agência R$449
RESEND_API_KEY=re_...
```

### 3. Database Setup

```bash
# Push schema to your Neon database
pnpm exec drizzle-kit push --force

# Inspect data visually
pnpm db:studio
```

> **Note:** Use `pnpm exec drizzle-kit push --force` directly — `pnpm db:push` may fail due to double-dash argument parsing in pnpm scripts.

### 4. Start Dev Server

```bash
pnpm dev
```

Visit `http://localhost:3000`. Sign up → create a project → add pages → run an audit → view the report.

### 5. Local Stripe Webhooks (optional)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the printed whsec_... to STRIPE_WEBHOOK_SECRET in .env.local
```

### Common Commands

```bash
pnpm dev                             # Start dev server
pnpm build                           # Production build
pnpm lint                            # ESLint
pnpm exec tsc --noEmit              # Type check
pnpm exec drizzle-kit push --force  # Push schema changes to DB
pnpm db:studio                       # Drizzle Studio (visual DB explorer)
```

---

## How Audits Work

```
User clicks "Run Audit"
  → POST /api/projects/[id]/audit  { pageId }
    → Verify project + page ownership
    → PSI API call (all 4 Lighthouse categories: performance, seo, accessibility, best-practices)
    → DB insert — perf/SEO/a11y scores + Lighthouse JSON + CrUX P75 field data
    → Check alert thresholds → send email via Resend if exceeded
    → Fire-and-forget: CrUX History API (25 weeks) → update row
    → Await: generate AI action plan (Claude, tiered by plan) → update row
    → Return new audit result → client calls router.refresh()

Vercel Cron (hourly)
  → POST /api/cron/trigger-audits
    → Query projects where nextAuditAt ≤ now
    → Enqueue one QStash job per project per page
      → POST /api/jobs/run-audit?projectId=xxx&pageId=yyy
        → Same runAuditForProject() as the manual flow above
```

---

## Key Gotchas

- **`proxy.ts` not `middleware.ts`** — Next.js 16 Clerk middleware lives in `src/proxy.ts`
- **`timestamptz` not exported** — Drizzle ORM v0.45 doesn't export it; use `const timestamptz = (name: string) => timestamp(name, { withTimezone: true })`
- **drizzle-kit doesn't load `.env.local`** — `drizzle.config.ts` manually calls `config({ path: ".env.local" })` from dotenv
- **PSI multiple categories** — `URLSearchParams` can't duplicate keys via spread; use `.append("category", ...)` for each
- **CrUX CLS is ×100** — `CUMULATIVE_LAYOUT_SHIFT_SCORE` returns e.g. `10` meaning `0.10`; divide by 100
- **INP lab data is always null** — Lighthouse can't measure INP; use `cruxInp` (CrUX P75) as the only source
- **AI max_tokens: 4096** — responses with `steps[]` content regularly exceed 2048 tokens; the higher limit is required
- **`noUncheckedIndexedAccess: true`** — `array[0]` returns `T | undefined`; use optional chaining throughout
- **Tailwind v4** — CSS-based config (`@import "tailwindcss"` in globals.css); no `tailwind.config.ts`
- **Dashboard pages need `force-dynamic`** — `export const dynamic = "force-dynamic"` on every page that reads the Clerk session

---

## Deployment

Deploy to Vercel. Connect Neon via the Vercel integration for automatic `DATABASE_URL` per environment (production + preview branches).

Set all env vars in the Vercel dashboard, then wire:

1. **Clerk webhook** → `https://your-domain.com/api/webhooks/clerk` (events: `user.created`, `user.deleted`)
2. **Stripe webhook** → `https://your-domain.com/api/webhooks/stripe` (events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`)
3. **CrUX History API** → enable "Chrome UX Report API" in Google Cloud Console (same key as PSI)

---

## Docs

- [Architecture decisions](./docs/architecture.md) — every major tech choice and the reasoning behind it
- [Roadmap](./docs/roadmap.md) — all phases, feature breakdown, and pricing
