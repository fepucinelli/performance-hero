# Roadmap

Each phase is independently shippable and designed to deliver value before the next begins. Ship Phase 1 to validate demand before building Phase 2.

---

## Phase Overview

```
Phase 0 — Foundation  ✅  Infrastructure, auth, DB, CI/CD
Phase 1 — MVP         ✅  Core audit product, free tier live
Phase 2 — Pro         ✅  Paid plans, monitoring, AI, SEO audits, multi-page
Phase 3 — Agency      ✅  PDF reports, white-label branding, Clerk Organizations teams
Phase 4 — Growth          Integrations, virality, competitor analysis
Phase 5 — Scale           Public API, plugins, advanced auditing
```

---

## Phase 0 — Foundation ✅

**Goal:** Working Next.js app deployed to Vercel with auth, DB, and CI/CD. No product features yet.

- [x] Init Next.js 16.1.6 with TypeScript, Tailwind v4, shadcn/ui (new-york style)
- [x] Clerk auth (middleware, sign-in/sign-up pages)
- [x] Neon PostgreSQL + Drizzle ORM
- [x] Initial DB schema (users, projects, audit_results)
- [x] Vercel deployment (production + preview environments)
- [x] Sentry error tracking
- [x] `.env.example` with all variables documented
- [x] Protected dashboard layout skeleton

**Deliverable:** A deployed app where you can sign up, sign in, and see an empty dashboard.

---

## Phase 1 — MVP ✅

**Goal:** A developer or agency can plug in a URL, run a Lighthouse audit, and get a plain-English report. Free tier: 1 project, 5 manual runs/month.

- [x] URL input form with validation
- [x] PSI API integration (mobile + desktop) — all 4 Lighthouse categories in one call
- [x] Metric cards: LCP, INP, CLS, FCP, TTFB with color grading
- [x] CrUX field data display (P75 real-user values, with lab-only fallback)
- [x] Plain-English explanation for each metric
- [x] Static action plan: top prioritized issues extracted from Lighthouse audit list
- [x] Full Lighthouse audit list (collapsible, complete detail)
- [x] Project list dashboard (card grid)
- [x] Single project view with latest audit result
- [x] Free plan enforcement (1 project, 5 runs/month, 7-day history)
- [x] Public share link for audit results (no auth required to view)
- [x] Mobile vs Desktop strategy toggle

**Deliverable:** A publicly accessible product. Post on X / HN / Indie Hackers. Start collecting users.

**Success metric:** 100 free accounts created within the first month.

---

## Phase 2 — Pro ✅

**Goal:** Monetize. Scheduled monitoring, email alerts, historical trends, AI-powered action plans, SEO + accessibility audits, multi-page scanning, and CrUX History data justify the subscription.

### Billing & Plans
- [x] Stripe integration (Freelancer R$89/mês, Studio R$199/mês, Agência R$449/mês)
- [x] Stripe Customer Portal (self-service plan changes and cancellations)
- [x] Upgrade/downgrade flow from the dashboard
- [x] Plan enforcement gates with upgrade prompts throughout the UI

### Scheduled Monitoring
- [x] Per-project schedule field: `manual | daily | hourly`
- [x] Vercel Cron (hourly) + QStash fan-out for per-project job delivery
- [x] Daily audits fire at 15:00 UTC (noon BRT) via `nextNoonBRT()` scheduling
- [x] Hourly monitoring locked to Studio and Agência plans

### Email Alerts
- [x] Per-metric alert thresholds configurable per project (LCP, CLS, INP)
- [x] Email dispatch via Resend when a metric degrades past its threshold
- [x] Alert de-duplication (max 1 alert per project per hour)
- [x] Alert history visible in the dashboard

### Historical Trend Charts
- [x] Line chart: performance score over time
- [x] Tabs: Performance, LCP, FCP, CLS, INP, SEO
- [x] Run history indicators (color-coded dots for last 10 runs)
- [x] History window enforced by plan: Free=7d, Starter=30d, Pro=90d, Agency=1yr

