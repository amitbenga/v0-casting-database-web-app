/**
 * Minimal script to check if R2 env vars are available in the execution environment
 */

const vars = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"];

console.log("Checking R2 environment variables...\n");

for (const v of vars) {
  const val = process.env[v];
  if (val) {
    // Mask the value for security
    const masked = val.length > 8 ? val.slice(0, 4) + "****" + val.slice(-4) : "****";
    console.log(`${v}: ${masked}`);
  } else {
    console.log(`${v}: NOT SET`);
  }
}

console.log("\nDone.");
