import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';
import { Stagehand } from '@browserbasehq/stagehand';
import { browserOwnerFor } from './browser-owner.ts';

async function pageFor(stagehand: Stagehand, url?: string) {
  const page = (await stagehand.browser.context.pages())[0];
  if (url) await page.goto(url);
  return page;
}

export const stagehandActTool = createTool({
  id: 'web-act',
  description: 'Take one action on a webpage using Stagehand.',
  inputSchema: z.object({ url: z.url().optional(), action: z.string() }),
  outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  execute: async ({ url, action }, context) => browserOwnerFor(context?.requestContext).run(async stagehand => {
    await pageFor(stagehand, url);
    const result = await stagehand.act(action);
    return { success: result.data.success, message: result.data.message };
  }),
});

export const stagehandObserveTool = createTool({
  id: 'web-observe',
  description: 'Observe available actions on a webpage.',
  inputSchema: z.object({ url: z.url().optional(), instruction: z.string() }),
  execute: async ({ url, instruction }, context) => browserOwnerFor(context?.requestContext).run(async stagehand => {
    await pageFor(stagehand, url);
    return (await stagehand.observe(instruction)).data;
  }),
});

export const stagehandExtractTool = createTool({
  id: 'web-extract',
  description:
    'Extract structured information from a webpage. An optional JSON Schema defines the result.',
  inputSchema: z.object({
    url: z.url().optional(),
    instruction: z.string(),
    schema: z.record(z.string(), z.json()).optional(),
  }),
  execute: async ({ url, instruction, schema }, context) => browserOwnerFor(context?.requestContext).run(async stagehand => {
    await pageFor(stagehand, url);
    if (schema)
      return (await stagehand.extract(instruction, z.fromJSONSchema(schema)))
        .data;
    return (await stagehand.extract(instruction)).data;
  }),
});

export const stagehandNavigateTool = createTool({
  id: 'web-navigate',
  description: 'Navigate the browser to a URL.',
  inputSchema: z.object({ url: z.url() }),
  execute: async ({ url }, context) => browserOwnerFor(context?.requestContext).run(async stagehand => {
    const page = await pageFor(stagehand, url);
    return {
      success: true,
      title: await page.title(),
      currentUrl: await page.url(),
    };
  }),
});
