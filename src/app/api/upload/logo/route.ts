import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db, users } from "@/lib/db"
import { eq } from "drizzle-orm"
import fs from "node:fs/promises"
import path from "node:path"

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"]
const MAX_BYTES = 2 * 1024 * 1024 // 2MB

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Agency plan check
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { plan: true },
  })
  if (dbUser?.plan !== "agency") {
    return NextResponse.json(
      { error: "Logo upload requires Agência plan" },
      { status: 403 }
    )
  }

  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File must be PNG, JPEG, or SVG" },
      { status: 400 }
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File must be under 2MB" },
      { status: 400 }
    )
  }

  const ext = file.type === "image/svg+xml" ? "svg" : file.type === "image/png" ? "png" : "jpg"
  const basename = `${Date.now()}.${ext}`

  // Production: upload to Vercel Blob
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob")
    const { url } = await put(`logos/${userId}/${basename}`, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    })
    return NextResponse.json({ url })
  }

  // Local dev fallback: save to public/uploads/logos/{userId}/
  const dir = path.join(process.cwd(), "public", "uploads", "logos", userId)
  await fs.mkdir(dir, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(path.join(dir, basename), buffer)
  const url = `/uploads/logos/${userId}/${basename}`
  return NextResponse.json({ url })
}
