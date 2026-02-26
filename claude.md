# PerfAlly Development Guide for Claude

**Project:** SaaS performance metrics platform with AI-powered explanations  
**Current Phase:** Phase 2 (Pro features) - Database & Billing focus  
**Stack:** Next.js 14 (App Router), PostgreSQL, Stripe, TailwindCSS, TypeScript

---

## 🏗️ Architecture Overview

### Core Principles
1. **Server-First**: Use Server Actions over API routes when possible (performance, type safety)
2. **Performance-Oriented**: Optimize for speed & token efficiency
3. **Type Safety**: Leverage TypeScript strictly across the stack
4. **Senior Patterns**: Choose proven, scalable patterns over shortcuts

### Project Structure
```
/src
  /app              # Next.js 14 App Router
    /dashboard      # Main dashboard & metrics
    /settings       # User settings & billing
    /api           # Strategic API routes (webhooks, external APIs)
  /components       # Reusable React components
  /lib
    /actions        # Server Actions (prefer these)
    /db            # Database queries & migrations
    /stripe        # Stripe integration logic
    /utils         # Helper functions
  /types           # Shared TypeScript definitions
  /hooks           # Custom React hooks
  /styles          # Global styles
/docs             # Phase roadmaps & architecture decisions
/public           # Static assets
```

---

## 📊 Database Architecture (Priority Focus)

### Current Schema
- **users** → Core authentication, plan tier (free/pro/agency)
- **projects** → User's performance metrics containers
- **metrics** → Raw data points (Core Web Vitals, custom metrics)
- **explanations** → AI-generated insights (follow `explanations.ts` pattern)
- **billing_events** → Stripe webhook logs & usage tracking

### Key Patterns
**Always use Server Actions for DB queries:**
```typescript
// ✅ GOOD - Server Action with type safety
'use server'
export async function getProjectMetrics(projectId: string) {
  const metrics = await db.metrics.findMany({
    where: { projectId },
    orderBy: { timestamp: 'desc' },
    take: 100
  })
  return metrics
}

// ❌ AVOID - API route unless external integration required
```

**Query Optimization:**
- Use indexed columns: `projectId`, `userId`, `timestamp`
- Batch queries with `Promise.all()` when independent
- Paginate large result sets (take: 50, skip: offset)
- Select only needed fields with `select: { ... }`

### Phase 2 Database Updates
- [ ] Implement `subscription_tiers` table (free/pro/agency limits)
- [ ] Add `usage_logs` for tracking API calls & dashboard views
- [ ] Create `billing_cycles` for cycle management
- [ ] Add indexes on: `(userId, createdAt)`, `(projectId, timestamp)`

---

## 💳 Stripe Billing Strategy (Phase 2 Focus)

### Server Action Pattern
```typescript
// Inside /src/lib/actions/billing.ts
'use server'
export async function createCheckoutSession(projectId: string, tier: 'pro' | 'agency') {
  const user = await getCurrentUser()
  
  // Validate tier access rules
  // Create Stripe session
  // Log event to billing_events table
  // Return session URL
}
```

### Webhook Handling
- Stripe→ API route `/api/webhooks/stripe`
- Update `users.plan_tier`, `subscription_status`
- Log to `billing_events` for audit trail
- Use `stripe.webhooks.constructEvent()` for security

### Key Integration Points
1. **Subscription Creation** → Update user tier + create billing cycle
2. **Payment Success** → Enable Pro features, reset usage quota
3. **Subscription Cancelled** → Downgrade to free, send retention email
4. **Invoice Finalized** → Send receipt, log in usage dashboard

---

## 🤖 AI Explanations Pattern

**Files:** `/src/lib/explanations.ts`, `/src/components/ExplanationCard.tsx`

### Advanced Pattern (Current)
1. Fetch raw metrics data (minimal, indexed query)
2. Call Claude API via Server Action (streaming response)
3. Parse response into structured format
4. Cache explanation in `explanations` table
5. Stream to client with real-time updates

### Performance Optimization
- Cache explanations for 24h (same metrics = same insight)
- Don't re-explain unchanged metric values
- Use `unstable_cache()` for stable calculations
- Request only relevant Claude model (Haiku for summaries, better model for deep analysis)

---

## Type System Conventions

**Shared types in `/src/types/index.ts`:**
```typescript
// User & Auth
export type UserTier = 'free' | 'pro' | 'agency'
export interface User {
  id: string
  email: string
  plan_tier: UserTier
  subscription_id?: string
  created_at: Date
}

// Metrics
export interface Metric {
  id: string
  projectId: string
  timestamp: Date
  coreWebVitals: {
    lcp: number
    fid: number
    cls: number
  }
}

// Explanations
export interface Explanation {
  id: string
  metricId: string
  content: string
  summary: string
  cached_at: Date
}
```

