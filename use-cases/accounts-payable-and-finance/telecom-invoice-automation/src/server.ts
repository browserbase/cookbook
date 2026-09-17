/**
 * Standard Job API Server — implements external job orchestrator's API contract.
 *
 * POST   /job           → Create a new bill-pull or bill-pay job
 * GET    /job/:job_id   → Check job status
 * PATCH  /job/:job_id   → Provide MFA code
 *
 * This is the Approach Service that external job orchestrator's Testing Service talks to.
 */

import "dotenv/config";
import express from "express";
import { createJob, getJob, submitMfa } from "./job-runner.js";
import { loadPortal } from "./portal-loader.js";
import type { CreateJobRequest, MfaPatchRequest } from "./types.js";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

// ---------------------------------------------------------------------------
// POST /job — Create Job
// ---------------------------------------------------------------------------

app.post("/job", async (req, res) => {
  try {
    const body = req.body as CreateJobRequest;

    // Validate required fields
    if (
      !body.job_id ||
      !body.type ||
      !body.username ||
      !body.password ||
      !body.portal
    ) {
      res
        .status(400)
        .json({
          error:
            "Missing required fields: job_id, type, username, password, portal",
        });
      return;
    }

    if (body.type !== "bill_pull" && body.type !== "bill_pay") {
      res.status(400).json({ error: "type must be 'bill_pull' or 'bill_pay'" });
      return;
    }

    // Look up the portal definition
    const portal = loadPortal(body.portal);
    if (!portal) {
      res.status(400).json({
        error: `No portal definition found for URL: ${body.portal}. Use 'npm run generate-script' to create one.`,
      });
      return;
    }

    const response = await createJob(body, portal);
    res.status(202).json(response);
  } catch (err) {
    console.error("POST /job error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /job/:job_id — Check Job Status
// ---------------------------------------------------------------------------

app.get("/job/:job_id", (req, res) => {
  const response = getJob(req.params.job_id);
  if (!response) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.status(200).json(response);
});

// ---------------------------------------------------------------------------
// PATCH /job/:job_id — Provide Additional Information (MFA)
// ---------------------------------------------------------------------------

app.patch("/job/:job_id", async (req, res) => {
  try {
    const body = req.body as MfaPatchRequest;
    if (!body.mfa_code) {
      res.status(400).json({ error: "Missing required field: mfa_code" });
      return;
    }

    const response = await submitMfa(req.params.job_id, body.mfa_code);
    if (!response) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.status(200).json(response);
  } catch (err) {
    console.error("PATCH /job/:job_id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({ status: "ok", portals: "loaded" });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  external job orchestrator Bill Automation — Approach Service                ║
║  Powered by Browserbase + Stagehand                     ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  API running on http://localhost:${String(PORT).padEnd(25)}║
║                                                          ║
║  Endpoints:                                              ║
║    POST   /job           Create a job                    ║
║    GET    /job/:job_id   Check status                    ║
║    PATCH  /job/:job_id   Submit MFA code                 ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});
