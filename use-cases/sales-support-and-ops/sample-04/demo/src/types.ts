import { z } from "zod";

// ============================================================================
// Workflow Stage Schema
// ============================================================================

export const WorkflowStageSchema = z.enum([
  "idle",
  "initializing",
  "navigating",
  "filling_email",
  "filling_password",
  "filling_workspace",
  "submitting_form",
  "detecting_result",
  "validating_result",
  "completed",
  "error",
]);

export type WorkflowStage = z.infer<typeof WorkflowStageSchema>;

// ============================================================================
// Workflow State Schema
// ============================================================================

export const WorkflowStateSchema = z.object({
  stage: WorkflowStageSchema,
  message: z.string(),
  timestamp: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// ============================================================================
// Metrics Schemas
// ============================================================================

export interface MetricsSnapshot {
  timestamp: string;
  performanceMetrics: {
    initialPageLoad: number | null;
    domInteractiveTime: number | null;
    loginButtonClickTime: number | null;
    emailFieldFillTime: number | null;
    passwordFieldFillTime: number | null;
    formSubmissionTime: number | null;
    postSubmitWaitTime: number | null;
    totalLoginFlowTime: number | null;
  };
  pageHealth: {
    pageUrl: string;
    pageTitle: string;
    statusCode: number | null;
    errors: string[] | null;
    errorsTruncated: boolean | null;
    errorCoverage: "document-start" | "unavailable";
  };
}

// ============================================================================
// Test Result Schemas
// ============================================================================

export interface TestResult {
  success: boolean;
  message: string;
  screenshotPath: string;
  timestamp: string;
}

export interface WorkAppTaskPreview {
  testName: string;
  status: "PASSED" | "FAILED";
  duration: number;
  metrics: {
    pageLoadTime: number;
    formFillTime: number;
    totalLoginFlowTime: number;
  };
  screenshot: string;
}

// ============================================================================
// Workflow Result Schema
// ============================================================================

export const WorkflowResultSchema = z.object({
  success: z.boolean(),
  taskPreview: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.string(),
});

export type WorkflowResult = z.infer<typeof WorkflowResultSchema>;

// ============================================================================
// Callback Types
// ============================================================================

export type StatusCallback = (state: WorkflowState) => void;
export type MetricsCallback = (metrics: MetricsSnapshot) => void;

// ============================================================================
// Config Schema
// ============================================================================

export const ConfigSchema = z.object({
  browserbase: z.object({
    apiKey: z.string().min(1, "Browserbase API key is required"),
    projectId: z.string().min(1, "Browserbase project ID is required"),
  }),
  gemini: z.object({
    apiKey: z.string().min(1, "Gemini API key is required"),
  }),
  work_app: z.object({
    email: z.string().email("Valid WorkApp email is required"),
    password: z.string().min(1, "WorkApp password is required"),
  }),
  automation: z.object({
    targetUrl: z.string().url(),
    timeout: z.number().positive(),
    metricsPollingInterval: z.number().positive(),
  }),
  server: z.object({
    port: z.number().int().positive(),
    host: z.string(),
  }),
  branding: z.object({
    colors: z.object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string(),
      dark: z.string(),
      light: z.string(),
    }),
    fonts: z.object({
      primary: z.string(),
    }),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;
