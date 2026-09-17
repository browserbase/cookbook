import {
  Stagehand,
  StagehandCreateOptionsSchema,
} from "@browserbasehq/stagehand";
import { Browserbase } from "@browserbasehq/sdk";
import { config } from "./config.js";
import {
  ProviderSearchResultSchema,
  type Doctor,
  type WorkflowResult,
  type WorkflowState,
} from "./types.js";
import boxen from "boxen";
import chalk from "chalk";

export type StatusCallback = (state: WorkflowState) => void;

export class ProviderSearchAutomation {
  private stagehand: Stagehand | null = null;
  private sessionId: string = "";
  private sessionUrl: string = "";
  private statusCallback: StatusCallback | null = null;

  constructor(statusCallback?: StatusCallback) {
    this.statusCallback = statusCallback || null;
  }

  private emitStatus(
    stage: WorkflowState["stage"],
    message: string,
    options: {
      approvalRequired?: boolean;
      approved?: boolean;
      result?: WorkflowState["result"];
      error?: string;
    } = {},
  ): void {
    const state: WorkflowState = {
      sessionId: this.sessionId || undefined,
      sessionUrl: this.sessionUrl || undefined,
      stage,
      message,
      timestamp: new Date().toISOString(),
      approvalRequired: options.approvalRequired || false,
      approved: options.approved || false,
      result: options.result,
      error: options.error,
    };

    if (this.statusCallback) {
      this.statusCallback(state);
    }

    // Also log to console
    console.log(chalk.blue(`[${stage}]`), message);
  }

  async initialize(): Promise<void> {
    this.emitStatus("initializing", "Creating Browserbase session...");

    this.stagehand = await Stagehand.create(
      StagehandCreateOptionsSchema.parse(await config.stagehand()),
    );
    if (this.stagehand.browser.sessionId) {
      this.sessionId = this.stagehand.browser.sessionId || "";

      // Get the live debug URL for embedding
      const bb = new Browserbase({
        apiKey: config.browserbase.apiKey,
      });

      try {
        const liveViewLinks = await bb.sessions.debug(this.sessionId);
        this.sessionUrl = liveViewLinks.debuggerFullscreenUrl;

        console.log(
          boxen(
            chalk.bold.green("🌐 Browserbase Live Debug View\n\n") +
              chalk.white(this.sessionUrl) +
              "\n\n" +
              chalk.gray(`Session ID: ${this.sessionId}`),
            {
              padding: 1,
              margin: 1,
              borderStyle: "round",
              borderColor: "green",
            },
          ),
        );

        this.emitStatus("initializing", "Session created successfully");
      } catch (error) {
        console.warn("Failed to get live debug URL, using regular session URL");
        this.sessionUrl = `https://www.browserbase.com/sessions/${this.stagehand.browser.sessionId}`;
        this.emitStatus(
          "initializing",
          "Session created successfully (fallback URL)",
        );
      }
    } else {
      throw new Error("Failed to create Browserbase session");
    }
  }

  async clickContinueAsGuest(): Promise<void> {
    if (!this.stagehand?.browser) {
      throw new Error("Stagehand not initialized");
    }

    this.emitStatus("navigating", "Navigating to health portal provider search...");

    try {
      await (await this.stagehand.browser.context.activePage())!.goto(
        config.automation.targetUrl,
        {
          waitUntil: "domcontentloaded", // More reliable than networkidle for slow sites
          timeout: config.automation.pageLoadTimeout,
        },
      );

      // Wait a bit for dynamic content to load
      await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
        3000,
      );

      this.emitStatus(
        "navigating",
        "Successfully loaded health portal find-care page",
      );

      // Wait for page to stabilize
      await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
        2000,
      );

