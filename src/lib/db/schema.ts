/**
 * Database schema — single source of truth.
 *
 * Rules:
 * - All timestamps are UTC (timestamptz)
 * - UUIDs for app-generated IDs, text for external IDs (Clerk, Stripe)
 * - Cascade deletes: deleting a user deletes their projects, audits, etc.
 * - Nullable columns are explicit — no implicit nulls
 */
import {
  pgTable,
  text,
  real,
  uuid,
  timestamp,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core"

// Convenience alias: timestamp with timezone (TIMESTAMPTZ in PostgreSQL)
const timestamptz = (name: string) => timestamp(name, { withTimezone: true })
import { sql, relations } from "drizzle-orm"

// ─── Users ──────────────────────────────────────────────────────────────────
// Synced from Clerk via webhook. Do NOT store passwords here.

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID (e.g. "user_2abc...")
  email: text("email").notNull(),
  name: text("name"),

  // Billing (Phase 2)
  stripeCustomerId: text("stripe_customer_id").unique(),
  plan: text("plan", {
    enum: ["free", "starter", "pro", "agency"],
  })
    .notNull()
    .default("free"),
  planExpiresAt: timestamptz("plan_expires_at"),

  createdAt: timestamptz("created_at")
    .notNull()
    .default(sql`NOW()`),
  updatedAt: timestamptz("updated_at")
    .notNull()
    .default(sql`NOW()`),
})

// ─── Projects ────────────────────────────────────────────────────────────────
// One project = one URL being monitored.

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    url: text("url").notNull(),

    // "mobile" | "desktop" | "both" — Phase 1 supports mobile + desktop
    strategy: text("strategy", {
      enum: ["mobile", "desktop"],
    })
      .notNull()
      .default("mobile"),

    // "manual" | "daily" | "hourly" (Phase 2: scheduled runs)
    schedule: text("schedule", {
      enum: ["manual", "daily", "hourly"],
    })
      .notNull()
      .default("manual"),

    // Scheduling state (Phase 2)
    nextAuditAt: timestamptz("next_audit_at"),
    lastAuditAt: timestamptz("last_audit_at"),

    // Alert thresholds in native units (ms for LCP/INP, raw for CLS)
    // null = no alert configured for that metric
    alertLcp: real("alert_lcp"),
    alertCls: real("alert_cls"),
    alertInp: real("alert_inp"),

    // Teams (Phase 3): null for personal projects
    orgId: text("org_id"),

    createdAt: timestamptz("created_at")
      .notNull()
      .default(sql`NOW()`),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .default(sql`NOW()`),
  },
  (t) => [
    index("projects_user_id_idx").on(t.userId),
    index("projects_next_audit_at_idx").on(t.nextAuditAt),
  ]
)

// ─── Audit Results ───────────────────────────────────────────────────────────
// One row per Lighthouse run. Immutable once written.

