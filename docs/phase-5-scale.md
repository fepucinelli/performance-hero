# Phase 5 — Scale

**Goal:** Developer ecosystem. Public API, GitHub integration, plugin marketplace.
**Duration:** Ongoing, ship incrementally
**Depends on:** Proven product with stable revenue

---

## This Phase is Different

Phase 5 isn't a single sprint — it's a set of independent features you can ship one by one, each opening new acquisition channels. Prioritize by what will drive the most growth for your specific user base at that point.

---

## Features

### 1. Public REST API

Opens PerfAlly to developers and B2B integrations.

**Endpoint design:**
```
POST /v1/audits              → Trigger a new audit
GET  /v1/audits/:id          → Get audit result
GET  /v1/projects            → List projects
GET  /v1/projects/:id        → Get project + latest audit
GET  /v1/projects/:id/history → Get audit history
```

**API Key management:**
```typescript
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(), // bcrypt hash
  keyPrefix: text("key_prefix").notNull(),       // "pr_live_xxxx" first 8 chars
  lastUsedAt: timestamptz("last_used_at"),
  expiresAt: timestamptz("expires_at"),
  createdAt: timestamptz("created_at").default(sql`NOW()`),
})
```

Show key once on creation (store only hash). Prefix: `pr_live_` for production, `pr_test_` for test mode.

**Rate limiting:** Enforce same plan limits as dashboard. API calls count against the same quota.

**OpenAPI spec:** Auto-generate with `zod-openapi` or handwrite a `openapi.yaml`. Host docs at `/developers`.

### 2. GitHub Action

```yaml
# .github/workflows/performance.yml
- uses: perf-ally/audit-action@v1
  with:
    url: ${{ env.DEPLOY_URL }}
    api-key: ${{ secrets.PERFORMANCE_RADAR_KEY }}
    budget-score: 80
    fail-on-regression: true
```

The action:
1. Calls `POST /v1/audits` with the deploy URL
2. Polls until result is ready (PSI takes ~8–10s)
3. Posts PR comment with score diff vs main branch
4. Fails the check if score drops below `budget-score` or regresses by > 10 points

**PR comment example:**
```
⚡ PerfAlly

                 This PR    Base     Diff
Performance      78         85       ▼ -7 pts
LCP              2.9s       2.1s     ▼ Needs improvement
CLS              0.04       0.05     ▲ Improved
INP              210ms      180ms    ▼

⚠️ Performance regressed. Review changes before merging.
View full report →
```

Build as a separate public repo: `perf-ally/audit-action`. Marketplace listing drives discovery.

### 3. Deploy Webhook Integration

Connect with Vercel, Netlify, Render, Fly.io — auto-trigger audits on deploy:

```typescript
// POST /api/integrations/deploy-hook
// Accepts webhooks from deploy platforms
// Extracts deploy URL → triggers audit → compares to previous
```

**Vercel integration setup:**
1. User installs PerfAlly integration from Vercel Marketplace (or manual webhook)
2. On each production deploy, Vercel POSTs to our webhook
3. We extract the deploy URL, run audit, store as `triggered_by: "deploy"`
4. Email if regression detected

### 4. WordPress Plugin

Target: WordPress powers 43% of the web. Large SMB market.

**Plugin features:**
- Install plugin → auto-registers site (opens OAuth-like flow)
- WordPress admin widget: current performance score
- WooCommerce-aware: monitors checkout page specifically
- "Run audit" button in WP admin

**Tech:** WordPress plugin (PHP). Build this after the API is stable. Treat it as a separate product/repo.

**Monetization angle:** Plugin converts free users to paid (they install plugin, see scores, subscribe in WP admin).

### 5. Zapier / Make Integration

Register as a Zapier app:
- **Trigger:** "New audit completed"
- **Trigger:** "Alert fired (metric degraded)"
- **Action:** "Run audit on URL"

Connect with popular SMB tools:
- Slack (send message when score improves/degrades)
- Google Sheets (log scores weekly)
- Notion (create performance report page)
- Airtable (log audits to base)

Zapier public apps require review. Start with Make (formerly Integromat) — easier to get listed.

### 6. Custom Lighthouse Worker

The PSI API has limitations:
- Can't test authenticated pages (login-walled content)
- Can't test pages that require JavaScript interactions
- Rate limited
- Google controls configuration

For Enterprise/custom use cases, run actual Lighthouse:

```typescript
// Option: Fly.io worker running Lighthouse CLI
// Fly machines can run Node.js + headless Chromium

// lighthouse.config.js
module.exports = {
  extends: "lighthouse:default",
  settings: {
    throttlingMethod: "simulate",
    screenEmulation: { mobile: true, width: 390, height: 844 },
  }
}
```

**Architecture:**
```
QStash job → POST /api/jobs/custom-lighthouse
  → POST to Fly.io worker API (long-running machine)
  → Worker runs Lighthouse → returns full result
  → Store result in DB (same format as PSI results)
```

**Fly.io worker:** A simple Express app that accepts `{ url, config }`, runs Lighthouse, returns the `lhr` JSON. One machine per concurrent audit. Auto-suspend when idle.

This is the path to:
- Testing authenticated pages (pass session cookies)
- Custom throttling profiles
- CI/CD integration with real Lighthouse (not PSI)
- Multi-step flows (login → checkout page)

### 7. Performance Regression Monitoring

Dedicated feature for dev teams (different from SMB use case):

```
Enable: "Monitor after every deploy"
  → Connect GitHub repo
  → On push to main: auto-trigger audit
  → Compare to previous audit
  → Fail CI if regression > threshold
  → Show diff in PR
```

This is Phase 5 because it requires the GitHub integration + custom Lighthouse worker.

### 8. Multi-Region Auditing

Run the same URL from multiple locations and compare:

| Location | LCP  | Grade |
|----------|------|-------|
| US East  | 1.8s | Good  |
| EU West  | 2.9s | Needs |
| APAC     | 4.1s | Poor  |

Useful for international businesses. Reveals CDN gaps.

Implementation: Deploy lightweight workers to Fly.io in multiple regions. Each worker calls PSI API (PSI itself only runs from US, so for true multi-region you need the custom Lighthouse worker).

---

## API Pricing

API access is available on Pro+ plan (included in subscription). Consider:

- **Included:** 100 API calls/month on Pro
- **Overage:** $0.05/call above limit
- Or: separate "API add-on" $10/month for unlimited API calls

---

## Platform / Marketplace Vision

Long-term (12–18 months), PerfAlly becomes a platform:

1. **Plugin ecosystem:** Third-party integrations (Shopify app, WooCommerce extension, Webflow plugin)
2. **Audit templates:** Pre-configured audit profiles for e-commerce, SaaS, blogs
3. **Reseller program:** Agencies resell PerfAlly under their brand (already enabled by white-label)
4. **Data insights:** Aggregated, anonymized benchmarks by industry ("How does your e-commerce site compare to others?")

---

## Definition of Done (pick your Phase 5 ship)

Choose one integration to ship first based on your user base:

**If users are developers:** Ship GitHub Action first
**If users are agencies:** Ship Zapier first
**If users are WordPress site owners:** Ship WordPress plugin first
**If you want B2B sales:** Ship public API + OpenAPI docs first
