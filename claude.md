# Performance Hero development guide

**Project:** SaaS web performance and SEO audit platform
**Current phase:** Phase 3 complete — Phases 0–3 shipped
**Stack:** Next.js 16.1.6, React 19, Drizzle ORM, Neon PostgreSQL, Stripe,
Tailwind CSS v4, TypeScript, Clerk

---

## Architecture principles

1. **Server-first** — use Server Actions over API routes when possible
2. **Type safety** — TypeScript strict mode throughout; no `any`
3. **Minimal queries** — select only needed fields, batch with `Promise.all()`,
   paginate large result sets
4. **Plan enforcement** — always check `users.plan` (not the Stripe API) before
   gating features

---

## Project structure

```
src/
├── app/
│   ├── (auth)/               # Sign-in / sign-up (Clerk)
│   ├── (dashboard)/          # Protected app routes
│   │   ├── dashboard/        # Project list
│   │   ├── projects/[id]/    # Project detail, page tabs, audit history
│   │   └── settings/         # Billing, alerts, branding
│   ├── (marketing)/          # Landing page
│   ├── share/[token]/        # Public read-only audit report
│   ├── actions/              # Server Actions (prefer over API routes)
│   │   ├── projects.ts
│   │   ├── billing.ts
│   │   ├── alerts.ts
│   │   ├── schedule.ts
│   │   └── branding.ts
│   └── api/
│       ├── webhooks/stripe/  # Subscription lifecycle
│       ├── webhooks/clerk/   # User sync to DB
│       ├── upload/logo/      # Logo upload → Vercel Blob
│       ├── projects/[id]/audit/   # Manual audit trigger
│       ├── projects/[id]/reports/ # PDF generation
│       ├── cron/trigger-audits/   # Vercel Cron → QStash fan-out
│       └── jobs/run-audit/        # QStash job handler
├── components/
│   ├── metrics/              # SiteHealthCard, MetricCard, ActionPlan, etc.
│   ├── projects/             # PageTabs, AlertThresholds, DownloadPDFButton, etc.
│   └── layout/               # Sidebar, org-switcher, user-menu
├── lib/
│   ├── api/
│   │   ├── pagespeed.ts      # PSI API client
│   │   └── crux-history.ts  # CrUX History API
│   ├── ai/
│   │   └── action-plan.ts   # Tiered AI action plan generation
│   ├── db/
│   │   ├── index.ts         # Drizzle + Neon client
│   │   └── schema.ts        # All table definitions
│   └── utils/
│       ├── metrics.ts        # CWV thresholds and grading
│       ├── plan-limits.ts    # PLAN_LIMITS constant
│       ├── validate-url.ts   # URL validation (blocks private IPs)
│       └── get-plan.ts       # getUserPlan(userId) helper
├── types/
│   └── index.ts             # Shared types: PSIAuditData, AIActionItem, etc.
├── env.ts                   # Typed env (@t3-oss/env-nextjs + Zod)
└── proxy.ts                 # Clerk middleware (Next.js 16 uses proxy.ts)
```

---

## Key files

| Area | File |
|------|------|
| DB client + schema | `src/lib/db/index.ts`, `src/lib/db/schema.ts` |
| Server Actions | `src/app/actions/*.ts` |
| Stripe | `src/lib/stripe.ts`, `src/app/actions/billing.ts` |
| AI action plans | `src/lib/ai/action-plan.ts` |
| Audit runner | `src/lib/audit-runner.ts` |
| Plan limits | `src/lib/utils/plan-limits.ts` |
| Types | `src/types/index.ts` |
| Env validation | `src/env.ts` |

---

## Database schema (summary)

Tables: `users`, `projects`, `project_pages`, `audit_results`, `alerts`,
`reports`.

Full schema: `src/lib/db/schema.ts`. Architecture decisions:
`docs/architecture.md`.

**Plan enum values** (fixed in DB — display names are UI-only):

| DB key | Display name | Price |
|--------|--------------|-------|
| `free` | Grátis | R$0 |
| `starter` | Freelancer | R$89/month |
| `pro` | Studio | R$199/month |
| `agency` | Agência | R$449/month |

---

## Coding patterns

### Server Actions

Prefer Server Actions over API routes for all authenticated data mutations.

