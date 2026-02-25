/**
 * Environment variable validation using @t3-oss/env-nextjs.
 *
 * All environment variables used anywhere in the app must be declared here.
 * The build will fail if a required variable is missing — no silent undefined.
 *
 * Import this instead of process.env directly:
 *   import { env } from "@/env"
 */
import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  /**
   * Server-side variables — never sent to the browser.
   * Only accessible in Server Components, Route Handlers, Server Actions.
   */
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // Database
    DATABASE_URL: z.string().min(1),

    // Clerk
    CLERK_SECRET_KEY: z.string().min(1),
    CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),

    // Google APIs (Phase 1)
    GOOGLE_API_KEY: z.string().min(1).optional(),

    // Stripe (Phase 2)
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    STRIPE_STARTER_PRICE_ID: z.string().min(1).optional(),
    STRIPE_PRO_PRICE_ID: z.string().min(1).optional(),
    STRIPE_AGENCY_PRICE_ID: z.string().min(1).optional(),

    // Resend (Phase 2)
    RESEND_API_KEY: z.string().min(1).optional(),

    // Cron (Phase 2a)
    CRON_SECRET: z.string().min(1).optional(),

    // Upstash (Phase 2)
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    QSTASH_TOKEN: z.string().min(1).optional(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
    QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),

    // Vercel Blob (Phase 3)
    BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),

    // Anthropic (Phase 2 — AI action plans)
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
  },

  /**
   * Client-side variables — prefixed with NEXT_PUBLIC_.
   * Included in the browser bundle.
   */
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default("/sign-up"),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  },

  /**
   * Destructure from process.env to satisfy Next.js static analysis.
   * Next.js can only statically analyze string literals — no dynamic access.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_STARTER_PRICE_ID: process.env.STRIPE_STARTER_PRICE_ID,
    STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID,
    STRIPE_AGENCY_PRICE_ID: process.env.STRIPE_AGENCY_PRICE_ID,
    CRON_SECRET: process.env.CRON_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },

  /**
   * Skip validation in Edge Runtime and in CI environments
   * where not all env vars may be available.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
