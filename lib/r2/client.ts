/**
 * Cloudflare R2 client — server-side only.
 * Never import this from client components.
 *
 * Uses @aws-sdk/client-s3 with region "auto" pointing at the R2 endpoint.
 */
import { S3Client } from "@aws-sdk/client-s3"

let _client: S3Client | null = null

export function getR2Client(): S3Client {
  if (_client) return _client

  const endpoint = process.env.R2_ENDPOINT
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 environment variables are not set. Required: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
    )
  }

  _client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return _client
}

export function getR2BucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME
  if (!bucket) throw new Error("R2_BUCKET_NAME environment variable is not set")
  return bucket
}
