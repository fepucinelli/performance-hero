# PerfAlly

> **AI-powered performance metrics platform** | Real-time Core Web Vitals tracking with Claude-generated insights

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?style=flat-square&logo=postgresql)](https://www.postgresql.org)
[![Stripe](https://img.shields.io/badge/Stripe-Ready-purple?style=flat-square&logo=stripe)](https://stripe.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## 📌 Overview

PerfAlly is a **SaaS performance analytics platform** that helps developers and teams monitor, understand, and optimize their web application's performance. Using AI-powered explanations powered by Claude, PerfAlly transforms raw Core Web Vitals data into actionable insights.

### What's Live (Phase 1 ✅ + Phase 2 🚀)
- ✅ Real-time Core Web Vitals tracking (LCP, FID, CLS)
- ✅ Multi-project dashboard with historical analytics
- ✅ AI-powered performance explanations (Claude integration)
- ✅ User authentication & authorization
- ✅ Free tier with essential analytics
- 🚀 **Pro tier** with advanced features (Phase 2)
- 🚀 **Agency tier** with team collaboration (Phase 2)
- 🚀 Stripe billing & subscription management
- 🚀 Usage tracking & quota management

**Current Status:** End of Phase 2 — Production ready with billing system

---

## 🎯 Key Features

### For Everyone (Free Tier)
- 📊 Dashboard with real-time metrics
- 📈 7-day historical data retention
- 🔍 Basic performance insights
- 1 project maximum
- 5,000 metrics/month

### Pro Users
- 📅 90-day historical data retention
- 🤖 AI-powered detailed explanations
- 📧 Weekly performance reports
- ⚙️ Custom metric tracking
- Unlimited projects
- 50,000 metrics/month

### Agency Users
- 🏢 Team collaboration & invites
- 📊 White-label dashboards
- 🔌 Advanced API access
- 📱 Mobile app support
- Priority support
- Unlimited everything

---

## 🏗️ Architecture

### Tech Stack
- **Frontend:** React 18 + Next.js 14 (App Router)
- **Backend:** Server Actions + Node.js
- **Database:** PostgreSQL 15
- **AI Integration:** Claude API (Haiku & higher)
- **Payments:** Stripe
- **Styling:** TailwindCSS 3
- **Type Safety:** TypeScript 5
- **Hosting:** Vercel (recommended)

### System Design

```
┌─────────────────────────────────────────────────┐
│           User Browser / Mobile                 │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────▼────────┐
        │   Next.js 14    │
        │  (App Router)   │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼───┐  ┌────▼─────┐  ┌───▼────┐
│Server │  │  Claude  │  │ Stripe │
│Actions│  │  API     │  │ API    │
└───┬───┘  └────┬─────┘  └───┬────┘
    │           │            │
    └───────────┼────────────┘
                │
        ┌───────▼────────┐
        │  PostgreSQL    │
        │  Database      │
        └────────────────┘
```

**Core Principles:**
1. **Server-First Architecture** – Prefer Server Actions over API routes (security, performance)
2. **Type Safety** – Strict TypeScript with no `any` types
3. **Performance** – Indexed queries, pagination, caching strategies
4. **Scalability** – Designed for Phase 3 (Agency) expansion

For detailed architecture, see [Architecture Guide](./docs/architecture.md)

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ & pnpm
- **PostgreSQL** 15+ (local or Docker)
- **Stripe account** (for billing features)
- **Claude API key** (for AI explanations)

### Local Development Setup

#### 1. Clone & Install
```bash
git clone https://github.com/felipepucinelli/perf-ally.git
cd perf-ally
pnpm install
```

#### 2. Environment Variables
```bash
cp .env.example .env.local
```

Required variables:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/perf_ally"

# Authentication (NextAuth or your auth provider)
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Claude AI
CLAUDE_API_KEY="sk-ant-..."

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_test_..."
```

#### 3. Database Setup
```bash
# Run migrations
pnpm db:migrate

# Seed development data (optional)
pnpm db:seed

# Open Prisma Studio to inspect data
pnpm db:studio
```

#### 4. Local Stripe Webhook
```bash
# Install Stripe CLI from https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copy webhook signing secret to .env.local
STRIPE_WEBHOOK_SECRET="whsec_..."
```

#### 5. Start Development Server
```bash
pnpm dev
```

Visit `http://localhost:3000` 🎉

### Common Commands
```bash
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm test             # Run tests
pnpm test:watch      # Watch mode
pnpm lint             # Check code quality
pnpm db:migrate      # Apply migrations
pnpm db:studio       # Open database explorer
```

---

## 🌐 Deployment

### Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel

# Set production environment variables in Vercel dashboard
```

**Environment Variables to Configure:**
- `DATABASE_URL` → PostgreSQL connection string
- `NEXTAUTH_SECRET` → New secret for production
- `NEXTAUTH_URL` → Your production domain
- `CLAUDE_API_KEY` → API key with production limits
- `STRIPE_SECRET_KEY` → Production Stripe key
- `STRIPE_WEBHOOK_SECRET` → Production webhook secret

### Self-Hosted Deployment

#### Using Docker
```bash
# Build image
docker build -t perf-ally .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e CLAUDE_API_KEY="sk-ant-..." \
  perf-ally
```

#### Using PM2
```bash
# Install PM2
npm install -g pm2

# Build and start
pnpm build
pm2 start "pnpm start" --name "perf-ally"

# Monitor
pm2 monitor
```

#### Database Deployment
```bash
# PostgreSQL on managed service (recommended)
# - AWS RDS
# - Digital Ocean
# - Railway
# - PlanetScale

# Run migrations on production database
DATABASE_URL="postgresql://prod-user:pwd@host:5432/db" pnpm db:migrate
```

---

## 📊 Feature Comparison

| Feature | Free | Pro | Agency |
|---------|------|-----|--------|
| Projects | 1 | Unlimited | Unlimited |
| Data Retention | 7 days | 90 days | 365 days |
| Metrics/Month | 5,000 | 50,000 | Unlimited |
| AI Explanations | ❌ | ✅ | ✅ |
| Weekly Reports | ❌ | ✅ | ✅ |
| Custom Metrics | ❌ | ✅ | ✅ |
| Team Members | 1 | 1 | Unlimited |
| API Access | Limited | Full | Full |
| Priority Support | ❌ | ❌ | ✅ |
| White-Label | ❌ | ❌ | ✅ |
| SLA | — | — | 99.9% |

---

## 📚 Documentation

- **[Architecture Guide](./docs/architecture.md)** – System design & decision rationale
- **[Database Schema](./docs/database-schema.md)** – All tables, relationships, indexes
- **[Phase 2 Roadmap](./docs/phase-2-pro.md)** – Current feature set & implementation status
- **[Phase 3 Roadmap](./docs/phase-3-agency.md)** – Upcoming Agency features
- **[Stripe Integration](./docs/stripe-integration.md)** – Billing system & webhook setup
- **[Claude Development Guide](./claude.md)** – For contributors & AI assistance

---

## 👨‍💻 Development Guide

### For Contributors

**Before contributing, review:**
1. [claude.md](./claude.md) – Development patterns & conventions
2. [CONTRIBUTING.md](./CONTRIBUTING.md) – PR checklist & standards

**Key Conventions:**
- ✅ Use **Server Actions** for database queries (not API routes)
- ✅ Keep **types in `/src/types/index.ts`** (single source of truth)
- ✅ **Paginate queries** with `take: 50` + offset
- ✅ **No `any` types** – use TypeScript strictly
- ✅ Add **indexes** for frequently queried columns

**Feature Implementation Checklist:**
- [ ] Database schema updated + migration created
- [ ] Server Action created in `/src/lib/actions/`
- [ ] Types added to `/src/types/index.ts`
- [ ] UI component built in `/src/components/`
- [ ] Tests added (at least 1 happy-path test)
- [ ] Stripe integration (if billing-related)
- [ ] Update relevant `/docs/` files

### Project Structure
```
perf-ally/
├── src/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── (auth)/            # Auth routes
│   │   ├── dashboard/         # Main dashboard
│   │   ├── settings/          # User settings & billing
│   │   └── api/               # Strategic API routes (webhooks only)
│   ├── components/            # Reusable React components
│   ├── lib/
│   │   ├── actions/           # Server Actions (⭐ prefer these)
│   │   ├── db.ts              # Database client
│   │   ├── stripe.ts          # Stripe utilities
│   │   ├── explanations.ts    # Claude integration
│   │   └── utils/             # Helper functions
│   ├── types/
│   │   └── index.ts           # All TypeScript types
│   ├── hooks/                 # Custom React hooks
│   └── styles/                # Global styles
├── prisma/
│   └── schema.prisma          # Database schema
├── docs/                      # Documentation
├── public/                    # Static assets
├── .claudeignore              # Claude context optimization
├── claude.md                  # Development guide for Claude AI
└── README.md                  # This file
```

---

## 🤖 AI Integration (Claude)

PerfAlly uses **Claude 3.5 Haiku** & **Claude 3 Opus** for AI explanations:

### How Explanations Work
1. User requests explanation for metrics
2. **Server Action** fetches minimal metric data (indexed query)
3. **Claude API** generates insights (streamed response)
4. Response cached in database for 24 hours
5. Cached explanation served to subsequent requests

### Smart Caching
- Same metrics → reuse cached explanation (24h TTL)
- Different metrics → generate new explanation
- Cache invalidated on significant metric changes

### Token Optimization
- Use Haiku for summaries & quick insights
- Use Opus only for complex analysis
- Batch requests to minimize API calls
- Cache aggressively

---

## 💳 Stripe Integration

### Subscription Tiers
- **Free** → $0/month | API key required
- **Pro** → $29/month | AI insights + reports
- **Agency** → $199/month | Team features + white-label

### Webhook Events Handled
- `customer.subscription.created` – Upgrade user tier
- `customer.subscription.deleted` – Downgrade to free
- `invoice.payment_succeeded` – Log payment
- `invoice.finalized` – Send receipt email

### Testing Locally
```bash
# Terminal 1: Start dev server
pnpm dev

# Terminal 2: Forward Stripe webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Use test card in checkout: 4242 4242 4242 4242
```

See [Stripe Integration Guide](./docs/stripe-integration.md) for complete setup.

---

## 📈 Performance Metrics

**Target Performance (Phase 2):**
- Dashboard load time: < 2s (Core Web Vitals optimized)
- API response time: < 500ms (p95)
- Database query time: < 100ms (with indexes)
- Cache hit rate: > 80% (for explanations)

**Monitoring:**
- Vercel Analytics for Web Vitals
- Custom monitoring dashboards
- Database query performance logs

---

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Verify PostgreSQL is running
psql -U postgres -d perf_ally -c "SELECT 1"

# Check DATABASE_URL format
# postgresql://user:password@localhost:5432/db_name

# Reset migrations
pnpm db:reset  # ⚠️ Wipes database
```

### Stripe Webhook Not Triggering
```bash
# Verify webhook endpoint is correct
# Should be: http://localhost:3000/api/webhooks/stripe

# Check Stripe Dashboard > Webhooks > Events
# Look for delivery attempts & error logs

# Restart Stripe CLI listener
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Claude API Rate Limiting
- Free tier: 5 requests/minute
- Check rate limit headers in response
- Implement exponential backoff for retries
- Cache explanations to reduce API calls

### Out of Memory During Build
```bash
# Increase Node memory for production builds
NODE_OPTIONS=--max_old_space_size=4096 pnpm build
```

---

## 📋 Roadmap

### ✅ Phase 1 (Complete)
- Core dashboard & metrics display
- User authentication
- Free tier functionality
- Stripe billing system
- Basic explanations (simple heuristics)

### 🚀 Phase 2 (In Progress → Launch Ready)
- AI-powered explanations (Claude integration)
- Pro & Agency subscription tiers
- Usage tracking & quotas
- Weekly digest emails
- Team invitations (Agency)

### 📅 Phase 3 (Planned)
- White-label dashboards (Agency)
- Advanced API endpoints
- Custom alert rules
- Slack/Teams integrations
- Performance benchmarking
- Budget alerts

See [Phase Roadmaps](./docs/) for detailed breakdowns.

---

## 📄 License

This project is licensed under the **MIT License** – see [LICENSE](./LICENSE) file for details.

---

**Built with ❤️ for performance-obsessed developers**

⭐ Star us on GitHub if you find PerfAlly useful!
