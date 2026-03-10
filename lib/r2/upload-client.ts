/**
 * Client-side helper to upload a File to R2 via the /api/upload proxy.
 * Safe to import from client components — never calls R2 directly.
 *
 * Usage:
 *   const key = actorKeys.image(actorId, file.name)
 *   const { key: uploadedKey } = await uploadFileToR2(file, key)
 */

export interface ClientUploadResult {
  success: boolean
  key?: string
  error?: string
}

/**
 * Upload a File to R2 via the server-side /api/upload route.
 * @param file   The File object from an <input type="file">
 * @param key    The full R2 object key (use key builders from lib/r2/keys.ts)
 */
export async function uploadFileToR2(
  file: File,
  key: string
): Promise<ClientUploadResult> {
  try {
    const form = new FormData()
    form.append("file", file)
    form.append("key", key)

    const res = await fetch("/api/upload", {
      method: "POST",
      body: form,
    })

    const json = await res.json()

    if (!res.ok) {
      return { success: false, error: json.error ?? `HTTP ${res.status}` }
    }

    return { success: true, key: json.key }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

/**
 * Build a URL to serve/preview an R2 object key.
 * Calls the /api/r2-url route which returns a short-lived presigned URL.
 */
export async function getR2Url(key: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/r2-url?key=${encodeURIComponent(key)}`)
    if (!res.ok) return null
    const { url } = await res.json()
    return url ?? null
  } catch {
    return null
  }
}