### AI-Powered Action Plans
- [x] Tiered AI model per plan: Haiku (Freelancer) vs Sonnet (Studio + Agência)
- [x] Tiered monthly limits: Freelancer=5, Studio=30, Agência=unlimited
- [x] Stack auto-detection via Lighthouse `stackPacks` (Next.js, Nuxt, WordPress, etc.)
- [x] Context: all 5 CWV metrics + SEO + accessibility scores
- [x] File-specific recommendations — extracts actual resource names, wasted bytes, blocking times from Lighthouse audit details
- [x] Structured output: `title`, `action`, `steps[]`, `why`, `difficulty`, `stackTip`
- [x] Backtick-wrapped code in steps rendered as styled `<code>` elements in the UI
- [x] PT-BR output throughout
- [x] Cached in `audit_results.ai_action_plan` — never regenerated for the same audit
- [x] Graceful fallback to static plan (free users, quota reached, or API failure)

### SEO + Accessibility Audits
- [x] All 4 Lighthouse categories fetched in a single PSI call
- [x] `seo_score`, `accessibility_score`, `best_practices_score` stored in DB
- [x] Site Health card: composite score (perf×0.4 + seo×0.3 + a11y×0.3) displayed as headline
- [x] SEO + accessibility failing audit list with PT-BR labels

### Multi-Page Scanning
- [x] `project_pages` table — each project audits multiple sub-pages
- [x] Page tabs on the project view for navigating between pages
- [x] Auto-migration: existing projects get a default page from their primary URL
- [x] Per-page audit history (history, charts, and AI plan are scoped to the selected page)
- [x] Plan limits on pages per project: Free=2, Starter=10, Pro=50, Agency=unlimited

### Resource Diagnostics
- [x] Diagnostics grid: total transfer size, render-blocking resources, image savings, JS execution breakdown
- [x] Performance budget indicators (color-coded against thresholds)

### CrUX History API
- [x] 25 weeks of weekly P75 real-user data per metric
- [x] Stored in `audit_results.crux_history_raw` (JSONB, fire-and-forget)
- [x] "Usuários reais · 25 sem." toggle in history chart (LCP, FCP, CLS, INP)
- [x] Graceful degradation when URL isn't in CrUX dataset

### Public Share Pages
- [x] Per-audit share token (UUID, not sequential)
- [x] Full audit results accessible without authentication

**Deliverable:** First paying customers.

**Success metric:** MRR > R$900 after Phase 2 launch.

---

## Phase 3 — Agency ✅

**Goal:** Unlock the highest-value customer segment — agencies managing multiple client sites at R$449/mês.

### PDF Reports ✅
- [x] Executive summary page (composite score, grade, key findings)
- [x] Per-metric section (Core Web Vitals with lab + field values, explanations)
- [x] Full action plan — AI-generated or static fallback with difficulty ratings
- [x] SEO + Accessibility failing audit section
- [x] Multi-page summary table (when project has multiple pages)
- [x] Download from project page (Studio + Agência plans)
- [x] Report history — list of past generated PDFs with download links (project page)
- [x] PDFs saved to Vercel Blob; `reports` table records each generation

### White-Label (Agência plan only) ✅
- [x] Custom agency logo upload — Vercel Blob (production) / `public/uploads/` (local dev)
- [x] Custom accent color for every page's top bar
- [x] Custom agency name in header and page footer
- [x] Custom contact info in cover page footer
- [x] Branding settings UI at Settings → Marca da Agência (visible to Agency plan users only)
- [x] Logo rendered on PDF cover page using `@react-pdf/renderer`'s `<Image>` component

### Multi-User Teams (Clerk Organizations) ✅
- [x] Clerk Organizations enabled (manual step: Clerk Dashboard → Settings → Organizations)
- [x] `OrganizationSwitcher` in dashboard header (Agency plan users only)
- [x] Org-scoped project queries — projects scoped to active org or personal workspace
- [x] `org_id` set on project creation when an org session is active
- [x] Org-aware ownership checks across all routes and server actions
- [x] `getUserPlan` shared helper for clean plan lookups

### Not yet implemented (deferred to Phase 4)
- [ ] Project tags / grouping by client
- [ ] Bulk audit trigger (run all projects at once)
- [ ] Weekly digest email: performance summary across all monitored sites

**Deliverable:** Product-market fit for the agency segment. White-label drives referrals.