**Database Query Returns:**
- Use Zod for runtime validation on external data
- TypeScript inference for DB models (from ORM/client)
- Create `type-safe` wrapper around queries

---

## 🔍 Common PR/Development Checklist

### Before asking Claude, ensure:
- [ ] **Database**: Query follows indexed columns + pagination pattern
- [ ] **Types**: All DB returns typed, no `any` types
- [ ] **Server Actions**: Used instead of API routes (unless webhooks/external)
- [ ] **Performance**: No N+1 queries, unnecessary loops, or re-renders
- [ ] **Stripe**: Webhook logged, idempotent, error handling added
- [ ] **Tests**: At least one happy-path test for critical flows

### Claude Review Request Template
```
I'm implementing [feature]. Here's my approach:
1. [Database query/schema change]
2. [UI/component change]
3. [Stripe/billing integration point]

Should I optimize [specific concern]? Any senior patterns I'm missing?
```

---

## ⚡ Performance Optimization Tips

### Database
- Always use `take: X` + cursor-based pagination for large sets
- Avoid `SELECT *` → use explicit `select: { ... }`
- Index on: `(userId, createdAt)`, `(projectId, createdAt)`, `timestamp`
- Use connection pooling (PgBouncer recommended)

### API/Server Actions
- Batch independent queries with `Promise.all()`
- Use `unstable_cache()` for stable calculations (24h TTL)
- Stream Claude responses (don't wait for full response)
- Compress API responses with `gzip`

### Frontend
- Use `React.memo()` for expensive metric charts
- Lazy-load explanation cards (only fetch on scroll)
- Prefetch next phase data on route hover
- Cache explanations client-side for 1h

### Token Efficiency
- Don't include full `pnpm-lock.yaml` or `.next/` build output
- Focus Claude on `/src` and `/docs` only
- Ask specific questions with file context, not entire project
- Use phase docs from `/docs` instead of re-explaining architecture

---

## 📖 How to Extend Features

### Adding a New Metric Type
1. Add to `Metric` schema in database
2. Update `/src/types/index.ts` with new property
3. Create Server Action in `/src/lib/actions/metrics.ts`
4. Build UI component in `/src/components/MetricCard.tsx`
5. Add test case in `/src/lib/__tests__/metrics.test.ts`

### Adding Phase 2 Pro Feature
1. Check `/docs/phase-2-roadmap.md` for requirements
2. Add feature flag in database: `users.features_enabled`
3. Implement Server Action + type-safe query
4. Protect UI with `<ProFeatureGate tier="pro">`
5. Log feature usage to `billing_events`

### Stripe Integration Point
1. Define webhook event in `/api/webhooks/stripe`
2. Create handler Server Action in `/lib/actions/billing.ts`
3. Update user record atomically
4. Log to `billing_events` table
5. Test with Stripe CLI locally

---

## 🚀 Quick Commands

```bash
# Development
pnpm dev              # Start dev server + local Stripe webhook

# Database
pnpm db:migrate       # Run pending migrations
pnpm db:seed         # Seed dev data
pnpm db:studio       # Open Prisma Studio

# Testing
pnpm test             # Run all tests
pnpm test:watch      # Watch mode
pnpm test:coverage   # Coverage report

# Build & Deploy
pnpm build            # Build for production
pnpm vercel:deploy    # Deploy to Vercel
```

---

## 📚 Docs Reference

When asking about Phase 2 features, reference:
- `/docs/phase-2-roadmap.md` - Pro feature list & requirements
- `/docs/architecture.md` - System design & decisions
- `/docs/database-schema.md` - Full schema with relationships
- `/docs/stripe-integration.md` - Billing flow & webhook events

---

## Key Files to Know

**When asking questions, reference these:**
- **Database**: `/src/lib/db.ts`, migrations in `/prisma`
- **Billing**: `/src/lib/stripe.ts`, `/src/lib/actions/billing.ts`
- **Explanations**: `/src/lib/explanations.ts` (AI pattern)
- **Types**: `/src/types/index.ts` (single source of truth)
- **Server Actions**: `/src/lib/actions/*.ts` (prefer over API routes)

---

## Tone & Style Guide

- **Be specific**: "I'm adding a usage quota. Should I track it per month or per billing cycle?"
- **Provide context**: Include relevant file references, current implementation
- **Ask for patterns**: "What's the senior approach for [problem] in our stack?"
- **Think phases**: "Does this decision block Phase 3 Agency features?"

---

**Last Updated:** Feb 25, 2026  
**Maintainer:** Felipe Pucinelli  
**Focus Areas:** Phase 2 (Database & Billing), Architecture, Performance
