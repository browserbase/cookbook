import { z } from "zod";

// Zod Schemas

export const DoctorSchema = z.object({
  name: z.string(),
  specialty: z.string().optional(),
  location: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const ProviderSearchResultSchema = z.object({
  doctors: z.array(DoctorSchema),
});

export const WorkflowStageSchema = z.enum([
  "idle",
  "initializing",
  "navigating",
  "clicking_guest",
  "awaiting_human_input",
  "waiting_for_search_page",
  "entering_location",
  "clicking_continue",
  "selecting_provider_type",
  "extracting_doctors",
  "completed",
  "error",
]);

export const WorkflowStateSchema = z.object({
  sessionId: z.string().optional(),
  sessionUrl: z.string().optional(),
  stage: WorkflowStageSchema,
  message: z.string(),
  timestamp: z.string(),
  approvalRequired: z.boolean(),
  approved: z.boolean(),
  result: z
    .object({
      doctors: z.array(DoctorSchema),
    })
    .optional(),
  error: z.string().optional(),
});

// TypeScript Types

export type Doctor = z.infer<typeof DoctorSchema>;
export type ProviderSearchResult = z.infer<typeof ProviderSearchResultSchema>;
export type WorkflowStage = z.infer<typeof WorkflowStageSchema>;
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// API Response Types

export interface StartAutomationResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface WorkflowResult {
  success: boolean;
  doctors?: Doctor[];
  error?: string;
  timestamp: string;
}
