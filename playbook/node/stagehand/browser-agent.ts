import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { Stagehand, type StagehandBrowser } from "@browserbasehq/stagehand";
import { z } from "zod/v4";

export function resolveAgentModel() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required for the outer browser agent");
  }
  return anthropic(process.env.AGENT_MODEL ?? "claude-sonnet-4-6");
}

export function createBrowserAgent(
  stagehand: Stagehand,
  browser: StagehandBrowser,
  allowedUploadPaths: readonly string[] = [],
  model = resolveAgentModel(),
) {
  const page = async () =>
    (await browser.context.activePage()) ?? (await browser.context.pages())[0];
  return new ToolLoopAgent({
    model,
    instructions:
      "Complete the requested browser task using the live page. Read a snapshot before choosing selectors. Prefer exact navigation and element tools; use act only when a stable selector is unavailable. Never claim a result without observing it. Stop when the requested task is complete.",
    stopWhen: stepCountIs(30),
    tools: {
      tabs: tool({
        description: "List open tabs and their indexes.",
        inputSchema: z.object({}),
        execute: async () =>
          Promise.all(
            (await browser.context.pages()).map(async (tab, index) => ({
              index,
              url: await tab.url(),
            })),
          ),
      }),
      selectTab: tool({
        description: "Activate a tab using an index returned by tabs.",
        inputSchema: z.object({index: z.number().int().nonnegative()}),
        execute: async ({index}) => {
          const tab = (await browser.context.pages())[index];
          if (!tab) throw new Error("The selected tab no longer exists");
          await browser.context.setActivePage(tab);
          return tab.url();
        },
      }),
      upload: tool({
        description: "Upload a file explicitly supplied in the task profile.",
        inputSchema: z.object({selector: z.string(), filePath: z.string()}),
        execute: async ({selector, filePath}) => {
          if (!allowedUploadPaths.includes(filePath)) {
            throw new Error("File was not supplied for this task");
          }
          await (await page()).locator(selector).setInputFiles(filePath);
          return "Uploaded";
        },
      }),
      navigate: tool({
        description: "Navigate the active page to a URL.",
        inputSchema: z.object({ url: z.url() }),
        execute: async ({ url }) => {
          await (await page()).goto(url);
          return (await page()).url();
        },
      }),
      snapshot: tool({
        description: "Read the live accessibility tree and selector map.",
        inputSchema: z.object({}),
        execute: async () => (await page()).snapshot(),
      }),
      click: tool({
        description: "Click a selector observed in the snapshot.",
        inputSchema: z.object({ selector: z.string() }),
        execute: async ({ selector }) => {
          await (await page()).locator(selector).click();
          return "Clicked";
        },
      }),
      fill: tool({
        description: "Fill an input selected from the snapshot.",
        inputSchema: z.object({ selector: z.string(), value: z.string() }),
        execute: async ({ selector, value }) => {
          await (await page()).locator(selector).fill(value);
          return "Filled";
        },
      }),
      readText: tool({
        description: "Read text from a selector.",
        inputSchema: z.object({ selector: z.string() }),
        execute: async ({ selector }) =>
          (await page()).locator(selector).textContent(),
      }),
      selectOption: tool({
        description: "Select an option value in a select element.",
        inputSchema: z.object({ selector: z.string(), value: z.string() }),
        execute: async ({ selector, value }) => {
          await (await page()).locator(selector).selectOption(value);
          return "Selected";
        },
      }),
      press: tool({
        description: "Send a keyboard key such as Enter or Tab.",
        inputSchema: z.object({ key: z.string() }),
        execute: async ({ key }) => {
          await (await page()).keyPress(key);
          return "Pressed";
        },
      }),
      act: tool({
        description:
          "Perform one natural-language browser action when no selector is available.",
        inputSchema: z.object({ instruction: z.string() }),
        execute: async ({ instruction }) =>
          (await stagehand.act(instruction)).data,
      }),
      extract: tool({
        description: "Extract information from the current page.",
        inputSchema: z.object({ instruction: z.string() }),
        execute: async ({ instruction }) =>
          (await stagehand.extract(instruction)).data,
      }),
    },
  });
}
