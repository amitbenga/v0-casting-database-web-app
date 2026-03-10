/**
 * Server-side R2 upload helpers.
 * Never import this from client components.
 */
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { getR2Client, getR2BucketName } from "./client"

export interface UploadResult {
  success: boolean
  key?: string
  error?: string
}

/**
 * Upload a Buffer or Uint8Array to R2 under the given key.
 * Returns the object key on success.
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<UploadResult> {
  try {
    const client = getR2Client()
    const bucket = getR2BucketName()

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    )

    return { success: true, key }
  } catch (err) {
    console.error("[r2] uploadToR2 failed:", key, err)
    return { success: false, error: String(err) }
  }
}

/**
 * Delete an object from R2 by key.
 */
export async function deleteFromR2(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getR2Client()
    const bucket = getR2BucketName()

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    return { success: true }
  } catch (err) {
    console.error("[r2] deleteFromR2 failed:", key, err)
    return { success: false, error: String(err) }
  }
}

/**
 * Generate a presigned GET URL for a private R2 object.
 * Default expiry: 1 hour.
 */
export async function getR2PresignedUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  try {
    const client = getR2Client()
    const bucket = getR2BucketName()

    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: expiresInSeconds }
    )
    return url
  } catch (err) {
    console.error("[r2] getR2PresignedUrl failed:", key, err)
    return null
  }
}

/**
 * Upload a Base64 data URL to R2, returning the object key.
 * Used during migration of existing Base64 payloads.
 */
export async function uploadBase64ToR2(
  key: string,
  dataUrl: string
): Promise<UploadResult> {
  // data:[<mediatype>][;base64],<data>
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    return { success: false, error: "Invalid Base64 data URL format" }
  }

  const contentType = match[1]
  const base64Data = match[2]
  const buffer = Buffer.from(base64Data, "base64")

  return uploadToR2(key, buffer, contentType)
}
