"use node";
import { Stagehand, StagehandCreateOptionsSchema, browserbase, type Page } from "@browserbasehq/stagehand";
import { Buffer } from "node:buffer";
import Browserbase from "@browserbasehq/sdk";
import { generateText, tool, stepCountIs, hasToolCall } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
export type BrowserbaseRegion = "us-west-2" | "us-east-1" | "eu-central-1" | "ap-southeast-1";
export interface BrowserbaseSessionCreateParams {
  region?: BrowserbaseRegion;
}

export interface ApiConfig {
  browserbaseApiKey: string;
  /** @deprecated Browserbase now infers project scope from the API key. */
  browserbaseProjectId?: string;
  modelApiKey: string;
  modelName?: string;
  sessionConfig?: StartSessionOptions;
}

export interface SessionData {
  sessionId: string;
  cdpUrl?: string | null;
  available: boolean;
  projectId: string;
}

export interface StartSessionOptions {
  browserbaseSessionID?: string;
  browserbaseSessionCreateParams?: BrowserbaseSessionCreateParams;
  model?: unknown;
  domSettleTimeoutMs?: number;
  selfHeal?: boolean;
  systemPrompt?: string;
  verbose?: 0 | 1 | 2;
  experimental?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
}

export interface NavigateOptions {
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  timeout?: number;
  referer?: string;
}

export interface ExtractResult<T = unknown> {
  result: T;
  actionId?: string;
}

export interface ExtractOperationOptions {
  model?: unknown;
  timeout?: number;
  selector?: string;
}

export interface ActResult {
  result: {
    actionDescription: string;
    actions: Array<{
      description: string;
      selector: string;
      arguments?: string[];
      method?: string;
      backendNodeId?: number;
    }>;
    message: string;
    success: boolean;
  };
  actionId?: string;
}

export interface ActOperationOptions {
  model?: unknown;
  variables?: Record<string, string>;
  timeout?: number;
}

export interface ObserveResult {
  result: Array<{
    description: string;
    selector: string;
    arguments?: string[];
    backendNodeId?: number;
    method?: string;
  }>;
  actionId?: string;
}

export interface ObserveOperationOptions {
  model?: unknown;
  timeout?: number;
  selector?: string;
}

export interface AgentConfig {
  cua?: boolean;
  mode?: "dom" | "hybrid" | "cua";
  model?: unknown;
  systemPrompt?: string;
  executionModel?: unknown;
  provider?: "openai" | "anthropic" | "google" | "microsoft";
}

export interface AgentExecuteOptions {
  instruction: string;
  maxSteps?: number;
  timeout?: number;
  highlightCursor?: boolean;
}

export interface AgentAction {
  type: string;
  action?: string;
  reasoning?: string;
  timeMs?: number;
  taskCompleted?: boolean;
  pageText?: string;
  pageUrl?: string;
  instruction?: string;
}

export interface AgentUsage {
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens?: number;
  cached_input_tokens?: number;
  inference_time_ms: number;
}

export interface AgentExecuteResult {
  result: {
    actions: AgentAction[];
    completed: boolean;
    message: string;
    success: boolean;
    metadata?: Record<string, unknown>;
    usage?: AgentUsage;
  };
}

function modelConfig(config: ApiConfig, model?: unknown) {
  const parsed = z.union([z.string(), z.object({ modelName: z.string().optional(), apiKey: z.string().optional(), baseURL: z.string().optional(), provider: z.string().optional() })]).optional().parse(model);
  return typeof parsed === "string" ? { modelName: parsed, apiKey: config.modelApiKey } : { ...parsed, modelName: parsed?.modelName ?? config.modelName ?? "openai/gpt-5", apiKey: parsed?.apiKey ?? config.modelApiKey };
}
function stagehandConfig(config: ApiConfig, options?: StartSessionOptions, model?: unknown) {
  if (options?.experimental) throw new Error("experimental is not supported by Stagehand v4");
  const verbose = options?.verbose === undefined ? undefined : z.union([z.literal(0), z.literal(1), z.literal(2)]).parse(options.verbose);
  return StagehandCreateOptionsSchema.omit({ browser: true }).parse({
    model: modelConfig(config, model ?? options?.model),
    domSettleTimeoutMs: options?.domSettleTimeoutMs,
    selfHeal: options?.selfHeal,
    systemPrompt: options?.systemPrompt,
    ...(verbose === undefined ? {} : { logging: { level: verbose === 0 ? "off" : verbose === 1 ? "info" : "debug" } }),
  });
}
async function withSession<T>(sessionId: string, config: ApiConfig, model: unknown, run: (stagehand: Stagehand, page: Page) => Promise<T>): Promise<T> {
  const createConfig = stagehandConfig(config, config.sessionConfig, model);
  const browser = await browserbase.connect({ apiKey: config.browserbaseApiKey, sessionId });
  let stagehand: Stagehand | undefined;
  try {
    stagehand = await Stagehand.create(StagehandCreateOptionsSchema.parse({ ...createConfig, browser }));
    const page = await browser.context.activePage() ?? await browser.context.newPage();
    return await run(stagehand, page);
  } finally { try { await stagehand?.close(); } finally { await browser.close(); } }
}
export async function resolveProjectId(apiKey: string): Promise<string> {
  const sessions = await new Browserbase({ apiKey }).sessions.list();
  const projectId = sessions[0]?.projectId;
  if (!projectId) throw new Error("Could not infer Browserbase project scope from the API key");
  return projectId;
}

