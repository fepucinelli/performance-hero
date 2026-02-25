# Roadmap

Each phase is designed to be independently shippable and generate value. Ship Phase 1 to validate demand before building Phase 2.

---

## Phase Overview

```
Phase 0 — Foundation ✅     (Week 1–2)    Infrastructure, scaffold, CI/CD
Phase 1 — MVP ✅            (Week 3–5)    Core product, free tier live
Phase 2 — Pro ✅            (Week 6–8)    Paid subscriptions, alerts, history
Phase 3 — Agency            (Week 9–12)   PDF reports, teams, white-label
Phase 4 — Growth            (Month 4–6)   Integrations, AI explanations, SEO
Phase 5 — Scale             (Month 6+)    API, plugins, advanced auditing
```

---

## Phase 0 — Foundation

**Goal:** Working Next.js app deployed to Vercel, with auth, DB, and CI/CD in place. No product features yet.

**Checklist:**
- [x] Init Next.js 16.1.6 with TypeScript, Tailwind, shadcn/ui
- [x] Configure Clerk (auth middleware, sign-in/sign-up pages)
- [x] Set up Neon PostgreSQL + Drizzle ORM
- [x] Create initial DB schema (users, projects, audit_results)
- [x] Deploy to Vercel (production + preview envs)
- [x] Set up Sentry for error tracking
- [x] `.env.example` with all required variables documented
- [x] Basic landing page (can be placeholder)
- [x] Protected dashboard skeleton (just the layout, no data)

**Deliverable:** A deployed app where you can sign up, sign in, and see an empty dashboard.

See [`phase-0-foundation.md`](./phase-0-foundation.md) for detailed steps.

---

## Phase 1 — MVP

**Goal:** A founder can plug in a URL, run a Lighthouse audit, and get a plain-English report. Free tier: 1 project, 10 manual runs.

**Checklist:**
- [x] URL input form with validation
- [x] PSI API integration (mobile + desktop strategy)
- [x] Parse and store audit results in DB
- [x] Metric cards: LCP, INP, CLS, FCP, TTFB with color grading
- [x] Plain-English explanation for each metric
- [x] Action Plan section: top 5 prioritized issues from audit
- [x] Lighthouse audit list (collapsible, full detail available)
- [x] CrUX field data display (with fallback if not available)
- [x] Project list page
- [x] Single project view with latest audit
- [x] Free plan enforcement (1 project, 10 runs/month)
- [x] "Share" link for public audit results (no auth required to view)

**Nice to have (if time allows):**
- [x] Mobile vs Desktop toggle
- [x] Keyboard shortcut to re-run audit

**Deliverable:** A publicly accessible product. Post on X/HN/Indie Hackers. Start collecting waitlist emails.

**Success metric:** 100 free accounts created within first month.

See [`phase-1-mvp.md`](./phase-1-mvp.md) for detailed steps.

---

## Phase 2 — Pro

**Goal:** Monetize. Scheduled monitoring, email alerts, historical trend charts, and AI-powered action plans justify the subscription price.

**Checklist:**
- [x] Stripe integration (Starter R$99/month, Pro R$249/month, Agência R$499/month)
- [x] Stripe Customer Portal (self-service subscription management)
- [x] Upgrade/downgrade flow from dashboard
- [x] Plan enforcement gates on dashboard (upgrade prompts)
- [x] Scheduled audits via Vercel Cron + QStash
  - [x] Projects have `schedule` field (manual | daily | hourly)
  - [x] Cron trigger runs every hour, fans out to QStash jobs
  - [x] Each job: calls PSI, stores result, checks alert conditions
- [x] Email alerts (via Resend) when metrics degrade past threshold
  - [x] Per-metric thresholds configurable per project
  - [x] Alert history in dashboard
  - [x] Unsubscribe/mute support
- [x] Historical trend charts (last 30 days by default)
  - [x] Line chart: performance score over time
  - [x] Line chart: each CWV over time
  - [x] Regression detection (show when score dropped)
- [x] Multi-project dashboard (card grid overview)
- [x] Improved project settings page
- [x] AI-powered action plans (Claude Haiku) — promoted from Phase 4
  - [x] Tiered limits: Starter=5/mo, Pro=30/mo, Agency=unlimited
  - [x] Stack auto-detection via Lighthouse stackPacks
  - [x] All 5 CWV metrics in context (LCP, INP, CLS, FCP, TTFB)
  - [x] PT-BR output for non-technical founders
  - [x] Cached in audit_results.ai_action_plan (no regeneration cost)
  - [x] Graceful fallback to static plan if API key missing or limit reached

**Deliverable:** First paying customers. Goal: 10 paying customers by end of Phase 2.

**Success metric:** MRR > $200 after launch.

See [`phase-2-pro.md`](./phase-2-pro.md) for detailed steps.

---

## Phase 3 — Agency

**Goal:** Unlock the agency use case — the highest-value customers who pay $99/month and manage multiple client sites.

**Checklist:**
- [ ] Agency plan ($99/month, 100 projects)
- [ ] PDF report generation (@react-pdf/renderer)
  - [ ] Branded PerfAlly header
  - [ ] Executive summary (score, grade, key findings)
  - [ ] Per-metric section with explanation + recommendations
  - [ ] Action plan table
  - [ ] Historical chart (last 30 days) embedded as image
- [ ] White-label PDF reports (Pro/Agency)
  - [ ] Custom logo upload (Vercel Blob)
  - [ ] Custom accent color
  - [ ] Custom footer text (agency name, contact info)