**Success metric:** 3 paying Agência plan customers.

---

## Phase 4 — Growth

**Goal:** Grow through integrations, product-led virality, and content.

- [ ] `/check` — public URL analyzer (top-of-funnel, no sign-up required)
- [ ] Slack alerts (in addition to email — Studio + Agência)
- [ ] Webhook notifications (custom HTTP endpoint per project)
- [ ] Embeddable performance badge (`<img>` tag showing current score)
- [ ] Competitor comparison: audit a competitor URL and compare side-by-side (Pro+)
- [ ] Refer-a-friend program
- [ ] Performance budget targets: set score goals per project, alert if missed
- [ ] Interactive onboarding with a demo project pre-loaded

**Deliverable:** Meaningful organic growth. Product advocates sharing badges and referrals.

---

## Phase 5 — Scale

**Goal:** Build the developer ecosystem around PerfAlly.

- [ ] Public REST API (API key management, `POST /v1/audits`, `GET /v1/projects`)
- [ ] GitHub Action (`perf-ally/audit-action` — posts a score diff comment on PRs)
- [ ] WordPress plugin (auto-register site, dashboard widget)
- [ ] Zapier / Make integration
- [ ] Custom Lighthouse configuration (requires a dedicated long-running worker — Fly.io or Railway)
- [ ] Multi-region scheduling (measure latency from US, EU, and APAC separately)

**Deliverable:** Developer-friendly platform. GitHub stars drive top-of-funnel.

---

## Adjacent Ideas (Post Phase 3)

Worth evaluating once core revenue is stable:

**One-time audit product**
A R$49 one-time purchase for a full PDF report with AI recommendations. No subscription. Targets consultants who need a client-ready deliverable without an ongoing commitment.

**Deploy-triggered regression detection**
"Did your last deploy break performance?" Integrates with Vercel, Netlify, and GitHub deploy webhooks. Automatically triggers an audit on each deploy and compares it to the previous baseline.

**Managed performance newsletter**
Weekly automated email: "Here's how your site changed vs last week." Personalized per project. Converts free users who don't log in regularly.

---

## Pricing

| Plan | DB key | Price | Projects | Pages/project | History | AI plans/mo |
|------|--------|-------|----------|---------------|---------|-------------|
| Grátis | `free` | R$0 | 1 | 2 | 7 days | — |
| Freelancer | `starter` | R$89/mês | 5 | 10 | 30 days | 5 |
| Studio | `pro` | R$199/mês | 20 | 50 | 90 days | 30 |
| Agência | `agency` | R$449/mês | 100 | Unlimited | 1 year | Unlimited |

> **DB note:** Enum values (`starter`, `pro`, `agency`) are fixed. Display names are UI-only and can change without a migration. Stripe requires new Price IDs if BRL amounts change.

**Feature distinctions by plan:**

| Feature | Grátis | Freelancer | Studio | Agência |
|---------|--------|------------|--------|---------|
| Manual audits | 5/mês | Unlimited | Unlimited | Unlimited |
| Scheduled monitoring | — | Daily | Hourly | Hourly |
| Email alerts | — | ✓ | ✓ | ✓ |
| Slack alerts | — | — | ✓ | ✓ |
| AI action plans | — | 5/mês (Haiku) | 30/mês (Sonnet) | Unlimited (Sonnet) |
| PDF reports | — | — | ✓ | ✓ (white-label) |
| History | 7 days | 30 days | 90 days | 1 year |

**Future pricing levers:**
- Annual billing (2 months free = ~17% discount)
- Usage-based add-ons (extra projects beyond plan limit)
- Lifetime deal (AppSumo) for an initial growth spike

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| PSI API rate limits | Use `GOOGLE_API_KEY`, cache results in Upstash Redis |
| CrUX data unavailable for small sites | Lab-only fallback with clear UI explanation |
| Chrome UX Report API not enabled | CrUX History silently degrades to null |
| PSI API downtime | QStash retries with exponential backoff |
| Lighthouse scores fluctuate between runs | Show trend lines, document test methodology |
| Churn from "set and forget" users | Weekly digest email re-engages inactive accounts |
| AI quota abuse | Monthly limit enforced per user in `maybeGenerateAIActionPlan` |
