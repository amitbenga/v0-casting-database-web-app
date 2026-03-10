/**
 * Test script: Verify R2 upload works end-to-end
 * Run: node scripts/test-r2-upload.js
 *
 * Required env vars:
 *   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 */

import { S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const requiredEnvVars = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"];
const missing = requiredEnvVars.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error("[FAIL] Missing env vars:", missing.join(", "));
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;
const TEST_KEY = `_test/upload-verification-${Date.now()}.txt`;
const TEST_BODY = `R2 upload test at ${new Date().toISOString()}`;

async function main() {
  console.log("[INFO] R2_ENDPOINT:", process.env.R2_ENDPOINT);
  console.log("[INFO] R2_BUCKET_NAME:", BUCKET);
  console.log("[INFO] Test key:", TEST_KEY);

  // 1. Upload a test object
  console.log("\n[STEP 1] Uploading test object...");
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: TEST_KEY,
        Body: TEST_BODY,
        ContentType: "text/plain",
      })
    );
    console.log("[OK] PutObject succeeded");
  } catch (err) {
    console.error("[FAIL] PutObject error:", err.message);
    process.exit(1);
  }

  // 2. Verify the object exists
  console.log("\n[STEP 2] Verifying object exists (HeadObject)...");
  try {
    const head = await s3.send(
      new HeadObjectCommand({
        Bucket: BUCKET,
        Key: TEST_KEY,
      })
    );
    console.log("[OK] HeadObject succeeded, ContentLength:", head.ContentLength);
  } catch (err) {
    console.error("[FAIL] HeadObject error:", err.message);
    process.exit(1);
  }

  // 3. List objects in bucket to show current state
  console.log("\n[STEP 3] Listing objects in bucket (up to 100)...");
  try {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        MaxKeys: 100,
      })
    );
    const count = list.KeyCount ?? 0;
    console.log(`[OK] ListObjectsV2 returned ${count} object(s)`);
    if (list.Contents && list.Contents.length > 0) {
      console.log("Objects:");
      for (const obj of list.Contents.slice(0, 20)) {
        console.log(`  - ${obj.Key} (${obj.Size} bytes)`);
      }
      if (count > 20) console.log(`  ... and ${count - 20} more`);
    }
  } catch (err) {
    console.error("[FAIL] ListObjectsV2 error:", err.message);
  }

  console.log("\n[SUCCESS] R2 upload verification complete.");
}

main();