- [ ] Multi-user (teams via Clerk Organizations)
  - [ ] Invite team members
  - [ ] Role: Owner, Member
  - [ ] Billing tied to Organization, not individual
- [ ] Project tags/grouping (group by client)
- [ ] Bulk audit: trigger all projects at once
- [ ] Scheduled weekly digest email (summary of all projects)

**Deliverable:** Product-market fit for the agency segment. Unlock referrals via white-label.

**Success metric:** 3 agency plan customers.

See [`phase-3-agency.md`](./phase-3-agency.md) for detailed steps.

---

## Phase 4 — Growth

**Goal:** Grow via integrations, content, and product-led virality.

**Checklist:**
- [ ] Slack alerts (in addition to email)
- [ ] Webhook notifications (custom HTTP endpoint)
- [ ] Public performance badge (embeddable `<img>` showing current score)
  - [ ] `GET /api/badge/{projectId}` returns SVG
  - [ ] Powers product virality — badge links back to PerfAlly
- [ ] Competitor comparison
  - [ ] Compare your site vs competitor URL side-by-side
  - [ ] Available on Pro+
- [x] AI-powered action plans (Claude API) → ✅ Promoted to Phase 2
  - [x] Instead of static explanations, generate personalized recommendations
  - [x] Context-aware: explain WHY the fix matters for their type of site
  - [x] Prompt includes audit JSON + site URL + stack auto-detection
- [ ] SEO score integration
  - [ ] Lighthouse SEO audit scores (already in Lighthouse, just surface them)
  - [ ] Combined "Site Health" score (performance + SEO + accessibility)
- [ ] CrUX History API integration (25 weeks of field data)
- [ ] "Performance Budget" feature
  - [ ] Set target scores per project
  - [ ] Alert if budget is exceeded after a deploy
- [ ] Onboarding improvements
  - [ ] Interactive first-run experience
  - [ ] Demo project (pre-loaded with example data)

**Deliverable:** Meaningful organic growth. Product advocates.

See [`phase-4-growth.md`](./phase-4-growth.md) for detailed steps.

---

## Phase 5 — Scale

**Goal:** Build the ecosystem around PerfAlly. Developer-friendly features and platform integrations.

**Checklist:**
- [ ] Public REST API
  - [ ] API key management in dashboard
  - [ ] POST /v1/audits — trigger an audit
  - [ ] GET /v1/audits/{id} — get result
  - [ ] GET /v1/projects — list projects
  - [ ] Documented with OpenAPI spec
  - [ ] Rate-limited per plan
- [ ] GitHub Action
  - [ ] `perf-ally/audit-action`
  - [ ] Runs audit on PR, posts comment with score diff
  - [ ] Blocks merge if performance regresses beyond budget
- [ ] WordPress plugin
  - [ ] Auto-registers site on install
  - [ ] Shows dashboard widget with current scores
- [ ] Zapier / Make integration
  - [ ] Trigger: "Audit completed"
  - [ ] Trigger: "Score degraded"
  - [ ] Action: "Run audit"
- [ ] Custom Lighthouse configuration
  - [ ] Block third-party requests
  - [ ] Custom throttling profiles
  - [ ] Requires dedicated worker (Fly.io) — not PSI API
- [ ] Multi-region scheduling
  - [ ] Run audits from US, EU, APAC
  - [ ] Show latency variance by region

**Deliverable:** Developer-friendly platform. Referrals from GitHub stars.

See [`phase-5-scale.md`](./phase-5-scale.md) for detailed steps.

---

## Complementary Ideas to Explore

These are adjacent ideas worth evaluating once core revenue is stable:

### "One-time audit" product (Phase 3+)
A $29 one-time purchase for a full report PDF with custom recommendations. No subscription. Targets consultants and freelancers who need a deliverable for a client. Zero account required.

### Performance regression as a service (Phase 5)
"Did your last deploy break performance?" integrates with Vercel, Netlify, GitHub deploy hooks. When a new deploy happens, auto-trigger an audit and compare with previous. Email if regression > 10%.

### Lighthouse as an API (Phase 5)
White-label the audit engine. Charge per-call for developers who want Lighthouse results without running infra. Simple pricing: $0.01/audit. Targets agencies building their own tools.

### Managed CrUX insights newsletter (Phase 4)
Weekly email: "Here's how your site changed vs last week." Personalized, automated, no dashboard needed. Converts free users who don't log in.

### Vertical SaaS editions (Phase 5+)
- PerfAlly for Shopify (connect store, auto-detect product/checkout pages)
- PerfAlly for WordPress (plugin-based, auto-discover posts)
- PerfAlly for Next.js (GitHub integration, per-route tracking)

---

## Pricing Evolution Path

**Start (Phase 1):**
- Free: 1 project, manual only

**Phase 2:**
- Free: 1 project, 10 runs/month
- Starter R$99: 5 projects, daily monitoring, email alerts
- Pro R$249: 20 projects, hourly monitoring, all alerts

**Phase 3:**
- Add Agência R$499: 100 projects, teams, PDF reports, white-label

**Phase 4+:**
- Consider annual pricing (2 months free = 17% discount)
- Consider usage-based add-ons (extra projects, extra runs)
- Consider LTD (lifetime deal) on AppSumo for growth spike

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| PSI API rate limits | Use API key, cache results, Upstash rate limiter |
| CrUX data unavailable for small sites | Lab-only mode with clear UI explanation |
| PSI API goes down | Retry with exponential backoff in QStash |
| Lighthouse scores fluctuate between runs | Show moving average, document methodology |
| Low CWV awareness in SMB market | Content marketing, education in onboarding |
| Churn due to "set and forget" | Weekly digest email keeps users engaged |
