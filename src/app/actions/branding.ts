"use server"

import { auth } from "@clerk/nextjs/server"
import { db, users } from "@/lib/db"
import { eq } from "drizzle-orm"

export type BrandingData = {
  agencyName: string
  agencyContact: string
  agencyAccentColor: string
  agencyLogoUrl: string
}

export type BrandingResult = { success: true } | { success: false; error: string }

export async function updateBrandingAction(data: BrandingData): Promise<BrandingResult> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: "Não autenticado" }

  // Agency plan check
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { plan: true },
  })
  if (dbUser?.plan !== "agency") {
    return { success: false, error: "Configuração de marca requer o plano Agência" }
  }

  await db
    .update(users)
    .set({
      agencyName: data.agencyName || null,
      agencyContact: data.agencyContact || null,
      agencyAccentColor: data.agencyAccentColor || null,
      agencyLogoUrl: data.agencyLogoUrl || null,
    })
    .where(eq(users.id, userId))

  return { success: true }
}
