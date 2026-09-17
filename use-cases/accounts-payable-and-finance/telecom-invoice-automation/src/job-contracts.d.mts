import type { CreateJobRequest, JobData, PortalDefinition } from "./types.js";

export interface ClaimableJob {
  request: CreateJobRequest;
  portal: PortalDefinition;
}

export function claimJob<T extends ClaimableJob>(
  jobs: Map<string, T>,
  candidate: T,
): { state: T; created: boolean };
export function portalSupportsPaymentInstrument(
  request: CreateJobRequest,
  portal: PortalDefinition,
): boolean;
export function replaceTemplateVars(
  instruction: string,
  request: CreateJobRequest,
  mfaCode?: string,
): string;
export function validateJobData(
  request: CreateJobRequest,
  value: unknown,
): JobData;
export function requireSuccessfulStepAction(
  action: { data?: { success?: boolean; message?: string } },
  description: string,
): void;
