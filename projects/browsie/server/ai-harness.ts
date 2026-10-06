import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs, tool, type LanguageModel, type ModelMessage } from "ai";
import { z } from "zod";

import type { BrowsieBrowserSession } from "./browser-session.js";
import { buildSystemPrompt } from "./prompt.js";
import type { LoadedSkill } from "./skills.js";

const MAX_RECOVERY_ROUNDS = 4;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("goto"), url: z.string().url() }),
  z.object({ action: z.literal("click"), target: z.string() }),
  z.object({
    action: z.literal("fill"),
    target: z.string(),
    value: z.string(),
  }),
  z.object({
    action: z.literal("type"),
    target: z.string(),
    value: z.string(),
  }),
  z.object({
    action: z.literal("press"),
    target: z.string().optional(),
    key: z.string(),
  }),
  z.object({
    action: z.literal("select"),
    target: z.string(),
    value: z.string(),
  }),
  z.object({
    action: z.literal("wait"),
    milliseconds: z.number().int().positive().max(10_000),
  }),
]);

export function configuredModel(): LanguageModel | undefined {
  if (process.env.OPENAI_API_KEY) return openai(process.env.BROWSIE_MODEL ?? "gpt-5.4-mini");
  if (process.env.ANTHROPIC_API_KEY)
    return anthropic(process.env.BROWSIE_MODEL ?? "claude-sonnet-5");
  return undefined;
}

export async function runAgent(input: {
  model: LanguageModel;
  message: string;
  messages: ModelMessage[];
  browser: BrowsieBrowserSession;
  skills: LoadedSkill[];
  contextName: string;
  browseLearnContext?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const tools = {
    snapshot: tool({
      description:
        "Read the current page as a compact accessibility tree. The result marks known access blocks. When pageStatus is blocked, continue on a different source. Bracketed target IDs are valid only until the page changes.",
      inputSchema: z.object({}),
      execute: async () => input.browser.snapshot(),
    }),
    run: tool({
      description:
        "Run a short batch of exact actions in the persistent browser session. Use CSS selectors or IDs from the latest snapshot. If one site blocks access, navigate to a different source in the same browser task. This safe adapter does not execute model-authored JavaScript in the server process.",
      inputSchema: z.object({ actions: z.array(actionSchema).min(1).max(12) }),
      execute: async ({ actions }) => input.browser.run(actions),
    }),
    screenshot: tool({
      description:
        "Capture the visible page when layout, images, or visual state matter. The UI also shows the image.",
      inputSchema: z.object({}),
      execute: async () => {
        const shot = await input.browser.screenshot();
        return { mediaType: shot.mediaType, url: shot.url, captured: true };
      },
    }),
  };

  const conversation = trimConversationHistory(input.messages);
  let recoveryPrompt: string | undefined;
  let lastAnswer = "";
  for (let round = 1; round <= MAX_RECOVERY_ROUNDS; round += 1) {
    const messages: ModelMessage[] = recoveryPrompt
      ? [...conversation, { role: "user", content: recoveryPrompt }]
      : conversation;
    const result = await generateText({
      model: input.model,
      system: buildSystemPrompt(input.skills, input.contextName, input.browseLearnContext),
      messages,
      stopWhen: stepCountIs(24),
      tools,
      abortSignal: input.signal,
    });
    lastAnswer = result.text || "The browser task finished without a text answer.";
    const report = input.browser.recoveryReport();
    if (!shouldContinueResearch(input.message, lastAnswer, report, round)) return lastAnswer;

    input.browser.recordRecovery();
    recoveryPrompt = buildRecoveryPrompt(input.message, lastAnswer, report);
  }

  return lastAnswer;
}

export function trimConversationHistory(
  messages: ModelMessage[],
  maxMessages = 16,
  maxCharacters = 30_000,
): ModelMessage[] {
  const selected: ModelMessage[] = [];
  let characters = 0;
  for (let index = messages.length - 1; index >= 0 && selected.length < maxMessages; index -= 1) {
    const message = messages[index];
    const size =
      typeof message.content === "string"
        ? message.content.length
        : JSON.stringify(message.content).length;
    if (selected.length > 0 && characters + size > maxCharacters) break;
    selected.unshift(message);
    characters += size;
  }
  return selected;
}

export function shouldContinueResearch(
  request: string,
  answer: string,
  report: ReturnType<BrowsieBrowserSession["recoveryReport"]>,
  round: number,
): boolean {
  if (round >= MAX_RECOVERY_ROUNDS) return false;
  const researchTask =
    /\b(find|research|compare|recommend|best|good|nearby|shortlist|options)\b/i.test(request);
  const missingAnswer = /finished without a text answer/i.test(answer);
  if (missingAnswer) return true;
  const gaveUp =
    /\b(blocked|could(?:n['’]t| not) access|can(?:not|'t) access|different source|without verification|general knowledge)\b/i.test(
      answer,
    );
  const needsSources = researchTask && report.liveSourceOrigins.length < 2;
  const unresolvedBlock = report.blockedOrigins.length > 0 && gaveUp;
  const canTryAnotherOrigin =
    report.visitedOrigins.length < 4 || report.liveSourceOrigins.length > 0;
  return canTryAnotherOrigin && (needsSources || unresolvedBlock);
}

function buildRecoveryPrompt(
  request: string,
  priorAnswer: string,
  report: ReturnType<BrowsieBrowserSession["recoveryReport"]>,
): string {
  return `Continue the original task in the current persistent browser.

Original task: ${request}

Your last answer stopped before the research was complete:
${priorAnswer}

Blocked origins: ${report.blockedOrigins.join(", ") || "none"}
Live non-search origins read: ${report.liveSourceOrigins.join(", ") || "none"}
All origins tried: ${report.visitedOrigins.join(", ") || "none"}

Do not ask the user to choose another source. Choose a different live source now. Do not return a final answer until you have read at least two non-search source origins, or four different origins have blocked access. Cite the URLs that support the result.`;
}
