import { Browserbase } from '@browserbasehq/sdk';
import { browserbase, Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod/v4';
import { ApplicationFailure } from '@temporalio/common';
import { createReadStream } from 'node:fs';

export interface SearchResult {
  title: string;
  snippet: string;
}
export interface BrowserSession {
  browserbaseSessionId: string;
  attemptId: string;
  projectId: string;
}

function simulateNetworkDisconnect(stage: string): void {
  if (Math.random() < 0.15)
    throw new Error(`Simulated network failure during ${stage}`);
}

export interface AllocationIntent {
  allocationId: string;
  projectId: string;
  extensionId: string;
}

const requestOptions = { maxRetries: 0, timeout: 30_000 };

function configuredClient(): Browserbase {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) {
    throw ApplicationFailure.nonRetryable('Browserbase configuration is required');
  }
  return new Browserbase({ apiKey, ...requestOptions });
}

function validateIntent(intent: AllocationIntent): Browserbase {
  const client = configuredClient();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(intent.allocationId)
      || !/^[A-Za-z0-9_-]{1,128}$/.test(intent.projectId) || !intent.extensionId?.trim()) {
    throw ApplicationFailure.nonRetryable('Invalid or changed browser allocation intent');
  }
  return client;
}

export async function prepareBrowserExtension(): Promise<Pick<AllocationIntent, 'projectId' | 'extensionId'>> {
  const client = configuredClient();
  const { stagehandExtensionPath } = await import('./stagehand-extension.mjs');
  const file = createReadStream(stagehandExtensionPath());
  try {
    const extension = await client.extensions.create({ file }, requestOptions);
    if (!extension.id?.trim() || !/^[A-Za-z0-9_-]{1,128}$/.test(extension.projectId)) {
      throw ApplicationFailure.nonRetryable('Extension response is missing a valid project scope');
    }
    return { projectId: extension.projectId, extensionId: extension.id };
  } finally {
    file.destroy();
  }
}

export async function initializeBrowser(intent: AllocationIntent): Promise<BrowserSession> {
  const client = validateIntent(intent);
  const session = await client.sessions.create({
    projectId: intent.projectId,
    extensionId: intent.extensionId,
    keepAlive: true,
    api_timeout: 1800,
    browserSettings: { viewport: { width: 1024, height: 768 } },
    userMetadata: { allocation_id: intent.allocationId },
  }, requestOptions);
  if (!session.id?.trim() || session.projectId !== intent.projectId
      || session.userMetadata?.allocation_id !== intent.allocationId
      || session.status !== 'RUNNING') {
    throw new Error('Allocation requires reconciliation');
  }
  return { browserbaseSessionId: session.id, attemptId: intent.allocationId, projectId: intent.projectId };
}

export async function reconcileBrowser(intent: AllocationIntent): Promise<BrowserSession> {
  const client = validateIntent(intent);
  const sessions = await client.sessions.list({
    q: `user_metadata['allocation_id']:'${intent.allocationId}'`,
  }, requestOptions);
  const owned = sessions.filter(session => session.projectId === intent.projectId
    && session.userMetadata?.allocation_id === intent.allocationId);
  if (owned.some(session => !session.id?.trim())
      || new Set(owned.map(session => session.id)).size !== owned.length) {
    throw new Error('Invalid allocation lookup response');
  }
  if (owned.length > 1) {
    const releases = await Promise.allSettled(owned
      .filter(session => session.status === 'RUNNING' || session.status === 'PENDING')
      .map(session => client.sessions.update(session.id, {
        projectId: intent.projectId, status: 'REQUEST_RELEASE',
      }, requestOptions)));
    if (releases.some(result => result.status === 'rejected')) {
      throw new Error('Duplicate allocation cleanup incomplete');
    }
    throw ApplicationFailure.nonRetryable('Duplicate browser allocations were released');
  }
  const session = owned[0];
  if (!session || session.status === 'PENDING') {
    throw new Error('Allocation is not yet visible or running; no replacement will be created');
  }
  if (session.status !== 'RUNNING') {
    throw ApplicationFailure.nonRetryable('Browser allocation is no longer running');
  }
  return { browserbaseSessionId: session.id, attemptId: intent.allocationId, projectId: intent.projectId };
}

async function withSession<T>(
  session: BrowserSession,
  work: (stagehand: Stagehand) => Promise<T>,
): Promise<T> {
  const browser = await browserbase.connect({
    apiKey: process.env.BROWSERBASE_API_KEY!,
    sessionId: session.browserbaseSessionId,
  });
  const stagehand = await Stagehand.create({
    browser,
    model: { modelName: 'openai/gpt-4o', apiKey: process.env.OPENAI_API_KEY },
  });
  try {
    return await work(stagehand);
  } finally {
    await stagehand.close();
    await browser.close();
  }
}

export async function navigateToSearchPage(
  session: BrowserSession,
): Promise<void> {
  simulateNetworkDisconnect('page navigation');
  await withSession(session, async (stagehand) => {
    const page = (await stagehand.browser.context.pages())[0];
    await page.goto('https://search.brave.com/');
  });
}

export async function executeSearch(
  session: BrowserSession,
  query: string,
): Promise<void> {
  simulateNetworkDisconnect('search execution');
  await withSession(session, async (stagehand) => {
    await stagehand.act(`Type ${JSON.stringify(query)} in the search box`);
    await stagehand.act('Submit the search');
    await (
      await stagehand.browser.context.pages()
    )[0].waitForLoadState('domcontentloaded');
  });
}

export async function extractSearchResults(
  session: BrowserSession,
): Promise<SearchResult[]> {
  simulateNetworkDisconnect('data extraction');
  return withSession(session, async (stagehand) => {
    const page = (await stagehand.browser.context.pages())[0];
    const url = await page.url();
    if (url.includes('/sorry/') || url.includes('captcha'))
      throw new Error('Search reached a verification page');
    const { data } = await stagehand.extract(
      'Extract the top 3 organic search results from Brave, excluding ads.',
      z.object({
        results: z
          .array(
            z.object({ title: z.string().min(3), snippet: z.string().min(1) }),
          )
          .min(1),
      }),
    );
    return data.results;
  });
}

export async function cleanupBrowser(session: BrowserSession): Promise<void> {
  const client = configuredClient();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(session.projectId) || !session.browserbaseSessionId?.trim()) {
    throw ApplicationFailure.nonRetryable('Invalid or changed browser cleanup identity');
  }
  await client.sessions.update(session.browserbaseSessionId, {
    status: 'REQUEST_RELEASE',
    projectId: session.projectId,
  }, requestOptions);
}

export async function formatResults(results: SearchResult[]): Promise<string> {
  if (!results.length) throw new Error('Cannot format empty search results');
  return (
    `Successfully found ${results.length} search results:\n\n` +
    results
      .map(
        (result, index) =>
          `${index + 1}. ${result.title}\n   ${result.snippet}\n`,
      )
      .join('\n')
  );
}
