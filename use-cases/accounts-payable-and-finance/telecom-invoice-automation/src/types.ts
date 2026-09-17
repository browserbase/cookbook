/**
 * Types matching external job orchestrator's Standard Job API spec from their PRD.
 *
 * These types define the contract between external job orchestrator's Testing Service
 * and our Browserbase-powered Approach Service.
 */

// ---------------------------------------------------------------------------
// Job types
// ---------------------------------------------------------------------------

export type JobType = "bill_pull" | "bill_pay";

export type JobStatus =
  "pending" | "in_progress" | "mfa_requested" | "success" | "failure";

export type EvalStatus =
  "eval_success" | "eval_failure" | "eval_needs_human_review";

// ---------------------------------------------------------------------------
// Payment instrument
// ---------------------------------------------------------------------------

export interface PaymentInstrument {
  type: "ach";
  account_number: string;
  routing_number: string;
}

// ---------------------------------------------------------------------------
// Job request / response
// ---------------------------------------------------------------------------

export interface CreateJobRequest {
  job_id: string;
  type: JobType;
  username: string;
  password: string;
  portal: string;
  payment_instrument?: PaymentInstrument;
  payment_amount_in_cents?: number;
}

export interface BillPullJobData {
  balance: number;
  due_date: string; // "YYYY-MM-DD HH:mm:ss"
}

export interface BillPayJobData {
  transaction_id: string;
  payment_date: string; // "YYYY-MM-DD HH:mm:ss"
  amount_paid: number;
}

export type JobData = BillPullJobData | BillPayJobData;

export interface JobResponse {
  job_id: string;
  status: JobStatus;
  type: JobType;
  job_data?: JobData;
  error_message?: string;
  session_id?: string; // Browserbase session ID for replay/debugging
}

export interface MfaPatchRequest {
  mfa_code: string;
}

// ---------------------------------------------------------------------------
// Portal definition — what Claude Code generates per portal
// ---------------------------------------------------------------------------

export interface PortalDefinition {
  /** Unique slug, e.g. "telecom-a", "telecom-b", "telecom-c" */
  id: string;
  /** Human-readable name */
  name: string;
  /** Login URL for the portal */
  loginUrl: string;
  /** Stagehand steps for bill pull */
  billPullSteps: AutomationStep[];
  /** Stagehand steps for bill pay (optional for Phase 1) */
  billPaySteps?: AutomationStep[];
  /** How to detect MFA prompts */
  mfaDetection?: MfaDetection;
}

export interface AutomationStep {
  /** What this step does (for logging) */
  description: string;
  /** The Stagehand action type */
  action: "navigate" | "act" | "extract" | "observe" | "screenshot" | "wait";
  /** Instruction for Stagehand (natural language) */
  instruction: string;
  /** Optional: Zod-like schema for extract actions */
  schema?: Record<string, string>;
  /** Optional: wait time in ms for "wait" actions */
  waitMs?: number;
  /** Optional: whether this step's extracted data is the final result */
  isFinalResult?: boolean;
}

export interface MfaDetection {
  /** Natural language description of what MFA prompt looks like */
  observeInstruction: string;
  /** Elements that indicate MFA is being requested */
  indicators: string[];
}

// ---------------------------------------------------------------------------
// Script generation — what the Claude Code skill produces
// ---------------------------------------------------------------------------

export interface GenerateScriptRequest {
  /** The portal URL to automate */
  portalUrl: string;
  /** What type of automation to generate */
  type: JobType;
  /** Optional: additional context about the portal */
  context?: string;
}
