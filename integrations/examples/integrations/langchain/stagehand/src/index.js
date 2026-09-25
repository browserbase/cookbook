import { localBrowser, Stagehand } from '@browserbasehq/stagehand';
import { tool } from '@langchain/core/tools';
import { pathToFileURL } from 'node:url';
import { z } from 'zod/v4';

export function createStagehandTools({ stagehand, page }) {
  const navigateTool = tool(async ({ url }) => {
    await page.goto(url);
    return page.url();
  }, {
    name: 'stagehand_navigate',
    description: 'Navigate to a URL.',
    schema: z.object({ url: z.url() }),
  });
  const actionTool = tool(
    async ({ instruction }) => JSON.stringify((await stagehand.act(instruction)).data),
    {
      name: 'stagehand_act',
      description: 'Perform one action on the current page.',
      schema: z.object({ instruction: z.string() }),
    }
  );
  const observeTool = tool(
    async ({ instruction }) => JSON.stringify((await stagehand.observe(instruction)).data),
    {
      name: 'stagehand_observe',
      description: 'Find available actions on the current page.',
      schema: z.object({ instruction: z.string() }),
    }
  );
  return { navigateTool, actionTool, observeTool };
}

export async function run() {
  const browser = await localBrowser.launch();
  let stagehand;
  try {
    stagehand = await Stagehand.create({
      browser,
      model: {
        modelName: 'openai/gpt-4o',
        apiKey: process.env.OPENAI_API_KEY,
      },
    });
    const page = (await browser.context.pages())[0];
    if (!page) throw new Error('The browser did not create a page.');
    const { navigateTool, actionTool, observeTool } = createStagehandTools({ stagehand, page });
    await navigateTool.invoke({ url: 'https://www.google.com' });
    await actionTool.invoke({ instruction: 'Search for "OpenAI"' });
    console.log(JSON.parse(await observeTool.invoke({
      instruction: 'What actions can be performed on the current page?',
    })));
    console.log('Current URL:', await page.url());
  } finally {
    if (stagehand) await stagehand.close();
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
