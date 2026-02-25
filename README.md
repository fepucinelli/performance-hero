# PerfAlly

> "Core Web Vitals para founders, não para engenheiros."

A SaaS for web performance monitoring targeting small businesses and agencies. Enter a URL, get a plain-language diagnosis of your Core Web Vitals, a prioritized action plan, and scheduled alerts when things regress.

---

## What It Is

Most small companies don't know what Core Web Vitals are, or can't configure enterprise tools like Datadog, SpeedCurve, or Calibre. PerfAlly fills the gap: opinionated, simple, and actionable.

**Key differentiators:**
- No jargon — every metric explained in plain language
- Actionable fix guidance, not just scores
- CrUX field data (real user experience) + Lighthouse lab data in one API call
- Scheduled monitoring with email alerts when thresholds are crossed
- PDF reports ready to send to clients (agency tier, Phase 3)
- Priced for the Brazilian market (R$99–499/month)

---

## Monetization

| Plano    | Preço       | Projetos | Auditorias     | Alertas | Relatórios PDF |
|----------|-------------|----------|----------------|---------|----------------|
| Free     | Grátis      | 1        | 10 manual/mês  | -       | -              |
| Starter  | R$99/mês    | 5        | Diário         | E-mail  | -              |
| Pro      | R$249/mês   | 20       | Por hora       | E-mail  | Sim            |
| Agência  | R$499/mês   | 100      | Por hora       | E-mail  | White-label    |

---

## Tech Stack

| Layer        | Choice                    | Why                                          |
|--------------|---------------------------|----------------------------------------------|
| Framework    | Next.js 16.1.6 (App Router) | Full-stack, Vercel-native                  |
| Language     | TypeScript (strict)       | Type-safe end-to-end                         |
| Styling      | Tailwind CSS v4 + shadcn/ui | CSS-based config, new-york style           |
| Database     | Neon (serverless Postgres) | Serverless, free tier, Drizzle-compatible   |
| ORM          | Drizzle ORM v0.45         | Lightweight, type-safe, fast migrations      |
| Auth         | Clerk v6                  | Best SaaS auth DX, handles orgs for Phase 3 |
| Payments     | Stripe                    | Subscriptions + Customer Portal              |
| Email        | Resend + React Email      | Developer-friendly, great deliverability     |
| Queue/Jobs   | Upstash QStash            | Serverless job queue for scheduled audits    |
| Cache        | Upstash Redis             | Rate limiting + deduplication                |
| Storage      | Vercel Blob               | PDF report storage (Phase 3)                 |
| Lighthouse   | PageSpeed Insights API v5 | Free — returns Lighthouse + CrUX in one call |
| Charts       | Recharts                  | Composable, React-native                     |
| PDF          | @react-pdf/renderer       | Works on Vercel Functions (no headless)      |
| AI           | Anthropic (Phase 4)       | Action plan generation via claude-haiku      |
| Deployment   | Vercel                    | Zero-config, cron support                    |

---

## Project Structure

```
perf-ally/
├── src/
│   ├── app/
│   │   ├── (auth)/               # Clerk sign-in / sign-up pages
│   │   ├── (dashboard)/          # Protected app routes
│   │   │   ├── dashboard/        # Overview page
│   │   │   ├── projects/         # Project list + detail + new
│   │   │   └── settings/         # Billing + account settings
│   │   ├── (marketing)/          # Public landing + pricing page
│   │   ├── actions/              # Server Actions (projects, billing, alerts)
│   │   ├── api/
│   │   │   ├── projects/[id]/audit/  # POST → run audit
│   │   │   ├── cron/audit/           # Hourly cron trigger
│   │   │   └── webhooks/stripe/      # Stripe webhook handler
│   │   └── share/[token]/        # Public shareable report
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives
│   │   ├── layout/               # Sidebar, UserMenu
│   │   ├── metrics/              # ScoreGauge, MetricCard, ActionPlan, AuditList
│   │   └── projects/             # ScheduleSelector, AlertThresholds, ScoreHistoryChart
│   ├── emails/
│   │   └── alert-email.tsx       # React Email template for performance alerts
│   ├── lib/
│   │   ├── db/                   # Drizzle schema (5 tables) + client
│   │   ├── api/                  # PageSpeed Insights client
│   │   ├── alerts.ts             # Alert evaluation + Resend integration
│   │   ├── audit-runner.ts       # Orchestrates PSI call → save → alert check
│   │   ├── stripe.ts             # Stripe client singleton
│   │   └── utils/                # Metric grading, explanations, plan limits
│   ├── types/
│   │   └── index.ts              # Shared TypeScript types
│   ├── env.ts                    # Typed env validation (@t3-oss/env-nextjs)
│   └── proxy.ts                  # Clerk middleware (Next.js 16 convention)
└── drizzle/                      # DB migration files
```

