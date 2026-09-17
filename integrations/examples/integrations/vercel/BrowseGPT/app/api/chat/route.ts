import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, tool, generateText, isStepCount, safeValidateUIMessages } from 'ai';
import { z } from 'zod';
import { chromium } from 'playwright';
import {anthropic} from '@ai-sdk/anthropic'
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

import { requireBrowserSession, requireSessionRequest } from '@/lib/session-request';
import { createBrowserOperationQueue } from '@/lib/browser-operation';

const bb_api_key = process.env.BROWSERBASE_API_KEY!;

// Main API route handler
// export const runtime = 'nodejs';
export const maxDuration = 300; // Set max duration to 300 seconds (5 minutes)

export async function POST(req: Request) {
  try { requireSessionRequest(req); }
  catch (error) { if (error instanceof Response) return error; throw error; }
  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'Invalid JSON request' }, { status: 400 }); }
  const messages = body && typeof body === 'object' && 'messages' in body ? body.messages : undefined;
  const validated = await safeValidateUIMessages({ messages });
  if (!validated.success) return Response.json({ error: 'Provide a nonempty array of valid UI messages' }, { status: 400 });
  let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
  try { modelMessages = await convertToModelMessages(validated.data); }
  catch { return Response.json({ error: 'Messages cannot be converted into a chat request' }, { status: 400 }); }
  if (!modelMessages.length) return Response.json({ error: 'Provide message content' }, { status: 400 });
  let sessionId: string;
  try { ({ sessionId } = requireBrowserSession(req, 'operate')); }
  catch (error) { if (error instanceof Response) return error; throw error; }
  if (!process.env.OPENAI_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Chat model services are not configured' }, { status: 503 });
  }

  const runBrowserOperation = createBrowserOperationQueue(() => {
    req.signal?.throwIfAborted();
    requireBrowserSession(req, 'operate');
  });

  const result = streamText({
    model: openai('gpt-4.1'),
    stopWhen: isStepCount(5),
    abortSignal: req.signal,
    messages: modelMessages,
    tools: {
      askForConfirmation: tool({
        description: 'Ask the user for confirmation.',
        inputSchema: z.object({
          message: z.string().describe('The message to ask for confirmation.'),
        }),
      }),
      googleSearch: tool({
        description: 'Search Google for a query',
        inputSchema: z.object({
          toolName: z.string().describe('What the tool is doing'),
          query: z.string().describe('The exact and complete search query as provided by the user. Do not modify this in any way.'),
        }),
        execute: async ({ query }) => runBrowserOperation(async () => {
          let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined;
          try {
      
            browser = await chromium.connectOverCDP(
              `wss://connect.browserbase.com?apiKey=${bb_api_key}&sessionId=${sessionId}`
            );
            const defaultContext = browser.contexts()[0];
            const page = defaultContext.pages()[0];
          
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
            await page.waitForTimeout(500);
            await page.keyboard.press('Enter');
            await page.waitForLoadState('load', { timeout: 10000 });
            
            await page.waitForSelector('.g');

            const results = await page.evaluate(() => {
              const items = document.querySelectorAll('.g');
              return Array.from(items).map(item => {
                const title = item.querySelector('h3')?.textContent || '';
                const description = item.querySelector('.VwiC3b')?.textContent || '';
                return { title, description };
              });
            });
            
            const text = results.map(item => `${item.title}\n${item.description}`).join('\n\n');

            const response = await generateText({
              // model: openai('gpt-4-turbo'),
              model: anthropic('claude-sonnet-4-6'),
              prompt: `Evaluate the following web page content: ${text}`,
            });

            return {
              toolName: 'Searching Google',
              content: response.text,
              dataCollected: true,
            };
          } catch (error) {
            console.error('Google search failed');
            return {
              toolName: 'Searching Google',
              content: 'Error performing Google search',
              dataCollected: false,
            };
          } finally {
            await browser?.close();
          }
        }),
      }),
      getPageContent: tool({
        description: 'Get the content of a page using Playwright',
        inputSchema: z.object({
          toolName: z.string().describe('What the tool is doing'),
          url: z.string().describe('The url to get the content of'),
        }),
        execute: async ({ url }) => runBrowserOperation(async () => {
          let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined;
          try {
            
            browser = await chromium.connectOverCDP(
              `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${sessionId}`
            );
            const defaultContext = browser.contexts()[0];
            const page = defaultContext.pages()[0];
          
            await page.goto(url);
          
            const content = await page.content();
            const dom = new JSDOM(content);
            const reader = new Readability(dom.window.document);
            const article = reader.parse();

            const text = `${article?.title || ''}\n${article?.textContent || ''}`;

            const response = await generateText({
              // model: openai('gpt-4-turbo'),
              model: anthropic('claude-sonnet-4-6'),
              prompt: `Evaluate the following web page content: ${text}`,
            });

            return {
              toolName: 'Getting page content',
              content: response.text,
            };
          } catch (error) {
            console.error('Page content retrieval failed');
            return {
              toolName: 'Getting page content',
              content: 'Error fetching page content',
            };
          } finally {
            await browser?.close();
          }
        }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}