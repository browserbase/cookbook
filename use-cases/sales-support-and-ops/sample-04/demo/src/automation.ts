import { installPageHealth, readPageHealth } from "./page-health.js";
import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { z } from "zod";
import { config } from "./config.js";
import {
  WorkflowState,
  WorkflowStage,
  WorkflowResult,
  StatusCallback,
  MetricsCallback,
  MetricsSnapshot,
  TestResult,
  WorkAppTaskPreview,
} from "./types.js";

export class WorkAppTestAutomation {
  private stagehand: Stagehand | null = null;
  private sessionId: string = "";
  private sessionUrl: string = "";
  private statusCallback: StatusCallback | null = null;
  private metricsCallback: MetricsCallback | null = null;
  private metricsPoller: NodeJS.Timeout | null = null;
  private lastMetricsSnapshot: any = null;
  private customTimers: Map<string, number> = new Map();
  private startTime: number = 0;

  constructor(
    statusCallback?: StatusCallback,
    metricsCallback?: MetricsCallback,
  ) {
    this.statusCallback = statusCallback || null;
    this.metricsCallback = metricsCallback || null;
  }

  // ==========================================================================
  // Performance Metrics Methods
  // ==========================================================================

  async broadcastPerformanceMetrics(): Promise<void> {
    if (!this.metricsCallback || !this.stagehand?.browser) return;

    try {
      const page = await this.stagehand.browser.context.activePage();
      if (!page) return;
      const observed = await page.evaluate(readPageHealth);

      this.metricsCallback({
        timestamp: new Date().toISOString(),
        performanceMetrics: {
          initialPageLoad: this.customTimers.get("pageLoad") ?? null,
          domInteractiveTime: observed.domInteractiveTime,
          loginButtonClickTime: this.customTimers.get("loginButtonClick") ?? null,
          emailFieldFillTime: this.customTimers.get("emailFill") ?? null,
          passwordFieldFillTime: this.customTimers.get("passwordFill") ?? null,
          formSubmissionTime: this.customTimers.get("formSubmit") ?? null,
          postSubmitWaitTime: this.customTimers.get("postSubmitWait") ?? null,
          totalLoginFlowTime: this.startTime ? Date.now() - this.startTime : null,
        },
        pageHealth: {
          pageUrl: observed.pageUrl,
          pageTitle: observed.pageTitle,
          statusCode: observed.statusCode,
          errors: observed.errors,
          errorsTruncated: observed.errorsTruncated,
          errorCoverage: observed.errorCoverage,
        },
      });
    } catch (error) {
      console.warn("Failed to collect performance metrics:", error);
    }
  }

  async startMetricsPolling(): Promise<void> {
    this.metricsPoller = setInterval(async () => {
      await this.broadcastPerformanceMetrics();
    }, config.automation.metricsPollingInterval);
  }

  stopMetricsPolling(): void {
    if (this.metricsPoller) {
      clearInterval(this.metricsPoller);
      this.metricsPoller = null;
    }
  }

  // ==========================================================================
  // Status Emission
  // ==========================================================================

  private emitStatus(
    stage: WorkflowStage,
    message: string,
    metadata?: Record<string, any>,
  ): void {
    const state: WorkflowState = {
      stage,
      message,
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        sessionId: this.sessionId,
        sessionUrl: this.sessionUrl,
      },
    };