export const auditResults = pgTable(
  "audit_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    strategy: text("strategy", { enum: ["mobile", "desktop"] }).notNull(),

    // ── Lighthouse lab data ──────────────────────────────
    perfScore: real("perf_score"), // 0–100
    lcp: real("lcp"), // ms
    cls: real("cls"), // unitless ratio
    inp: real("inp"), // ms
    fcp: real("fcp"), // ms
    ttfb: real("ttfb"), // ms
    tbt: real("tbt"), // ms
    speedIndex: real("speed_index"), // ms

    // ── CrUX field data (P75 real-user values) ──────────
    // null when the origin has insufficient traffic in CrUX
    cruxLcp: real("crux_lcp"),
    cruxCls: real("crux_cls"),
    cruxInp: real("crux_inp"),
    cruxFcp: real("crux_fcp"),

    // ── Pre-computed grades ──────────────────────────────
    // Stored so UI doesn't need to recompute; grades stored when thresholds change
    lcpGrade: text("lcp_grade", {
      enum: ["good", "needs-improvement", "poor"],
    }),
    clsGrade: text("cls_grade", {
      enum: ["good", "needs-improvement", "poor"],
    }),
    inpGrade: text("inp_grade", {
      enum: ["good", "needs-improvement", "poor"],
    }),

    // ── Additional Lighthouse category scores ────────────
    seoScore: real("seo_score"),
    accessibilityScore: real("accessibility_score"),
    bestPracticesScore: real("best_practices_score"),

    // ── Full Lighthouse JSON ─────────────────────────────
    // Stored for action plan generation. Large (~500KB compressed).
    // Access via: audit.lighthouseRaw as LighthouseResult
    lighthouseRaw: jsonb("lighthouse_raw"),

    // AI-generated action plan (cached, null = not yet generated)
    aiActionPlan: jsonb("ai_action_plan"),

    // Token for public share links (e.g. /share/abc123)
    shareToken: text("share_token")
      .notNull()
      .default(sql`gen_random_uuid()::text`),

    // Metadata
    psiApiVersion: text("psi_api_version"),
    triggeredBy: text("triggered_by", {
      enum: ["manual", "cron", "api"],
    })
      .notNull()
      .default("manual"),

    createdAt: timestamptz("created_at")
      .notNull()
      .default(sql`NOW()`),
  },
  (t) => [
    index("audit_results_project_id_idx").on(t.projectId),
    index("audit_results_created_at_idx").on(t.createdAt),
    index("audit_results_share_token_idx").on(t.shareToken),
  ]
)

// ─── Alerts ──────────────────────────────────────────────────────────────────
// Log of fired alerts. Prevents duplicate alerts within a time window.

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => auditResults.id, { onDelete: "cascade" }),

    metric: text("metric", { enum: ["lcp", "cls", "inp"] }).notNull(),
    value: real("value").notNull(),
    threshold: real("threshold").notNull(),

    // Delivery channels (Phase 2+)
    emailSent: boolean("email_sent").notNull().default(false),
    slackSent: boolean("slack_sent").notNull().default(false),

    sentAt: timestamptz("sent_at")
      .notNull()
      .default(sql`NOW()`),
  },
  (t) => [index("alerts_project_id_idx").on(t.projectId)]
)

// ─── Reports ─────────────────────────────────────────────────────────────────
// Generated PDF reports stored in Vercel Blob (Phase 3).

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => auditResults.id, { onDelete: "cascade" }),

    blobUrl: text("blob_url").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),

    createdAt: timestamptz("created_at")
      .notNull()
      .default(sql`NOW()`),
  },
  (t) => [index("reports_project_id_idx").on(t.projectId)]
)

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  reports: many(reports),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  auditResults: many(auditResults),
  alerts: many(alerts),
  reports: many(reports),
}))

export const auditResultsRelations = relations(auditResults, ({ one }) => ({
  project: one(projects, {
    fields: [auditResults.projectId],
    references: [projects.id],
  }),
}))

export const alertsRelations = relations(alerts, ({ one }) => ({
  project: one(projects, {
    fields: [alerts.projectId],
    references: [projects.id],
  }),
  audit: one(auditResults, {
    fields: [alerts.auditId],
    references: [auditResults.id],
  }),
}))

export const reportsRelations = relations(reports, ({ one }) => ({
  project: one(projects, {
    fields: [reports.projectId],
    references: [projects.id],
  }),
  audit: one(auditResults, {
    fields: [reports.auditId],
    references: [auditResults.id],
  }),
  createdByUser: one(users, {
    fields: [reports.createdBy],
    references: [users.id],
  }),
}))

// ─── Inferred Types ──────────────────────────────────────────────────────────
// Use these everywhere instead of writing types by hand.

import type { InferSelectModel, InferInsertModel } from "drizzle-orm"

export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>

export type Project = InferSelectModel<typeof projects>
export type NewProject = InferInsertModel<typeof projects>

export type AuditResult = InferSelectModel<typeof auditResults>
export type NewAuditResult = InferInsertModel<typeof auditResults>

export type Alert = InferSelectModel<typeof alerts>
export type Report = InferSelectModel<typeof reports>

export type Plan = User["plan"]
export type Strategy = Project["strategy"]
export type Grade = NonNullable<AuditResult["lcpGrade"]>
