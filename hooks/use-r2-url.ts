/**
 * useR2Url — resolves an R2 object key to a short-lived presigned URL.
 *
 * Returns the original value unchanged when:
 *   - the value is already an http(s) URL
 *   - the value is a data: URL (Base64, legacy)
 *   - the value is empty / undefined
 *
 * Returns a presigned URL (fetched from /api/r2-url) when the value looks
 * like an R2 object key (no protocol prefix, short string).
 */
"use client"

import { useState, useEffect } from "react"
import { isR2Key, isBase64DataUrl } from "@/lib/r2/utils"

export function useR2Url(storageKeyOrUrl: string | undefined | null): string | undefined {
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(() => {
    // If it's already a displayable URL (http or base64) return it directly
    if (!storageKeyOrUrl) return undefined
    if (!isR2Key(storageKeyOrUrl)) return storageKeyOrUrl
    return undefined // will be resolved via effect
  })

  useEffect(() => {
    if (!storageKeyOrUrl) { setResolvedUrl(undefined); return }
    if (!isR2Key(storageKeyOrUrl)) { setResolvedUrl(storageKeyOrUrl); return }

    let cancelled = false
    fetch(`/api/r2-url?key=${encodeURIComponent(storageKeyOrUrl)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (!cancelled && data?.url) setResolvedUrl(data.url) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [storageKeyOrUrl])

  return resolvedUrl
}
