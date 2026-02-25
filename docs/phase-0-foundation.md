# Phase 0 — Foundation

**Goal:** Deployed, authenticated, database-connected app on Vercel. No product features yet.
**Duration:** 1–2 days
**Branch:** `main` (this is the base everything builds on)

---

## Steps

### 1. Init Next.js Project

```bash
pnpx create-next-app@latest performance-radar \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
cd perf-ally
pnpm install
```

### 2. Install Core Dependencies

```bash
# UI
pnpm add @radix-ui/react-icons
pnpx shadcn@latest init
pnpx shadcn@latest add button card input label badge separator skeleton toast

# Auth
pnpm add @clerk/nextjs

# Database
pnpm add drizzle-orm @neondatabase/serverless
pnpm add -D drizzle-kit

# Utilities
pnpm add zod @t3-oss/env-nextjs
pnpm add clsx tailwind-merge class-variance-authority

# Monitoring
pnpm add @sentry/nextjs
```

### 3. Clerk Setup

1. Create app at [clerk.com](https://clerk.com)
2. Set env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
3. Add redirect URLs for sign-in/sign-up

```typescript
// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/projects(.*)"])

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) auth().protect()
})

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
```

```typescript
// src/app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs"

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

Create route groups:
- `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`

### 4. Neon + Drizzle Setup

1. Create project at [neon.tech](https://neon.tech)
2. Connect via Vercel integration (recommended) or copy `DATABASE_URL`

```typescript
// src/lib/db/index.ts
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

```typescript
// src/lib/db/schema.ts
import { pgTable, text, real, uuid, timestamptz, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID
  email: text("email").notNull(),
  name: text("name"),
  stripeCustomerId: text("stripe_customer_id"),
  plan: text("plan").default("free"),
  planExpiresAt: timestamptz("plan_expires_at"),
  createdAt: timestamptz("created_at").default(sql`NOW()`),
})

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  strategy: text("strategy").default("mobile"),
  schedule: text("schedule").default("manual"),
  nextAuditAt: timestamptz("next_audit_at"),
  alertLcp: real("alert_lcp"),
  alertCls: real("alert_cls"),
  alertInp: real("alert_inp"),
  createdAt: timestamptz("created_at").default(sql`NOW()`),
})

export const auditResults = pgTable("audit_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  strategy: text("strategy").notNull(),
  perfScore: real("perf_score"),
  lcp: real("lcp"),
  cls: real("cls"),
  inp: real("inp"),
  fcp: real("fcp"),
  ttfb: real("ttfb"),
  tbt: real("tbt"),
  speedIndex: real("speed_index"),
  cruxLcp: real("crux_lcp"),
  cruxCls: real("crux_cls"),
  cruxInp: real("crux_inp"),
  cruxFcp: real("crux_fcp"),
  lcpGrade: text("lcp_grade"),
  clsGrade: text("cls_grade"),
  inpGrade: text("inp_grade"),
  lighthouseRaw: jsonb("lighthouse_raw"),
  psiApiVersion: text("psi_api_version"),
  createdAt: timestamptz("created_at").default(sql`NOW()`),
})
```

```typescript
// drizzle.config.ts
import type { Config } from "drizzle-kit"
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: { connectionString: process.env.DATABASE_URL! },
} satisfies Config
```

Add to `package.json`:
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

Run: `pnpm db:push`

### 5. Clerk Webhook → DB Sync

```typescript
// src/app/api/webhooks/clerk/route.ts
import { Webhook } from "svix"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"

export async function POST(req: Request) {
  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
  const event = wh.verify(payload, headers) as any

  if (event.type === "user.created") {
    await db.insert(users).values({
      id: event.data.id,
      email: event.data.email_addresses[0].email_address,
      name: `${event.data.first_name} ${event.data.last_name}`.trim(),
    })
  }

  if (event.type === "user.deleted") {
    await db.delete(users).where(eq(users.id, event.data.id))
  }

  return new Response("OK")
}
```

### 6. Dashboard Layout Skeleton

```
src/app/(dashboard)/
├── layout.tsx         # Sidebar + top nav
├── dashboard/
│   └── page.tsx       # "No projects yet" empty state
└── projects/
    └── new/
        └── page.tsx   # Add project form (not wired yet)
```

### 7. Vercel Deployment

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables in Vercel dashboard
4. Connect Neon via Vercel Neon integration
5. Configure Clerk production instance

### 8. Sentry Setup

```bash
pnpx @sentry/wizard@latest -i nextjs
```

Follow wizard — it auto-configures `instrumentation.ts` and `sentry.*.config.ts`.

---

## vercel.json (starting point)

```json
{
  "crons": []
}
```

Crons added in Phase 2.

---

## .env.example

```
# Database
DATABASE_URL=

# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Google APIs (Phase 1)
GOOGLE_API_KEY=

# Stripe (Phase 2)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Email (Phase 2)
RESEND_API_KEY=

# Queue / Cache (Phase 2)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# Storage (Phase 3)
BLOB_READ_WRITE_TOKEN=

# Monitoring
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# Analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## Definition of Done

- [ ] `pnpm dev` works locally
- [ ] Can sign up and sign in via Clerk
- [ ] User row created in DB on sign-up
- [ ] Dashboard route redirects to sign-in if unauthenticated
- [ ] App deployed to Vercel production URL
- [ ] Sentry configured and receiving test events
- [ ] Preview deployments working on PRs
