/**
 * Admin debug endpoint: GET /api/admin/storage-debug
 * Returns a breakdown of all media storage references across actors and submissions.
 * 
 * Response includes:
 * - Count by storage type (R2 key, Base64, Supabase Storage URL, null)
 * - Sample rows with truncated values
 * - Expected patterns for each type
 */

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { isR2Key, isBase64DataUrl } from "@/lib/r2/utils"

function classifyStorageType(value: string | null | undefined): string {
  if (!value || value === "") return "null"
  if (isBase64DataUrl(value)) return "base64"
  if (value.startsWith("http://") || value.startsWith("https://")) return "http_url"
  if (isR2Key(value)) return "r2_key"
  return "unknown"
}

function truncate(value: string | null | undefined, len = 60): string {
  if (!value) return "(null)"
  if (value.length <= len) return value
  return value.slice(0, len) + "..."
}

export async function GET() {
  const supabase = await createClient()

  // Fetch actors
  const { data: actors, error: actorsError } = await supabase
    .from("actors")
    .select("id, full_name, image_url, voice_sample_url, singing_sample_url, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50)

  // Fetch submissions
  const { data: submissions, error: submissionsError } = await supabase
    .from("actor_submissions")
    .select("id, full_name, image_url, voice_sample_url, singing_sample_url, created_at")
    .order("created_at", { ascending: false })
    .limit(50)

  if (actorsError || submissionsError) {
    return NextResponse.json({ error: actorsError?.message || submissionsError?.message }, { status: 500 })
  }

  // Classify actors
  const actorStats = { r2_key: 0, base64: 0, http_url: 0, null: 0, unknown: 0 }
  const actorSamples: any[] = []

  for (const a of actors ?? []) {
    const imgType = classifyStorageType(a.image_url)
    const voiceType = classifyStorageType(a.voice_sample_url)
    const singingType = classifyStorageType(a.singing_sample_url)

    actorStats[imgType as keyof typeof actorStats]++
    actorStats[voiceType as keyof typeof actorStats]++
    actorStats[singingType as keyof typeof actorStats]++

    actorSamples.push({
      id: a.id,
      full_name: a.full_name,
      image: { type: imgType, value: truncate(a.image_url) },
      voice: { type: voiceType, value: truncate(a.voice_sample_url) },
      singing: { type: singingType, value: truncate(a.singing_sample_url) },
      updated_at: a.updated_at,
    })
  }

  // Classify submissions
  const subStats = { r2_key: 0, base64: 0, http_url: 0, null: 0, unknown: 0 }
  const subSamples: any[] = []

  for (const s of submissions ?? []) {
    const imgType = classifyStorageType(s.image_url)
    const voiceType = classifyStorageType(s.voice_sample_url)
    const singingType = classifyStorageType(s.singing_sample_url)

    subStats[imgType as keyof typeof subStats]++
    subStats[voiceType as keyof typeof subStats]++
    subStats[singingType as keyof typeof subStats]++

    subSamples.push({
      id: s.id,
      full_name: s.full_name,
      image: { type: imgType, value: truncate(s.image_url) },
      voice: { type: voiceType, value: truncate(s.voice_sample_url) },
      singing: { type: singingType, value: truncate(s.singing_sample_url) },
      created_at: s.created_at,
    })
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    expected_r2_key_pattern: "actors/{id}/images/{filename} or actor-submissions/{id}/images/{filename}",
    actors: {
      total: actors?.length ?? 0,
      stats: actorStats,
      samples: actorSamples.slice(0, 10),
    },
    submissions: {
      total: submissions?.length ?? 0,
      stats: subStats,
      samples: subSamples.slice(0, 10),
    },
  })
}