---

## Roadmap

| Phase | Name       | Status       | What ships                                    |
|-------|------------|--------------|-----------------------------------------------|
| 0     | Foundation | ✅ Done      | Scaffold, auth, DB, Vercel deploy             |
| 1     | MVP        | ✅ Done      | URL → report, scores, action plan, free tier  |
| 2     | Pro        | ✅ Done      | Stripe subscriptions, cron alerts, history charts |
| 3     | Agency     | Planned      | PDF reports, white-label, team accounts       |
| 4     | Growth     | Planned      | AI plans (Claude), competitor compare, badges |
| 5     | Scale      | Planned      | Public API, GitHub Action, Zapier             |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`)
- A [Neon](https://neon.tech) database
- A [Clerk](https://clerk.com) application
- A [Google Cloud](https://console.cloud.google.com) project with **PageSpeed Insights API** enabled

### 1. Clone and install

```bash
git clone https://github.com/fepucinelli/perf-ally.git
cd perf-ally
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` — see the comments in `.env.example` for where to get each value.

**Required to run locally:**

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | [neon.tech](https://neon.tech) → Project → Connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [clerk.com](https://clerk.com) → API Keys |
| `CLERK_SECRET_KEY` | [clerk.com](https://clerk.com) → API Keys |
| `GOOGLE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) → Credentials |

**Required for paid features (Phase 2):**

| Variable | Where to get it |
|---|---|
| `STRIPE_SECRET_KEY` | [Stripe Dashboard](https://dashboard.stripe.com) → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen --forward-to localhost:3000/api/webhooks/stripe` |
| `STRIPE_STARTER_PRICE_ID` | Create products in Stripe Dashboard |
| `STRIPE_PRO_PRICE_ID` | Create products in Stripe Dashboard |
| `STRIPE_AGENCY_PRICE_ID` | Create products in Stripe Dashboard |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys |
| `UPSTASH_REDIS_REST_URL` | [console.upstash.com](https://console.upstash.com) → Redis |
| `UPSTASH_REDIS_REST_TOKEN` | [console.upstash.com](https://console.upstash.com) → Redis |
| `QSTASH_TOKEN` | [console.upstash.com](https://console.upstash.com) → QStash |

### 3. Push the database schema

```bash
pnpm exec drizzle-kit push --force
```

### 4. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. (Optional) Test Stripe webhooks locally

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook signing secret printed by the CLI into `STRIPE_WEBHOOK_SECRET` in `.env.local`.

---

## Key Architectural Decisions

- **Single PSI call** — PageSpeed Insights API v5 returns both Lighthouse lab data and CrUX field data in one request. No separate CrUX API needed until Phase 4.
- **No Puppeteer** — `@react-pdf/renderer` generates PDFs at the server level without a headless browser, which is incompatible with Vercel Functions.
- **Vercel Cron → QStash fan-out** — The hourly cron at `/api/cron/audit` triggers QStash jobs per project, keeping each invocation within Vercel's function timeout.
- **Plan stored in DB** — Stripe Customer ID and plan name are written to the `users` table on `checkout.session.completed`. All plan checks read from the DB, not Stripe, to avoid extra API calls.
- **Tailwind CSS v4** — CSS-based config via `@import "tailwindcss"` in `globals.css`. No `tailwind.config.ts`.
- **`proxy.ts` for Clerk** — Next.js 16 uses `proxy.ts` (not `middleware.ts`) for edge middleware.
- **`noUncheckedIndexedAccess: true`** — Array accesses return `T | undefined`. Use optional chaining throughout.
- **CrUX field shape** — The PSI API returns CrUX P75 values as a flat integer under the key `percentile`, not `percentiles.p75`. CLS is stored ×100 in CrUX (e.g. `10` → `0.10`) and must be divided before storing. `originLoadingExperience` is used as a fallback when page-level `loadingExperience` metrics are absent.
- **INP has no lab value** — Lighthouse cannot measure INP without real user interactions. `inp` is always `null` from lab data; only `cruxInp` from CrUX carries a real value.
- **Authenticated root redirect** — The Clerk middleware (`proxy.ts`) redirects logged-in users from `/` to `/dashboard` at the edge.

---

## Scripts

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # ESLint
pnpm tsc          # TypeScript type check
pnpm db:push      # Push schema to DB (pnpm exec drizzle-kit push --force)
pnpm db:studio    # Open Drizzle Studio
```

---

## License

MIT
