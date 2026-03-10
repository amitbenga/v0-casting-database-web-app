/**
 * POST /api/upload
 *
 * Server-side multipart upload proxy to Cloudflare R2.
 * The client sends a FormData with:
 *   - file: File
 *   - key: string  (full R2 object key, built by the caller using lib/r2/keys.ts)
 *
 * Returns: { key: string } on success, { error: string } on failure.
 *
 * Authentication: requires a valid Supabase session cookie.
 * Never exposed to unauthenticated requests.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { uploadToR2 } from "@/lib/r2/upload"

export const runtime = "nodejs"

// 50 MB hard limit — adjust if larger files are expected
export const maxDuration = 60

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const form = await request.formData()
    const file = form.get("file") as File | null
    const key = form.get("key") as string | null

    if (!file || !key) {
      return NextResponse.json(
        { error: "Missing required fields: file and key" },
        { status: 400 }
      )
    }

    // Enforce 50 MB
    const MAX_BYTES = 50 * 1024 * 1024
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (max 50 MB). Got ${(file.size / 1024 / 1024).toFixed(1)} MB.` },
        { status: 413 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadToR2(key, buffer, file.type || "application/octet-stream")

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Upload failed" }, { status: 500 })
    }

    return NextResponse.json({ key: result.key })
  } catch (err) {
    console.error("[upload-api] Unhandled error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
