import type { ModelMessage } from "ai";

import { configuredModel, runAgent } from "./ai-harness.js";
import type { BrowsieBrowserSession } from "./browser-session.js";
import type { LoadedSkill } from "./skills.js";
import { addTrace } from "./trace.js";
import type { ConversationState } from "./types.js";

interface CoordinatorInput {
  message: string;
  fixtureUrl: string;
  state: ConversationState;
  browser: BrowsieBrowserSession;
  messages: ModelMessage[];
  skills: LoadedSkill[];
  browseLearnContext?: string;
  signal?: AbortSignal;
}

export async function coordinate(input: CoordinatorInput): Promise<{
  reply: string;
  activeSkill?: string;
  activeContext: string;
}> {
  const contextName = process.env.BROWSERBASE_CONTEXT_ID
    ? "Saved Browserbase Context"
    : "Fresh session";
  addTrace(
    input.state,
    "system",
    "coordinator",
    "Read the request and selected the next execution path.",
  );
  addTrace(input.state, "context", "context.select", `Selected: ${contextName}.`);

  if (isFormDemo(input.message)) {
    return runFormDemo(input, contextName);
  }

  const model = configuredModel();
  if (model) {
    addTrace(input.state, "system", "harness.select", "Selected the Vercel AI SDK tool loop.");
    const reply = await runAgent({
      model,
      message: input.message,
      messages: input.messages,
      browser: input.browser,
      skills: input.skills,
      contextName,
      browseLearnContext: input.browseLearnContext,
      signal: input.signal,
    });
    if (input.browser.hasStarted()) await input.browser.screenshot().catch(() => undefined);
    addTrace(input.state, "result", "assistant.answer", reply);
    return { reply, activeContext: contextName };
  }

  const reply =
    "The agent model is not connected. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to the Browsie .env file, then restart the server. The included form demo works without a model key.";
  addTrace(input.state, "result", "assistant.answer", reply);
  return { reply, activeContext: contextName };
}

async function runFormDemo(
  input: CoordinatorInput,
  contextName: string,
): Promise<{ reply: string; activeSkill: string; activeContext: string }> {
  const skill = input.skills.find((item) => item.id === "fill-form");
  addTrace(input.state, "skill", "skill.load", `Loaded ${skill?.name ?? "Fill a form"}.`, {
    skillId: skill?.id ?? "fill-form",
  });

  await input.browser.run([{ action: "goto", url: input.fixtureUrl }]);
  await input.browser.snapshot();
  await input.browser.run([
    { action: "fill", target: "#full-name", value: "Avery Browser" },
    { action: "fill", target: "#email", value: "avery@example.com" },
    { action: "click", target: "#next-step" },
  ]);
  await input.browser.snapshot();
  await input.browser.run([
    { action: "fill", target: "#company", value: "Town" },
    { action: "select", target: "#role", value: "Operations" },
    {
      action: "fill",
      target: "#notes",
      value: "Browsie filled this form with a Stagehand v4 skill.",
    },
  ]);
  await input.browser.snapshot();
  await input.browser.screenshot();

  const reply =
    "I filled both steps of the demo form and stopped before the Submit button. The run used one persistent Stagehand browser, the form skill, two fresh snapshots, and exact action batches.";
  addTrace(input.state, "result", "form.ready", reply, { submitted: false });
  return {
    reply,
    activeSkill: skill?.name ?? "Fill a form",
    activeContext: contextName,
  };
}

export function canRunWithoutModel(message: string): boolean {
  return isFormDemo(message);
}

function isFormDemo(message: string): boolean {
  return /(?:fill|complete).*(?:demo|sample|test)?\s*form|form.*(?:demo|fixture)/i.test(message);
}
