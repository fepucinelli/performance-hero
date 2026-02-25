# Phase 4 — Growth

**Goal:** Product virality, integrations, AI-powered explanations, competitor analysis.
**Duration:** 4–8 weeks (parallel tracks, prioritize by demand)
**Depends on:** Phase 2+ live with paying customers

---

## Features (prioritize by user demand)

### Track A — Virality & Distribution

#### 1. Public Performance Badge

An embeddable SVG badge showing current performance score:

```
┌──────────────────────────────────┐
│  ⚡ PerfAlly            │
│  mysite.com    ■■■■□□  72/100   │
└──────────────────────────────────┘
```

```typescript
// GET /api/badge/[projectId]
// Returns SVG, cached for 24h
export async function GET(req, { params }) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, params.projectId),
    with: {
      latestAudit: {
        columns: { perfScore: true, createdAt: true }
      }
    }
  })

  const score = project?.latestAudit?.perfScore ?? 0
  const color = score >= 90 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626"

  const svg = generateScoreBadge(project.name, score, color)

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    }
  })
}
```

Embed code shown in dashboard:
```html
<a href="https://performanceradar.com">
  <img src="https://performanceradar.com/api/badge/[projectId]" alt="Performance Score">
</a>
```

Virality mechanism: every badge click leads back to PerfAlly with a "Check your site free" CTA.

#### 2. "One-time Report" Landing Page

`/check` — a public-facing URL analyzer:
1. Enter URL → runs PSI audit (no account required)
2. Shows preview results (score + grades)
3. Gate: "Sign up free to see the full action plan"

This is a top-of-funnel acquisition tool. Drive traffic here from:
- Blog posts
- Social media
- SEO (rank for "test website performance free")

Different from the main dashboard — it's a conversion-optimized single page.

#### 3. Refer-a-Friend

Simple referral system:
- User gets a referral link (`/r/[code]`)
- Referred user signs up + subscribes → referrer gets 1 month free
- Track via `referrals` table: `referrer_id`, `referred_id`, `credited_at`

---

### Track B — Integrations

#### 4. Slack Alerts

```bash
pnpm add @slack/webhook
```

```typescript
// In project settings: enter Slack Webhook URL
// When alert fires, also POST to Slack if configured

const slackWebhook = new IncomingWebhook(project.slackWebhookUrl)
await slackWebhook.send({
  text: `⚠️ Performance degraded on ${project.name}`,
  blocks: [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*LCP:* 4.2s (was 2.1s)\n*CLS:* 0.31 (was 0.09)` }
    },
    {
      type: "actions",
      elements: [{ type: "button", text: { text: "View Report" }, url: auditUrl }]
    }
  ]
})
```

#### 5. Webhook Notifications

```typescript
// project settings: add webhook URLs
export const projectWebhooks = pgTable("project_webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id),
  url: text("url").notNull(),
  events: text("events").array().default(["audit.completed", "alert.triggered"]),
  secret: text("secret"),  // HMAC signing
  createdAt: timestamptz("created_at").default(sql`NOW()`),
})
```

On audit complete, POST to all webhooks:
```json
{
  "event": "audit.completed",
  "project_id": "...",
  "url": "https://mysite.com",
  "scores": {
    "performance": 72,
    "lcp": 2800,
    "cls": 0.12,
    "inp": 230
  },
  "grades": { "lcp": "needs-improvement", "cls": "good", "inp": "good" }
}
```

Sign payload with HMAC-SHA256 using the webhook secret.

---

### Track C — AI-Powered Action Plans → ✅ Promoted to Phase 2

#### 6. Claude-Powered Recommendations

Replace static `AUDIT_ACTIONS` lookup with Claude API calls for personalized insights.

```bash
pnpm add @anthropic-ai/sdk
```

```typescript
// src/lib/ai/action-plan.ts
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generateAIActionPlan(
  url: string,
  audit: AuditResult,
  topFailedAudits: string[]
) {
  const prompt = `
You are a web performance expert helping a non-technical founder fix their website.

Site URL: ${url}
Performance Score: ${audit.perfScore}/100
Failed audits: ${topFailedAudits.join(", ")}

Key metrics:
- LCP: ${audit.lcp ? (audit.lcp/1000).toFixed(1) + "s" : "N/A"} (target: < 2.5s)
- CLS: ${audit.cls?.toFixed(3) ?? "N/A"} (target: < 0.1)
- INP: ${audit.inp ? audit.inp + "ms" : "N/A"} (target: < 200ms)

Write 3–5 specific, actionable recommendations for this site.
- Write for a non-technical business owner, not a developer
- Each recommendation: what to do, why it matters, difficulty (Easy/Medium/Hard)
- Be specific to the actual issues detected, not generic advice
- Keep each recommendation under 50 words

Format as JSON array:
[{ "title": "...", "action": "...", "why": "...", "difficulty": "Easy|Medium|Hard" }]
`

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",  // Fast + cheap for this use case
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  })

  const text = message.content[0].type === "text" ? message.content[0].text : ""
  return JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? "[]")
}
```

**Gate this to Pro+ plan.** Free tier gets static explanations. Cache AI responses per audit ID (don't regenerate for same audit).

**Cost estimate:** Claude Haiku is ~$0.25/MTok input + $1.25/MTok output. Each recommendation call is ~500 tokens total. At $0.001/call, 1,000 reports/month = $1. Negligible.

---

### Track D — Analytics & Competitive Intelligence

#### 7. Competitor Comparison

```typescript
// /projects/[id]/compare
// User enters a competitor URL
// Runs PSI audit on competitor (temp, not saved as a project)
// Side-by-side comparison table
```

UI:
```
         Your Site        Competitor
