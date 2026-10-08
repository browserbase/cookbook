import type { AgentSettings } from "./types";

export function buildClientContext(
  activeBrowserContext: string,
  demoFormUrl: string,
  browseLearnMemory?: string,
  agentSettings?: AgentSettings,
) {
  return {
    activeBrowserContext,
    demoFormUrl,
    ...(agentSettings
      ? {
          agentSettings: {
            model: agentSettings.model,
            reasoningEffort: agentSettings.reasoningEffort,
          } as Record<string, string>,
        }
      : {}),
    ...(browseLearnMemory?.trim() ? { browseLearnMemory: browseLearnMemory.trim() } : {}),
  };
}
