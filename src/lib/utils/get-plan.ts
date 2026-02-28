import { db, users } from "@/lib/db"
import { eq } from "drizzle-orm"
import type { Plan } from "@/lib/db/schema"

export async function getUserPlan(userId: string): Promise<Plan> {
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { plan: true },
  })
  return (dbUser?.plan ?? "free") as Plan
}
