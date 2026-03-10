/**
 * Shared R2 utility helpers.
 */

/**
 * Sanitize a filename for use as an R2 object key segment.
 * - Replaces spaces with hyphens
 * - Removes characters that are not safe in S3-compatible keys
 * - Preserves the extension
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .toLowerCase()
}

/**
 * Derive whether a string looks like an R2 object key (not a Base64 data URL or http URL).
 * Used to avoid re-uploading already-migrated fields.
 */
export function isR2Key(value: string | null | undefined): boolean {
  if (!value) return false
  // R2 keys start with known prefixes; data URLs start with "data:", http URLs with "http"
  return (
    !value.startsWith("data:") &&
    !value.startsWith("http://") &&
    !value.startsWith("https://") &&
    value.length < 1024
  )
}

/**
 * Derive whether a string is a Base64 data URL.
 */
export function isBase64DataUrl(value: string | null | undefined): boolean {
  if (!value) return false
  return value.startsWith("data:")
}