LCP      2.1s ✅          3.8s ❌
CLS      0.08 ✅          0.24 ⚠️
INP      180ms ✅         420ms ❌
Score    84               61

→ You beat them on performance. Use this in your marketing.
→ Share comparison →
```

Available on Pro+ plan. The competitor audit is not saved as a project — just a one-time comparison. Store in a `comparisons` table if you want to show history.

#### 8. SEO + Accessibility Score Integration

PSI already runs Lighthouse SEO and Accessibility categories — just surface them.

Add to `audit_results`:
```typescript
seoScore: real("seo_score"),
accessibilityScore: real("accessibility_score"),
bestPracticesScore: real("best_practices_score"),
```

Add a combined "Site Health" score:
```typescript
const siteHealth = Math.round(
  (perfScore * 0.4) + (seoScore * 0.3) + (accessibilityScore * 0.3)
)
```

Show all four Lighthouse category scores in a 2x2 grid on the project page.

---

### Track E — Retention

#### 9. CrUX History API (25 weeks)

```typescript
// GET https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord
const response = await fetch(
  "https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=" + GOOGLE_API_KEY,
  {
    method: "POST",
    body: JSON.stringify({
      origin: new URL(url).origin,
      metrics: ["largest_contentful_paint", "cumulative_layout_shift", "interaction_to_next_paint"],
    })
  }
)
```

Returns 25 weeks of weekly P75 field data. Use to extend the historical chart beyond what we have in our DB.

#### 10. Performance Budget

```typescript
// project settings: set targets per metric
export const performanceBudgets = pgTable("performance_budgets", {
  projectId: uuid("project_id").primaryKey().references(() => projects.id),
  perfScoreMin: real("perf_score_min").default(70),
  lcpMax: real("lcp_max").default(2500),
  clsMax: real("cls_max").default(0.1),
  inpMax: real("inp_max").default(200),
})
```

After each audit, check against budget. Show "OVER BUDGET" badge in project list if exceeded. Alert when budget breached.

#### 11. Demo Project

Auto-create a demo project for new users showing pre-loaded data:

```typescript
// src/app/api/webhooks/clerk/route.ts (in user.created handler)
await createDemoProject(userId)  // Creates project + 30 days of fake audit history
```

Demo project shows the full product value immediately, without requiring a real URL. Include a "Replace with your URL" CTA on the project.

---

## Content Marketing (parallel to code)

Phase 4 is also when you should invest in content:

1. **Blog posts** (rank for SEO):
   - "What is LCP and why does it affect your sales?"
   - "5 quick wins to improve Core Web Vitals for non-developers"
   - "WordPress Core Web Vitals guide 2025"
   - "How Core Web Vitals affect Google rankings"

2. **Free tools** (link building + virality):
   - `/tools/lighthouse-score-checker` — public Lighthouse checker (drives signups)
   - `/tools/cwv-calculator` — explains what your score means

3. **Comparison pages** (convert from competitors):
   - "PerfAlly vs Google Search Console"
   - "PerfAlly vs PageSpeed Insights"

---

## Definition of Done

Prioritize by what your users are actually asking for. Don't build all of this — pick 2–3 items from each track based on feedback.

**Minimum for Phase 4 ship:**
- [ ] Public badge endpoint working
- [ ] /check public URL analyzer live
- [ ] Slack alerts working (high demand from Pro users)
- [ ] AI action plans on Pro tier
- [ ] SEO + Accessibility scores surfaced

**Stretch:**
- [ ] Competitor comparison
- [ ] CrUX History integration
- [ ] Referral system
