import { z } from 'zod';
import { browserbase, Stagehand } from '@browserbasehq/stagehand';
import {
  type TextMessage,
  type ToolCallMessage,
  type ToolResultMessage,
  type AgentResult,
} from '@inngest/agent-kit';

export async function getStagehand(sessionId: string) {
  const browser = await browserbase.connect({
    apiKey: process.env.BROWSERBASE_API_KEY!,
    sessionId,
  });
  try {
    return await Stagehand.create({
      browser,
      model: { modelName: 'openai/gpt-4o' },
    });
  } catch (error) {
    try { await browser.close(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Stagehand initialization and browser disconnect failed.'); }
    throw error;
  }
}

export async function closeStagehand(stagehand: Stagehand) {
  const errors: unknown[] = [];
  try { await stagehand.close(); } catch (error) { errors.push(error); }
  try { await stagehand.browser.close(); } catch (error) { errors.push(error); }
  if (errors.length) throw new AggregateError(errors, 'Stagehand disconnect failed.');
}

export const StagehandAvailableModelSchema = z.enum([
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/gpt-4.1',
  'openai/o3-mini',
  'anthropic/claude-sonnet-4-6',
  'google/gemini-2.5-flash',
]);

// Flat extraction schemas deliberately exclude nested or executable expressions.
export function stringToZodSchema(schema: string) {
  if (typeof schema !== 'string' || !/^\s*\{[^{}]+\}\s*$/.test(schema)) {
    throw new Error('Use a nonempty object schema, for example { name: string, age: number }.');
  }
  const fields = schema.trim().slice(1, -1).split(',');
  const shape: Record<string, z.ZodType> = Object.create(null);
  for (const field of fields) {
    const match = /^\s*([A-Za-z_$][\w$]*)\s*:\s*(string|number|boolean|date)\s*(\[\s*\])?\s*$/.exec(field);
    if (!match) throw new Error('Each field must have a name and type: string, number, boolean, date, or an array of one of these types.');
    const [, key, type, array] = match;
    if (Object.hasOwn(shape, key) || ['__proto__', 'constructor', 'prototype'].includes(key)) {
      throw new Error('Field names must be unique and must not be reserved object names.');
    }
    const types = { string: z.string(), number: z.number(), boolean: z.boolean(), date: z.iso.date() };
    const fieldType = types[type as keyof typeof types];
    shape[key] = array ? z.array(fieldType) : fieldType;
  }
  return z.object(shape);
}

export function lastResult(results: AgentResult[] | undefined) {
  if (!results) {
    return undefined;
  }
  return results[results.length - 1];
}

type MessageType =
  TextMessage['type'] | ToolCallMessage['type'] | ToolResultMessage['type'];

export function isLastMessageOfType(result: AgentResult, type: MessageType) {
  return result.output[result.output.length - 1]?.type === type;
}
