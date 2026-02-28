export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { currentUser } from "@clerk/nextjs/server"
import { auth } from "@clerk/nextjs/server"
import { db, users } from "@/lib/db"
import { eq } from "drizzle-orm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { BillingSection } from "./billing-section"
import { BrandingSection } from "./branding-section"
import type { Plan } from "@/lib/db/schema"

export const metadata: Metadata = {
  title: "Settings",
}

export default async function SettingsPage() {
  const user = await currentUser()
  const { userId } = await auth()

  const dbUser = userId
    ? await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          plan: true,
          stripeCustomerId: true,
          planExpiresAt: true,
          agencyName: true,
          agencyContact: true,
          agencyAccentColor: true,
          agencyLogoUrl: true,
        },
      })
    : null

  const plan: Plan = (dbUser?.plan ?? "free") as Plan
  const hasStripeCustomer = !!dbUser?.stripeCustomerId
  const planExpiresAt = dbUser?.planExpiresAt ?? null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie sua conta e assinatura.
        </p>
      </div>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conta</CardTitle>
          <CardDescription>Detalhes da sua conta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">E-mail</span>
            <span>{user?.emailAddresses[0]?.emailAddress ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nome</span>
            <span>{user?.fullName ?? "—"}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Plano atual</span>
            <Badge variant={plan === "free" ? "secondary" : "default"} className="capitalize">
              {plan}
            </Badge>
          </div>
          {planExpiresAt && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Acesso até</span>
              <span className="text-muted-foreground">
                {new Date(planExpiresAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing */}
      <BillingSection plan={plan} hasStripeCustomer={hasStripeCustomer} />

      {/* Branding (Agency plan only) */}
      {plan === "agency" && (
        <BrandingSection
          initial={{
            agencyName: dbUser?.agencyName ?? null,
            agencyContact: dbUser?.agencyContact ?? null,
            agencyAccentColor: dbUser?.agencyAccentColor ?? null,
            agencyLogoUrl: dbUser?.agencyLogoUrl ?? null,
          }}
        />
      )}
    </div>
  )
}