```typescript
// src/app/actions/projects.ts
'use server'
import { auth } from "@clerk/nextjs/server"

export async function createProjectAction(...) {
  const { userId, orgId } = await auth()
  if (!userId) redirect("/sign-in")
  // ...
}
```

### Ownership queries

All project queries must check org or user ownership:

```typescript
const ownershipFilter = orgId
  ? and(eq(projects.id, projectId), eq(projects.orgId, orgId))
  : and(eq(projects.id, projectId), eq(projects.userId, userId))
```

### Query optimization

- Select only needed fields: `columns: { id: true, url: true }`
- Batch independent queries with `Promise.all()`
- Use indexed columns: `userId`, `projectId`, `createdAt`

---

## Plan enforcement

Plan limits live in `src/lib/utils/plan-limits.ts` (`PLAN_LIMITS` constant).

| Limit | Enforced in |
|-------|-------------|
| `maxProjects` | `createProjectAction` |
| `maxPagesPerProject` | `addPageAction` |
| `manualRunsPerMonth` | `POST /api/projects/[id]/audit` |
| `aiActionPlansPerMonth` | `maybeGenerateAIActionPlan` in `audit-runner.ts` |
| `historyDays` | Date filter on history queries |

---

## Stripe webhooks

Webhook handler: `src/app/api/webhooks/stripe/route.ts`

Handled events:
- `checkout.session.completed` — set plan + `stripeCustomerId` on user
- `customer.subscription.updated` — sync plan changes
- `customer.subscription.deleted` — downgrade to `free`

All signature verification uses `stripe.webhooks.constructEvent`. Always check
`users.plan` in the DB, not the Stripe API, to gate features.

---

## Background jobs

```
Vercel Cron (hourly)
  → POST /api/cron/trigger-audits   (protected by CRON_SECRET)
    → QStash: one job per due project page
      → POST /api/jobs/run-audit    (signature verified by Upstash Receiver)
          → runAuditForProject()
```

`runAuditForProject()` in `src/lib/audit-runner.ts` is the single shared
entry point for both manual and cron audits.

---

## AI action plans

Model selection is tiered by plan — see `src/lib/ai/action-plan.ts`:

| DB key | Model |
|--------|-------|
| `free` | — (static fallback only) |
| `starter` | `claude-haiku-4-5-20251001` |
| `pro` | `claude-sonnet-4-6` |
| `agency` | `claude-sonnet-4-6` |

The static fallback in `src/lib/utils/explanations.ts` always runs when AI is
unavailable (missing key, quota reached, API error).

---

## Common gotchas

- **`proxy.ts` not `middleware.ts`** — Next.js 16 Clerk middleware is in
  `src/proxy.ts`
- **drizzle-kit + `.env.local`** — `drizzle.config.ts` loads it manually via
  `dotenv`; use `pnpm exec drizzle-kit push --force` (not `pnpm db:push`)
- **INP has no lab value** — `crux_inp` (CrUX P75) is the only INP source;
  `audit_results.inp` is always null
- **CrUX CLS is ×100** — divide `CUMULATIVE_LAYOUT_SHIFT_SCORE` by 100 before
  grading
- **`noUncheckedIndexedAccess: true`** — `array[0]` returns `T | undefined`;
  use optional chaining
- **Tailwind v4** — CSS-based config via `@import "tailwindcss"` in
  `globals.css`; no `tailwind.config.ts`
- **Logo URLs must be absolute for PDF** — `@react-pdf/renderer` can't resolve
  relative paths; the reports route converts them using the request origin
- **Clerk Organizations** — must be enabled manually in Clerk Dashboard →
  Settings → Organizations; `orgId` is available from `auth()`

---

## Commands

```bash
pnpm dev                             # Start dev server
pnpm build                           # Production build
pnpm lint                            # ESLint
pnpm exec tsc --noEmit              # Type check
pnpm exec drizzle-kit push --force  # Push schema to Neon
pnpm db:studio                       # Drizzle Studio (visual DB explorer)
```

---

## Docs

- [`docs/architecture.md`](./docs/architecture.md) — tech decisions and
  reasoning
- [`docs/roadmap.md`](./docs/roadmap.md) — phases, features, and pricing

---

**Last updated:** March 1, 2026
**Maintainer:** Felipe Pucinelli
