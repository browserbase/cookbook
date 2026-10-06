import { openai } from "@ai-sdk/openai";
import { defineAgent, defineDynamic } from "eve";

const reasoningLevels = ["low", "medium", "high", "xhigh"] as const;
type ReasoningEffort = (typeof reasoningLevels)[number];

export default defineAgent({
  model: defineDynamic({
    events: {
      "step.started": (_event, ctx) => {
        const settings = settingsFromMessages(ctx.messages);
        return {
          model: openai.responses(settings.model),
          modelOptions: {
            providerOptions: {
              openai: { reasoningEffort: settings.reasoningEffort },
            },
          },
        };
      },
    },
  }),
  reasoning: "provider-default",
  build: {
    externalDependencies: ["@browserbasehq/sdk", "@browserbasehq/stagehand"],
  },
  limits: {
    sessionTimeoutMs: 30 * 24 * 60 * 60 * 1_000,
  },
});

function settingsFromMessages(messages: readonly { content: unknown }[]): {
  model: string;
  reasoningEffort: ReasoningEffort;
} {
  const defaults = {
    model: process.env.BROWSIE_MODEL ?? "gpt-5.6-sol",
    reasoningEffort: "medium" as ReasoningEffort,
  };

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const content = messages[index]?.content;
    if (typeof content !== "string" || !content.startsWith("Client context:")) continue;
    const start = content.indexOf("{");
    if (start < 0) continue;

    try {
      const context = JSON.parse(content.slice(start)) as {
        agentSettings?: { model?: unknown; reasoningEffort?: unknown };
      };
      const model =
        typeof context.agentSettings?.model === "string" ? context.agentSettings.model.trim() : "";
      const effort = context.agentSettings?.reasoningEffort;
      return {
        model: model.length >= 2 && model.length <= 100 ? model : defaults.model,
        reasoningEffort:
          typeof effort === "string" && reasoningLevels.includes(effort as ReasoningEffort)
            ? (effort as ReasoningEffort)
            : defaults.reasoningEffort,
      };
    } catch {
      continue;
    }
  }

  return defaults;
}
