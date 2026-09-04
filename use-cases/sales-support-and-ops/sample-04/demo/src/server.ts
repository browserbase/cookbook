import { RunStateStore } from "./run-state.js";
import express, { Request, Response } from "express";
import chalk from "chalk";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { config, validateConfig } from "./config.js";
import { WorkAppTestAutomation } from "./automation.js";
import { WorkflowState, MetricsSnapshot } from "./types.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Validate Configuration
// ============================================================================

validateConfig();

// ============================================================================
// Express App Setup
// ============================================================================

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// ============================================================================
// SSE Client Management
// ============================================================================

const sseStatusClients: Response[] = [];
const sseMetricsClients: Response[] = [];

function broadcastStatus(state: WorkflowState): void {
  const data = `data: ${JSON.stringify(state)}\n\n`;
  sseStatusClients.forEach((client) => {
    try {
      client.write(data);
    } catch (error) {
      console.warn("Failed to send status to client");
    }
  });
}

function broadcastMetrics(metrics: MetricsSnapshot): void {
  const data = `data: ${JSON.stringify(metrics)}\n\n`;
  sseMetricsClients.forEach((client) => {
    try {
      client.write(data);
    } catch (error) {
      console.warn("Failed to send metrics to client");
    }
  });
}

// ============================================================================
// Global Automation Instance
// ============================================================================

const runs = new RunStateStore();

// ============================================================================
// API Routes
// ============================================================================

// Status SSE endpoint
app.get("/api/status", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  sseStatusClients.push(res);

  res.write(`data: ${JSON.stringify(runs.snapshot())}\n\n`);

  req.on("close", () => {
    const index = sseStatusClients.indexOf(res);
    if (index !== -1) {
      sseStatusClients.splice(index, 1);
    }
  });
});

// Metrics SSE endpoint
app.get("/api/metrics", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  sseMetricsClients.push(res);

  const initialMetrics: MetricsSnapshot = {
    timestamp: new Date().toISOString(),
    performanceMetrics: {
      initialPageLoad: null,
      domInteractiveTime: null,
      loginButtonClickTime: null,
      emailFieldFillTime: null,
      passwordFieldFillTime: null,
      formSubmissionTime: null,
      postSubmitWaitTime: null,
      totalLoginFlowTime: null,
    },
    pageHealth: {
      pageUrl: "",
      pageTitle: "",
      statusCode: null,
      errors: null,
      errorsTruncated: null,
      errorCoverage: "unavailable",
    },
  };
  res.write(`data: ${JSON.stringify(initialMetrics)}\n\n`);

  req.on("close", () => {
    const index = sseMetricsClients.indexOf(res);
    if (index !== -1) {
      sseMetricsClients.splice(index, 1);
    }
  });
});

// The latest snapshot also supports clients that cannot keep an SSE connection.
app.get("/api/run", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(runs.snapshot());
});

app.post("/api/start", (_req: Request, res: Response) => {
  if (runs.snapshot().isRunning) {
    res.status(409).json({ success: false, error: "Test already running" });
    return;
  }
  const runId = runs.begin();
  broadcastStatus(runs.snapshot());
  // Include constructor failures and cleanup rejection in the same terminal path.
  void Promise.resolve().then(async () => {
    const automation = new WorkAppTestAutomation(
      (state: WorkflowState) => {
        runs.update(runId, state);
        broadcastStatus(runs.snapshot());
      },
      (metrics: MetricsSnapshot) => broadcastMetrics(metrics),
    );
    return automation.run();
  }).then(result => {
    runs.finish(runId, result);
    broadcastStatus(runs.snapshot());
  }).catch(() => {
    runs.fail(runId);
    broadcastStatus(runs.snapshot());
  });
  res.json({ success: true, runId, message: "Test started successfully" });
});

// Health check endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    isRunning: runs.snapshot().isRunning,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(config.server.port, () => {
  console.log(
    chalk.blue.bold(
      "\n╔════════════════════════════════════════════════════════════════╗",
    ),
  );
  console.log(
    chalk.blue.bold(
      "║                                                                ║",
    ),
  );
  console.log(
    chalk.blue.bold(
      "║           WorkApp Automated Testing Demo - Browserbase        ║",
    ),
  );
  console.log(
    chalk.blue.bold(
      "║                                                                ║",
    ),
  );
  console.log(
    chalk.blue.bold(
      "╚════════════════════════════════════════════════════════════════╝\n",
    ),
  );

  console.log(
    chalk.green("✓ Server running at:"),
    chalk.cyan(`http://${config.server.host}:${config.server.port}`),
  );
  console.log(
    chalk.green("✓ Target URL:"),
    chalk.cyan(config.automation.targetUrl),
  );
  console.log(
    chalk.green("✓ Metrics polling:"),
    chalk.cyan(`${config.automation.metricsPollingInterval}ms`),
  );
  console.log(
    chalk.green("✓ Browserbase project:"),
    chalk.cyan(config.browserbase.projectId),
  );
  console.log(chalk.gray("\nPress Ctrl+C to stop the server\n"));
});

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on("SIGINT", () => {
  console.log(chalk.yellow("\n\nShutting down gracefully..."));
  sseStatusClients.forEach((client) => client.end());
  sseMetricsClients.forEach((client) => client.end());
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log(chalk.yellow("\n\nShutting down gracefully..."));
  sseStatusClients.forEach((client) => client.end());
  sseMetricsClients.forEach((client) => client.end());
  process.exit(0);
});
