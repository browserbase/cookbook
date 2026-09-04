import express, { type Request, type Response } from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config, validateConfig } from "./config.js";
import { ProviderSearchAutomation } from "./automation.js";
import type { WorkflowState } from "./types.js";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate configuration on startup
try {
  validateConfig();
  console.log(chalk.green("✓ Configuration validated"));
} catch (error) {
  console.error(chalk.red("✗ Configuration error:"), error);
  process.exit(1);
}

const app = express();
const port = config.port;

// State management
let automation: ProviderSearchAutomation | null = null;
let isRunning = false;
const sseClients: Response[] = [];

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, "..", "public")));

// SSE status broadcast helper
function broadcastStatus(state: WorkflowState): void {
  const data = `data: ${JSON.stringify(state)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(data);
    } catch (error) {
      console.warn("Failed to send SSE to client");
    }
  });
}

// Routes

// Serve the main HTML page
app.get("/", (req: Request, res: Response) => {
  try {
    const htmlPath = join(__dirname, "..", "public", "index.html");
    res.sendFile(htmlPath);
  } catch (error) {
    res.status(500).send("Error loading page");
  }
});

// SSE endpoint for real-time status updates
app.get("/api/status", (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Add client to list
  sseClients.push(res);
  console.log(
    chalk.blue(`SSE client connected. Total clients: ${sseClients.length}`),
  );

  // Send initial status
  const initialState: WorkflowState = {
    stage: "idle",
    message: "Connected to server",
    timestamp: new Date().toISOString(),
    approvalRequired: false,
    approved: false,
  };
  res.write(`data: ${JSON.stringify(initialState)}\n\n`);

  // Handle client disconnect
  req.on("close", () => {
    const index = sseClients.indexOf(res);
    if (index !== -1) {
      sseClients.splice(index, 1);
    }
    console.log(
      chalk.blue(
        `SSE client disconnected. Total clients: ${sseClients.length}`,
      ),
    );
  });
});

// Start automation endpoint
app.post("/api/start", async (req: Request, res: Response) => {
  if (isRunning) {
    res.status(400).json({
      success: false,
      error: "Automation is already running",
    });
    return;
  }

  try {
    // Create automation instance with status callback
    automation = new ProviderSearchAutomation((state: WorkflowState) => {
      broadcastStatus(state);
    });

    isRunning = true;

    // Start automation in background (don't await)
    automation
      .run()
      .then((result) => {
        console.log(chalk.green("Automation completed:"), result);
        isRunning = false;
      })
      .catch((error) => {
        console.error(chalk.red("Automation error:"), error);
        isRunning = false;
      });

    // Return immediate response
    res.json({
      success: true,
      message: "Automation started successfully",
    });

    console.log(chalk.green("✓ Automation started"));
  } catch (error) {
    isRunning = false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
    console.error(chalk.red("✗ Failed to start automation:"), errorMessage);
  }
});

// Health check endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    isRunning,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(port, () => {
  console.log(
    "\n" +
      chalk.bold.green("═══════════════════════════════════════════════════"),
  );
  console.log(chalk.bold.green("  Sample Organization Provider Search Demo Server"));
  console.log(
    chalk.bold.green("═══════════════════════════════════════════════════"),
  );
  console.log("");
  console.log(
    chalk.white(
      `  Server running at: ${chalk.cyan.bold(`http://localhost:${port}`)}`,
    ),
  );
  console.log(
    chalk.white(
      `  Health check:      ${chalk.gray(`http://localhost:${port}/api/health`)}`,
    ),
  );
  console.log("");
  console.log(
    chalk.yellow("  Open the URL above in your browser to start the demo"),
  );
  console.log("");
  console.log(
    chalk.bold.green("═══════════════════════════════════════════════════\n"),
  );
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log(chalk.yellow("\n\nShutting down gracefully..."));
  sseClients.forEach((client) => client.end());
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log(chalk.yellow("\n\nShutting down gracefully..."));
  sseClients.forEach((client) => client.end());
  process.exit(0);
});