export async function startSession(config: ApiConfig, options?: StartSessionOptions): Promise<SessionData> {
  const createConfig = stagehandConfig(config, options);
  const browser = options?.browserbaseSessionID
    ? await browserbase.connect({ apiKey: config.browserbaseApiKey, sessionId: options.browserbaseSessionID })
    : await browserbase.launch({ ...options?.browserbaseSessionCreateParams, apiKey: config.browserbaseApiKey, keepAlive: true });
  let stagehand: Stagehand | undefined;
  try {
    stagehand = await Stagehand.create(StagehandCreateOptionsSchema.parse({ ...createConfig, browser }));
    const remote = await new Browserbase({ apiKey: config.browserbaseApiKey }).sessions.retrieve(browser.sessionId!);
    return { sessionId: browser.sessionId!, cdpUrl: stagehand.rpcClient?.browserWebSocketDebuggerUrl, available: true, projectId: remote.projectId };
  } catch (error) {
    if (!options?.browserbaseSessionID && browser.sessionId) await endSession(browser.sessionId, config);
    throw error;
  } finally { try { await stagehand?.close(); } finally { await browser.close(); } }
}
export async function endSession(sessionId: string, config: ApiConfig, _region?: BrowserbaseRegion): Promise<void> {
  await new Browserbase({ apiKey: config.browserbaseApiKey }).sessions.update(sessionId, { status: "REQUEST_RELEASE" }, { timeout: 30_000, maxRetries: 0 });
}
export async function navigate(sessionId: string, url: string, config: ApiConfig, options?: NavigateOptions, _region?: BrowserbaseRegion): Promise<void> {
  if (options?.referer) throw new Error("Custom navigation referer is not supported by Stagehand v4; configure session headers instead.");
  await withSession(sessionId, config, undefined, async (_stagehand, page) => { await page.goto(url, { waitUntil: options?.waitUntil ?? "domcontentloaded", timeout: options?.timeout }); });
}
export async function extract(sessionId: string, instruction: string, schema: unknown, config: ApiConfig, options?: ExtractOperationOptions, _region?: BrowserbaseRegion): Promise<ExtractResult> {
  if (options?.selector) throw new Error("Selector-scoped extraction is not supported by the v4 API; include the scope in the instruction.");
  const jsonSchema = z.record(z.string(), z.unknown()).parse(schema);
  return withSession(sessionId, config, options?.model, async stagehand => ({ result: (await stagehand.extract(instruction, z.fromJSONSchema(jsonSchema), { timeout: options?.timeout })).data }));
}
export async function act(sessionId: string, action: string, config: ApiConfig, options?: ActOperationOptions, _region?: BrowserbaseRegion): Promise<ActResult> {
  return withSession(sessionId, config, options?.model, async stagehand => ({ result: (await stagehand.act(action, { timeout: options?.timeout, variables: options?.variables })).data }));
}
export async function observe(sessionId: string, instruction: string, config: ApiConfig, options?: ObserveOperationOptions, _region?: BrowserbaseRegion): Promise<ObserveResult> {
  if (options?.selector) throw new Error("Selector-scoped observation is not supported by the v4 API; include the scope in the instruction.");
  return withSession(sessionId, config, options?.model, async stagehand => ({ result: (await stagehand.observe(instruction, { timeout: options?.timeout })).data }));
}
export async function runBrowserTask(sessionId: string, agentConfig: AgentConfig, executeOptions: AgentExecuteOptions, config: ApiConfig, shouldCache?: boolean, _region?: BrowserbaseRegion): Promise<AgentExecuteResult> {
  if (shouldCache) throw new Error("Agent trace caching was removed in v4; persist results in Convex instead.");
  if (executeOptions.highlightCursor) throw new Error("highlightCursor is unavailable in the v4 tool loop.");
  const selected = modelConfig(config, agentConfig.model);
  const [prefix, ...rest] = selected.modelName.split("/");
  const provider = agentConfig.provider ?? selected.provider ?? (rest.length ? prefix : "openai");
  const name = rest.length ? rest.join("/") : selected.modelName;
  const options = { apiKey: selected.apiKey, baseURL: selected.baseURL };
  const model = provider === "anthropic" ? createAnthropic(options)(name) : provider === "google" ? createGoogleGenerativeAI(options)(name) : provider === "openai" ? createOpenAI(options)(name) : undefined;
  if (!model) throw new Error(`Unsupported agent provider: ${provider}. Use openai, anthropic, or google.`);
  return withSession(sessionId, config, agentConfig.executionModel, async (stagehand, page) => {
    let completed = false;
    const actions: AgentAction[] = [];
    const visual = agentConfig.cua || agentConfig.mode === "cua" || agentConfig.mode === "hybrid";
    const dom = agentConfig.mode !== "cua" && !agentConfig.cua;
    const started = Date.now();
    const result = await generateText({ model, abortSignal: AbortSignal.timeout(executeOptions.timeout ?? 120_000), system: agentConfig.systemPrompt ?? "Complete the browser task using tools. Inspect the page after actions. Call finish only when you have verified the requested result. Report failure honestly.", prompt: executeOptions.instruction, stopWhen: [stepCountIs(executeOptions.maxSteps ?? 20), hasToolCall("finish")], tools: {
      navigate: tool({ description: "Navigate to an HTTP(S) URL", inputSchema: z.object({ url: z.url().refine(url => /^https?:/.test(url)) }), execute: async ({ url }) => { await page.goto(url); return { url: await page.url() }; } }),
      ...(dom ? {
        inspect: tool({ description: "Read current browser DOM", inputSchema: z.object({}), execute: async () => ({ url: await page.url(), tree: (await page.snapshot()).formattedTree }) }),
        act: tool({ description: "Perform one browser interaction", inputSchema: z.object({ instruction: z.string() }), execute: async ({ instruction }) => (await stagehand.act(instruction)).data }),
      } : {}),
      ...(visual ? {
        screenshot: tool({ description: "Inspect current viewport image", inputSchema: z.object({}), execute: async () => Buffer.from(await page.screenshot()).toString("base64"), toModelOutput: ({ output }) => ({ type: "content" as const, value: [{ type: "image-data" as const, data: output, mediaType: "image/png" }] }) }),
        click: tool({ description: "Click viewport coordinates", inputSchema: z.object({ x: z.number(), y: z.number() }), execute: async ({x,y}) => { await page.click(x,y); return "clicked"; } }),
        type: tool({ description: "Type into focused input", inputSchema: z.object({ text: z.string() }), execute: async ({text}) => { await page.type(text); return "typed"; } }),
        key: tool({ description: "Press a keyboard key", inputSchema: z.object({ key: z.string() }), execute: async ({key}) => { await page.keyPress(key); return "pressed"; } }),
        scroll: tool({ description: "Scroll at viewport coordinates", inputSchema: z.object({ x:z.number(),y:z.number(),deltaX:z.number(),deltaY:z.number() }), execute: async ({x,y,deltaX,deltaY}) => { await page.scroll(x,y,deltaX,deltaY); return "scrolled"; } }),
      } : {}),
      finish: tool({ description: "Record verified completion", inputSchema: z.object({ success:z.boolean(), summary:z.string() }), execute: async ({success,summary}) => { completed=success; return summary; } }),
    }, onStepFinish: step => { for (const call of step.toolCalls) if (call) actions.push({ type: call.toolName, action: JSON.stringify(call.input), timeMs: Date.now()-started }); } });
    return { result: { actions, completed, success: completed, message: result.text || (completed ? "Task completed" : "Task did not verify completion before stopping"), usage: { input_tokens: result.totalUsage.inputTokens ?? 0, output_tokens: result.totalUsage.outputTokens ?? 0, inference_time_ms: Date.now()-started } } };
  });
}