      // Handle any cookie banners or popups
      try {
        await this.stagehand.act(
          "If there is a cookie acceptance banner or popup, click accept or close it",
          { page: (await this.stagehand.browser.context.activePage())! },
        );
        await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
          1000,
        );
      } catch (error) {
        console.log("No cookie banner detected");
      }

      this.emitStatus("clicking_guest", 'Clicking "Continue as a guest"...');

      // Click "Continue as guest" button
      await this.stagehand.act(
        'Click the "Continue as a guest" button or link',
        { page: (await this.stagehand.browser.context.activePage())! },
      );

      await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
        2000,
      );

      this.emitStatus(
        "clicking_guest",
        'Successfully clicked "Continue as a guest"',
      );
    } catch (error) {
      throw new Error(`Failed to navigate and click guest: ${error}`);
    }
  }

  async waitForHumanInput(): Promise<void> {
    if (!this.stagehand?.browser) {
      throw new Error("Stagehand not initialized");
    }

    this.emitStatus(
      "awaiting_human_input",
      "Please fill in the search criteria fields in the browser. " +
        'Automation will continue automatically when you reach the "Search by Care Provider" page.',
    );

    console.log(
      boxen(
        chalk.bold.yellow("⏸️  WAITING FOR HUMAN INPUT\n\n") +
          chalk.white("Please fill out the form in the browser.\n") +
          chalk.white("The automation will detect when you reach the\n") +
          chalk.white(
            '"Search by Care Provider" page and continue automatically.',
          ),
        {
          padding: 1,
          margin: 1,
          borderStyle: "round",
          borderColor: "yellow",
        },
      ),
    );

    const startTime = Date.now();
    const timeout = config.automation.humanInputTimeout;

    while (true) {
      try {
        // Check if "Search by Care Provider" text exists on page
        const searchTitleElement =
          (await this.stagehand.browser.context.activePage())!.locator(
            "text=Search by Care Provider",
          );
        const isVisible = await searchTitleElement.isVisible();

        if (isVisible) {
          this.emitStatus(
            "waiting_for_search_page",
            "Search by Care Provider page detected! Continuing automation...",
          );

          console.log(
            chalk.green.bold("✓ Human input completed - automation resuming"),
          );
          return;
        }
      } catch (error) {
        // Element not found yet, continue polling
      }

      if (Date.now() - startTime > timeout) {
        throw new Error("Timeout waiting for human input (5 minutes)");
      }

      await new Promise((resolve) =>
        setTimeout(resolve, config.automation.pollInterval),
      );
    }
  }

  async enterLocation(): Promise<void> {
    if (!this.stagehand?.browser) {
      throw new Error("Stagehand not initialized");
    }

    this.emitStatus("entering_location", "Entering location: 94109");

    try {
      await this.stagehand.act('Click "Update Location"', {
        page: (await this.stagehand.browser.context.activePage())!,
      });
      await this.stagehand.act(
        'Enter "94109" in the location or zip code field',
        { page: (await this.stagehand.browser.context.activePage())! },
      );
      await this.stagehand.act("Click Continue Button", {
        page: (await this.stagehand.browser.context.activePage())!,
      });

      await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
        1000,
      );

      this.emitStatus("entering_location", "Location entered successfully");
    } catch (error) {
      throw new Error(`Failed to enter location: ${error}`);
    }
  }

  async clickContinue(): Promise<void> {
    if (!this.stagehand?.browser) {
      throw new Error("Stagehand not initialized");
    }

    this.emitStatus("clicking_continue", "Clicking Continue button...");

    try {
      await this.stagehand.act(
        "Click the Continue button to proceed to provider types",
        { page: (await this.stagehand.browser.context.activePage())! },
      );

      await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
        3000,
      );

      this.emitStatus("clicking_continue", "Successfully clicked Continue");
    } catch (error) {
      throw new Error(`Failed to click continue: ${error}`);
    }
  }

  async selectFirstProviderType(): Promise<void> {
    if (!this.stagehand?.browser) {
      throw new Error("Stagehand not initialized");
    }

    this.emitStatus(
      "selecting_provider_type",
      "Selecting first care provider type...",
    );

    try {
      await this.stagehand.act(
        "Click on the first care provider type or category in the list",
        { page: (await this.stagehand.browser.context.activePage())! },
      );

      await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
        3000,
      );

      this.emitStatus(
        "selecting_provider_type",
        "Successfully selected provider type",
      );
    } catch (error) {
      throw new Error(`Failed to select provider type: ${error}`);
    }
  }

  async extractDoctors(): Promise<Doctor[]> {
    if (!this.stagehand?.browser) {
      throw new Error("Stagehand not initialized");
    }

    this.emitStatus("extracting_doctors", "Extracting provider information...");

    // Wait for the page to fully load
    await (await this.stagehand.browser.context.activePage())!.waitForLoadState(
      "domcontentloaded",
    );
    await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
      5000,
    ); // Increased initial wait for dynamic content

    const maxAttempts = config.automation.maxRetries;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(
          `Extraction attempt ${attempt}/${maxAttempts} - waiting for doctors to appear on page`,
        );

        // Extract doctor information using Stagehand
        const extraction = (
          await this.stagehand.extract(
            "Extract information about the first 5 doctors or healthcare providers from the search results. " +
              "For each doctor, get their name, specialty (if available), location or city, phone number (if available), " +
              "and address (if available). Return them in a doctors array.",
            ProviderSearchResultSchema,
            { page: (await this.stagehand.browser.context.activePage())! },
          )
        ).data;

        console.log("Extraction result:", extraction);

        const doctors: Doctor[] = extraction.doctors.slice(0, 5);

        // Check if we got valid results
        if (doctors.length > 0 && doctors.some((d) => d.name !== "Unknown")) {
          this.emitStatus(
            "extracting_doctors",
            `Extracted ${doctors.length} doctors`,
          );
          return doctors;
        }

        // If no valid results and we have another attempt, wait and retry
        if (attempt < maxAttempts) {
          console.warn(
            "No valid results found, waiting for doctors to load on page...",
          );
          const waitTime = Math.min(2000 * attempt, 5000);
          this.emitStatus(
            "extracting_doctors",
            `Waiting for doctors to appear (attempt ${attempt}/${maxAttempts}, waiting ${waitTime / 1000}s)...`,
          );
          await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
            waitTime,
          );
        }
      } catch (error) {
        throw new Error(`Provider extraction returned incompatible data: ${error}`);
      }
    }

    // If all attempts failed or returned no results
    console.error(
      `Failed to extract doctors after ${maxAttempts} attempts - page may not have loaded doctors`,
    );
    this.emitStatus(
      "extracting_doctors",
      "Extraction failed because no providers were found",
    );
    throw new Error(`No providers found after ${maxAttempts} extraction attempts`);
  }

  async run(): Promise<WorkflowResult> {
    const startTime = Date.now();

    try {
      // Initialize session
      await this.initialize();

      // Click continue as guest
      await this.clickContinueAsGuest();

      // Wait for human to fill form
      await this.waitForHumanInput();

      // Enter location
      await this.enterLocation();

      // Click continue
      await this.clickContinue();

      // Select first provider type
      await this.selectFirstProviderType();

      // Extract doctors
      const doctors = await this.extractDoctors();

      const result: WorkflowResult = {
        success: true,
        doctors,
        timestamp: new Date().toISOString(),
      };

      this.emitStatus(
        "completed",
        "Provider search workflow completed successfully!",
        {
          result: { doctors },
        },
      );

      console.log(
        boxen(
          chalk.bold.green("✓ WORKFLOW COMPLETED\n\n") +
            chalk.white(`Found ${doctors.length} doctors\n`) +
            chalk.gray(
              `Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
            ),
          {
            padding: 1,
            margin: 1,
            borderStyle: "round",
            borderColor: "green",
          },
        ),
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Take screenshot on error if possible
      if (this.stagehand?.browser) {
        try {
          await (await this.stagehand.browser.context.activePage())!.screenshot(
            {
              path: `error-${Date.now()}.png`,
              fullPage: true,
            },
          );
          console.log(chalk.yellow("📸 Error screenshot saved"));
        } catch (screenshotError) {
          console.warn("Failed to capture error screenshot");
        }
      }

      this.emitStatus("error", errorMessage, { error: errorMessage });

      console.log(
        boxen(
          chalk.bold.red("✗ WORKFLOW FAILED\n\n") + chalk.white(errorMessage),
          {
            padding: 1,
            margin: 1,
            borderStyle: "round",
            borderColor: "red",
          },
        ),
      );

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    } finally {
      // Cleanup
      if (this.stagehand) {
        try {
          await this.stagehand.close();
          await this.stagehand.browser.close();
        } catch (error) {
          console.warn("Failed to close Stagehand session");
        }
      }
    }
  }
}
