/**
 * Test script — sends a bill-pull job to the local API server.
 *
 * Usage:
 *   1. Start the server: npm run dev
 *   2. Run this test:    npm run test-bill-pull
 */

import "dotenv/config";

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

async function main() {
  console.log("🧪 Testing bill-pull job against Telecom Portal A portal\n");

  // 1. Create a job
  console.log("1️⃣  Creating job...");
  const createRes = await fetch(`${BASE_URL}/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: `test-${Date.now()}`,
      type: "bill_pull",
      username: "test-user@example.com",
      password: "test-password-123",
      portal: "https://telecom-a.example.invalid/acctmgmt/",
    }),
  });

  if (!createRes.ok) {
    console.error("❌ Failed to create job:", await createRes.text());
    process.exit(1);
  }

  const job = await createRes.json();
  console.log(`   Job created: ${job.job_id}`);
  console.log(`   Status: ${job.status}`);
  if (job.session_id) {
    console.log(
      `   🔗 Live view: https://browserbase.com/sessions/${job.session_id}`,
    );
  }

  // 2. Poll for completion
  console.log("\n2️⃣  Polling for completion...");
  let attempts = 0;
  const maxAttempts = 60; // 60 * 2s = 2 minutes

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    attempts++;

    const statusRes = await fetch(`${BASE_URL}/job/${job.job_id}`);
    const status = await statusRes.json();

    process.stdout.write(
      `   [${attempts}/${maxAttempts}] Status: ${status.status}`,
    );

    if (status.status === "mfa_requested") {
      console.log(
        "\n\n🔐 MFA requested! In production, external job orchestrator would send the code.",
      );
      console.log("   To test manually:");
      console.log(
        `   curl -X PATCH ${BASE_URL}/job/${job.job_id} -H 'Content-Type: application/json' -d '{"mfa_code":"123456"}'`,
      );
      console.log("\n   Continuing to poll...");
    } else if (status.status === "success") {
      console.log("\n\n✅ Job completed successfully!");
      console.log("   Result:", JSON.stringify(status.job_data, null, 2));
      return;
    } else if (status.status === "failure") {
      console.log("\n\n❌ Job failed!");
      console.log("   Error:", status.error_message);
      process.exit(1);
    } else {
      process.stdout.write("\r");
    }
  }

  console.log("\n⏰ Timeout — job didn't complete within 2 minutes");
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