    if (this.statusCallback) {
      this.statusCallback(state);
    }
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async initialize(): Promise<void> {
    this.emitStatus("initializing", "Creating Browserbase session...");

    try {
      this.stagehand = await Stagehand.create(
        StagehandCreateOptionsSchema.parse({
          browser: await browserbase.launch({
            apiKey: config.browserbase.apiKey,
            projectId: config.browserbase.projectId,
            ...{
              proxies: true,
              browserSettings: {
                advancedStealth: true,
                solveCaptchas: true,
              },
            },
          }),
          model: {
            modelName: "openai/gpt-4o-mini",
            apiKey: config.gemini.apiKey,
          },
          cache: true,
        }),
      );

      this.sessionId = this.stagehand.browser.sessionId || "";

      // Fetch the live view URL from Browserbase API
      try {
        const response = await fetch(
          `https://www.browserbase.com/v1/sessions/${this.sessionId}/debug`,
          {
            headers: {
              "x-bb-api-key": config.browserbase.apiKey,
            },
          },
        );

        if (response.ok) {
          const debugInfo = (await response.json()) as {
            debuggerFullscreenUrl?: string;
            liveViewUrl?: string;
          };
          this.sessionUrl =
            debugInfo.debuggerFullscreenUrl ||
            debugInfo.liveViewUrl ||
            `https://www.browserbase.com/sessions/${this.sessionId}`;
        } else {
          // Fallback to default URL if API call fails
          this.sessionUrl = `https://www.browserbase.com/sessions/${this.sessionId}`;
        }
      } catch (error) {
        console.warn("Failed to fetch live view URL, using fallback:", error);
        this.sessionUrl = `https://www.browserbase.com/sessions/${this.sessionId}`;
      }

      this.emitStatus(
        "initializing",
        "Browserbase session created successfully",
        {
          sessionId: this.sessionId,
          sessionUrl: this.sessionUrl,
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.emitStatus("error", `Initialization failed: ${errorMessage}`);
      throw error;
    }
  }

  // ==========================================================================
  // Workflow Methods
  // ==========================================================================

  async navigateToSignup(): Promise<void> {
    const startTime = performance.now();

    this.emitStatus("navigating", "Loading WorkApp signup page...");

    if (!this.stagehand?.browser) {
      throw new Error("Stagehand not initialized");
    }

    this.emitStatus(
      "navigating",
      `Navigating to ${config.automation.targetUrl}`,
    );

    const page = await this.stagehand.browser.context.activePage();
    if (!page) throw new Error("No active page");
    await page.addInitScript(installPageHealth);
    await page.goto(
      config.automation.targetUrl,
      {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      },
    );

    const endTime = performance.now();
    this.customTimers.set("pageLoad", endTime - startTime);

    this.emitStatus(
      "navigating",
      `Page loaded in ${(endTime - startTime).toFixed(0)}ms`,
    );
  }

  private async retryAction(
    actionFn: () => Promise<void>,
    actionName: string,
    maxRetries: number = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await actionFn();
        return;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (attempt === maxRetries) {
          this.emitStatus(
            "error",
            `${actionName} failed after ${maxRetries} attempts: ${errorMessage}`,
          );
          throw error;
        }

        this.emitStatus(
          "filling_email",
          `${actionName} failed (attempt ${attempt}/${maxRetries}), retrying...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  async fillSignupForm(): Promise<void> {
    const flowStartTime = performance.now();

    if (!this.stagehand?.browser) {
      throw new Error("Stagehand not initialized");
    }

    try {
      // Step 1: Click the login button
      this.emitStatus("filling_email", "Clicking the login button...");
      const loginButtonStart = performance.now();
      await this.retryAction(async () => {
        await this.stagehand!.act(`click on the login button`, {
          page: (await this.stagehand!.browser.context.activePage())!,
        });
      }, "Click login button");
      this.customTimers.set(
        "loginButtonClick",
        performance.now() - loginButtonStart,
      );

      // Wait for page to load after clicking login
      await (await this.stagehand.browser.context.activePage())!.waitForLoadState(
        "domcontentloaded",
      );
      await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
        1500,
      );
      await this.broadcastPerformanceMetrics();

      // Step 2: Enter email
      this.emitStatus("filling_email", "Entering email address...");
      const emailStart = performance.now();
      await this.retryAction(async () => {
        await this.stagehand!.act(
          `enter "${config.work_app.email}" in the email field`,
          { page: (await this.stagehand!.browser.context.activePage())! },
        );
      }, "Enter email");
      this.customTimers.set("emailFill", performance.now() - emailStart);
      await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
        1000,
      );
      await this.broadcastPerformanceMetrics();

      // Step 3: Enter password
      this.emitStatus("filling_password", "Entering password...");
      const passwordStart = performance.now();
      await this.retryAction(async () => {
        await this.stagehand!.act(
          `enter "${config.work_app.password}" in the password field`,
          { page: (await this.stagehand!.browser.context.activePage())! },
        );
      }, "Enter password");
      this.customTimers.set("passwordFill", performance.now() - passwordStart);
      await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
        1000,
      );
      await this.broadcastPerformanceMetrics();

      // Step 4: Click login/submit button
      this.emitStatus("submitting_form", "Submitting login form...");
      const submitStart = performance.now();
      await this.retryAction(async () => {
        await this.stagehand!.act(`click the login button to submit the form`, {
          page: (await this.stagehand!.browser.context.activePage())!,
        });
      }, "Submit form");
      this.customTimers.set("formSubmit", performance.now() - submitStart);

      // Measure the deliberate post-submit delay; this does not observe a redirect.
      const postSubmitWaitStart = performance.now();
      await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
        3000,
      );
      this.customTimers.set("postSubmitWait", performance.now() - postSubmitWaitStart);

      await this.broadcastPerformanceMetrics();

      const endTime = performance.now();
      this.emitStatus(
        "submitting_form",
        `Login flow completed in ${(endTime - flowStartTime).toFixed(0)}ms`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.emitStatus("error", `Form filling failed: ${errorMessage}`);
      throw error;
    }
  }

  async detectTestResult(): Promise<TestResult> {
    this.emitStatus(
      "detecting_result",
      "Analyzing login outcome and checking for WorkApp dashboard...",
    );

    if (!this.stagehand?.browser) {
      throw new Error("Stagehand not initialized");
    }

    // Wait for potential redirects and page loads after login
    await (await this.stagehand.browser.context.activePage())!.waitForTimeout(
      5000,
    );

    try {
      const currentUrl =
        await (await this.stagehand.browser.context.activePage())!.url();

      // Check if we're on the WorkApp app/dashboard
      const isOnDashboard =
        currentUrl.includes("app.work_app.com") ||
        currentUrl.includes("/home") ||
        currentUrl.includes("/workspace");

      this.emitStatus("detecting_result", `Current URL: ${currentUrl}`);

      const pageState = (
        await this.stagehand.extract(
          "Analyze the current page to determine if the user successfully logged into WorkApp. " +
            "A SUCCESSFUL login means the user is now viewing the WorkApp dashboard/portal with: " +
            "- Workspace selector or workspace name visible " +
            "- User profile icon/avatar in the navigation " +
            "- Main dashboard interface with projects, tasks, or spaces " +
            "- Navigation menu (sidebar) with options like Home, Inbox, Docs, Dashboards, etc. " +
            "\n\n" +
            "A FAILED login means: " +
            '- Still on the login page with error messages like "incorrect password", "user not found", "invalid credentials" ' +
            "- Login form is still visible and not progressed " +
            "- Error banners or messages indicating authentication failure " +
            "\n\n" +
            "Look carefully at the page content and provide: " +
            "{success: true if logged into dashboard, false if still on login or error occurred, " +
            'message: "detailed description of what elements you see and why you determined success/failure"}',
          z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          { page: (await this.stagehand.browser.context.activePage())! },
        )
      ).data;

      let result: TestResult;

      if (
        pageState &&
        typeof pageState === "object" &&
        "success" in pageState
      ) {
        // Combine AI detection with URL check for higher confidence
        const finalSuccess = pageState.success && isOnDashboard;

        result = {
          success: finalSuccess,
          message: `${pageState.message} | URL: ${currentUrl}`,
          screenshotPath: await this.captureScreenshot("login-result"),
          timestamp: new Date().toISOString(),
        };
      } else {
        // Fallback to URL-based detection
        result = {
          success: isOnDashboard,
          message: isOnDashboard
            ? `Successfully logged in - navigated to WorkApp dashboard at ${currentUrl}`
            : `Login may have failed - still at ${currentUrl}`,
          screenshotPath: await this.captureScreenshot("login-result"),
          timestamp: new Date().toISOString(),
        };
      }

      this.emitStatus(
        "validating_result",
        `Test ${result.success ? "PASSED" : "FAILED"}: ${result.message}`,
      );

      return result;
    } catch (error) {
      return {
        success: false,
        message: `Detection error: ${error}`,
        screenshotPath: await this.captureScreenshot("error"),
        timestamp: new Date().toISOString(),
      };
    }
  }

  async captureScreenshot(name: string): Promise<string> {
    if (!this.stagehand?.browser) return "";

    try {
      const path = `screenshots/${name}-${Date.now()}.png`;
      await (await this.stagehand.browser.context.activePage())!.screenshot({
        path,
        fullPage: true,
      });
      return path;
    } catch (error) {
      console.warn("Failed to capture screenshot:", error);
      return "";
    }
  }

  // ==========================================================================
  // Main Run Method
  // ==========================================================================

  async run(): Promise<WorkflowResult> {
    this.startTime = Date.now();

    try {
      await this.initialize();
      await this.startMetricsPolling();

      await this.navigateToSignup();
      await this.fillSignupForm();
      const testResult = await this.detectTestResult();

      this.stopMetricsPolling();

      if (!this.stagehand) {
        throw new Error("Stagehand not initialized");
      }

      const taskPreview: WorkAppTaskPreview = {
        testName: "WorkApp Login Flow Performance Test",
        status: testResult.success ? "PASSED" : "FAILED",
        duration: Date.now() - this.startTime,
        metrics: {
          pageLoadTime: this.customTimers.get("pageLoad") || 0,
          formFillTime:
            (this.customTimers.get("emailFill") || 0) +
            (this.customTimers.get("passwordFill") || 0),
          totalLoginFlowTime: Date.now() - this.startTime,
        },
        screenshot: testResult.screenshotPath,
      };

      this.emitStatus("completed", "Test completed!", {
        result: { taskPreview },
      });

      return {
        success: true,
        taskPreview,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (this.stagehand?.browser) {
        await this.captureScreenshot("error");
      }

      this.emitStatus("error", errorMessage, { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    } finally {
      this.stopMetricsPolling();
      if (this.stagehand) {
        await this.stagehand.close();
        await this.stagehand.browser.close();
      }
    }
  }
}
