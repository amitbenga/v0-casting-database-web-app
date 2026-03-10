/**
 * GET /api/r2-url?key=<objectKey>
 *
 * Returns a short-lived presigned GET URL for a private R2 object.
 * Authentication required.
 *
 * Response: { url: string }
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getR2PresignedUrl } from "@/lib/r2/upload"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const key = request.nextUrl.searchParams.get("key")
  if (!key) {
    return NextResponse.json({ error: "Missing key parameter" }, { status: 400 })
  }

  const url = await getR2PresignedUrl(key, 3600)
  if (!url) {
    return NextResponse.json({ error: "Failed to generate presigned URL" }, { status: 500 })
  }

  return NextResponse.json({ url })
}
