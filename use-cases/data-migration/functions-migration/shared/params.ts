import { z } from "zod";

/**
 * Shared params for the workflow functions: NONE. The login CONTEXT is bound to the runtime session via
 * the invoke body's `sessionCreateParams.browserSettings.context`. Browserbase credentials are provided
 * through runtime environment variables, so every workflow endpoint takes an empty params object.
 */
export const workflowParams = z.object({});

export type WorkflowParams = z.infer<typeof workflowParams>;
