"use node";
/**
 * Stagehand Component Library
 *
 * AI-powered browser automation actions using the Stagehand REST API.
 * Supports both automatic session management and manual session control.
 */

import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v, ConvexError } from "convex/values";
import { randomUUID } from "node:crypto";
import * as api from "./api.js";

import { sessionSettings, sessionSettingsValidator, type SessionSettings } from "./sessionSettings.js";

const DEFAULT_BROWSERBASE_REGION: api.BrowserbaseRegion = "us-west-2";

type SessionStatus = "active" | "completed" | "error";
type SessionOperation = "extract" | "act" | "observe" | "workflow";

type SessionMetadataPatch = {
  settings?: SessionSettings;
  sessionId: string;
  region?: api.BrowserbaseRegion;
  status?: SessionStatus;
  operation?: SessionOperation;
  url?: string;
  endedAt?: number;
  error?: string;
};

const observedActionValidator = v.object({
  description: v.string(),
  selector: v.string(),
  method: v.optional(v.string()),
  arguments: v.optional(v.array(v.string())),
  backendNodeId: v.optional(v.number()),
});

const waitUntilValidator = v.union(
  v.literal("load"),
  v.literal("domcontentloaded"),
  v.literal("networkidle"),
);

/** Session-level config forwarded from the client's StagehandConfig for ephemeral sessions. */
const sessionConfigValidator = v.optional(sessionSettingsValidator);

const modelValidator = v.optional(
  v.union(
    v.string(),
    v.object({
      modelName: v.optional(v.string()),
      apiKey: v.optional(v.string()),
      baseURL: v.optional(v.string()),
      provider: v.optional(v.string()),
    }),
  ),
);

const variablesValidator = v.optional(v.record(v.string(), v.string()));

const agentActionValidator = v.object({
  type: v.string(),
  action: v.optional(v.string()),
  reasoning: v.optional(v.string()),
  timeMs: v.optional(v.number()),
  taskCompleted: v.optional(v.boolean()),
  pageText: v.optional(v.string()),
  pageUrl: v.optional(v.string()),
  instruction: v.optional(v.string()),
});

function isBrowserbaseRegion(value: unknown): value is api.BrowserbaseRegion {
  return (
    value === "us-west-2" ||
    value === "us-east-1" ||
    value === "eu-central-1" ||
    value === "ap-southeast-1"
  );
}

function getRequestedRegion(
  browserbaseSessionCreateParams: unknown,
): api.BrowserbaseRegion | undefined {
  const maybeRegion = (
    browserbaseSessionCreateParams as api.BrowserbaseSessionCreateParams | undefined
  )?.region;
  if (isBrowserbaseRegion(maybeRegion)) {
    return maybeRegion;
  }
  return undefined;
}

function extractRegionFromError(error: unknown): api.BrowserbaseRegion | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/Session is in region '([^']+)'/i);
  const parsedRegion = match?.[1];
  if (isBrowserbaseRegion(parsedRegion)) {
    return parsedRegion;
  }
  return undefined;
}

async function resolveSessionRegion(
  ctx: any,
  sessionId: string,
  fallback?: api.BrowserbaseRegion,
): Promise<api.BrowserbaseRegion | undefined> {
  const storedRegion = await ctx.runQuery(internal.metadata.getSessionRegion, {
    sessionId,
  });
  return storedRegion ?? fallback ?? undefined;
}

async function persistSessionMetadata(
  ctx: any,
  args: SessionMetadataPatch,
): Promise<void> {
  await ctx.runMutation(internal.metadata.upsertSessionMetadata, args);
}

async function persistAllocatedSession(
  ctx: any,
  metadata: SessionMetadataPatch,
  config: api.ApiConfig,
  ownsSession = true,
): Promise<void> {
  try {
    await persistSessionMetadata(ctx, metadata);
  } catch (error) {
    if (!ownsSession) throw error;
    try {
      await api.endSession(metadata.sessionId, config);
    } catch (releaseError) {
      throw new AggregateError([error, releaseError], "Session metadata and release both failed");
    }
    throw error;
  }
}

async function runWithRegionRetry<T>(
  ctx: any,
  args: {
    sessionId: string;
    initialRegion?: api.BrowserbaseRegion;
    run: (region?: api.BrowserbaseRegion) => Promise<T>;
    onRegionResolved?: (region: api.BrowserbaseRegion) => Promise<void>;
  },
): Promise<T> {
  try {
    return await args.run(args.initialRegion);
  } catch (error) {
    const parsedRegion = extractRegionFromError(error);
    if (!parsedRegion || parsedRegion === args.initialRegion) {
      throw error;
    }

    await persistSessionMetadata(ctx, {
      sessionId: args.sessionId,
      region: parsedRegion,
      status: "active",
    });
    if (args.onRegionResolved) {
      await args.onRegionResolved(parsedRegion);
    }

    return args.run(parsedRegion);
  }
}

async function endSessionWithRouting(
  ctx: any,
  args: {
    sessionId: string;
    config: api.ApiConfig;
    fallbackRegion?: api.BrowserbaseRegion;
  },
): Promise<boolean> {
  let released = false;
  try {
    await api.endSession(args.sessionId, args.config, args.fallbackRegion);
    released = true;
  } catch {
    // The boolean reports the provider release result.
  }
  try {
    await persistSessionMetadata(ctx, {
      sessionId: args.sessionId,
      region: args.fallbackRegion,
      status: released ? "completed" : "error",
      ...(released
        ? { endedAt: Date.now() }
        : { error: "Failed to end Stagehand session" }),
    });
  } catch {
    // Database availability must not prevent the independent release request.
  }
  return released;
}

function cleanupResult(value: any): any {
  if (Array.isArray(value)) return value.map(item => item === undefined ? null : cleanupResult(item));
  if (value && typeof value === "object" && !(value instanceof ArrayBuffer)) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, cleanupResult(item)]));
  }
  return value;
}

async function withOwnedCleanup<T>(ctx: any, options: {
  sessionId: string; config: api.ApiConfig; owned: boolean;
  region: () => api.BrowserbaseRegion | undefined;
}, operation: () => Promise<T>): Promise<T> {
  let succeeded = false;
  let result: T | undefined;
  let failure: unknown;
  try {
    result = await operation();
    succeeded = true;
  } catch (error) {
    failure = error;
  }
  if (options.owned) {
    const released = await endSessionWithRouting(ctx, {
      sessionId: options.sessionId, config: options.config, fallbackRegion: options.region(),
    });
    if (!released) {
      let cleanupState = "unrecorded";
      try {
        await ctx.runMutation(internal.metadata.recordPendingCleanup, {
          sessionId: options.sessionId, projectId: options.config.browserbaseProjectId,
          ...(options.region() ? { region: options.region() } : {}),
        });
        cleanupState = "pending";
      } catch {
        // The caller receives the session ID even when durable recording fails.
      }
      throw new ConvexError({
        code: "SESSION_CLEANUP_FAILED", sessionId: options.sessionId, cleanupState,
        operationSucceeded: succeeded,
        ...(succeeded ? { result: result === undefined ? null : cleanupResult(result) } : {}),
      });
    }
  }
  if (!succeeded) throw failure;
  return result as T;
}

export const reconcileCleanup = action({
  args: {
    browserbaseApiKey: v.string(), browserbaseProjectId: v.string(), limit: v.optional(v.number()),
  },
  returns: v.object({ attempted: v.number(), releaseRequested: v.number(), pending: v.number(), unrecorded: v.number() }),
  handler: async (ctx: any, args: any) => {
    const limit = args.limit ?? 25;
    if (!args.browserbaseApiKey.trim() || !args.browserbaseProjectId.trim()
      || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid cleanup configuration");
    const rows = await ctx.runQuery(internal.metadata.dueCleanup, { projectId: args.browserbaseProjectId, limit });
    const outcome = { attempted: 0, releaseRequested: 0, pending: 0, unrecorded: 0 };
    const config: api.ApiConfig = {
      browserbaseApiKey: args.browserbaseApiKey, browserbaseProjectId: args.browserbaseProjectId, modelApiKey: "",
    };
    for (const row of rows) {
      const claim = { projectId: args.browserbaseProjectId, sessionId: row.sessionId, token: randomUUID() };
      if (!await ctx.runMutation(internal.metadata.claimCleanup, claim)) continue;
      outcome.attempted++;
      const released = await endSessionWithRouting(ctx, { sessionId: row.sessionId, config, fallbackRegion: row.region });
      if (released) outcome.releaseRequested++; else outcome.pending++;
      try {
        const recorded = await ctx.runMutation(internal.metadata.finishCleanup, { ...claim, released });
        if (!recorded) outcome.unrecorded++;
      } catch {
        outcome.unrecorded++;
      }
    }
    return outcome;
  },
});

/**
 * Start a new browser session.
 * Returns session info including cdpUrl for direct Playwright/Puppeteer connection.
 */
export const startSession = action({
  args: {
    browserbaseApiKey: v.string(),
    browserbaseProjectId: v.string(),
    modelApiKey: v.string(),
    modelName: v.optional(v.string()),
    url: v.string(),
    browserbaseSessionID: v.optional(v.string()),
    browserbaseSessionCreateParams: v.optional(v.any()),
    model: modelValidator,
    options: v.optional(
      v.object({
        timeout: v.optional(v.number()),
        waitUntil: v.optional(waitUntilValidator),
        domSettleTimeoutMs: v.optional(v.number()),
        selfHeal: v.optional(v.boolean()),
        systemPrompt: v.optional(v.string()),
        verbose: v.optional(v.number()),
        experimental: v.optional(v.boolean()),
      }),
    ),
  },
  returns: v.object({
    sessionId: v.string(),
    cdpUrl: v.optional(v.string()),
  }),
  handler: async (ctx: any, args: any) => {
    let resolvedRegion =
      getRequestedRegion(args.browserbaseSessionCreateParams) ??
      DEFAULT_BROWSERBASE_REGION;

    const config: api.ApiConfig = {
      browserbaseApiKey: args.browserbaseApiKey,
      browserbaseProjectId: args.browserbaseProjectId,
      modelApiKey: args.modelApiKey,
      modelName: args.modelName,
      sessionConfig: args.sessionConfig,
    };

    config.sessionConfig = sessionSettings(args.options);

    const session = await api.startSession(config, {
      browserbaseSessionID: args.browserbaseSessionID,
      browserbaseSessionCreateParams: args.browserbaseSessionCreateParams,
      model: args.model,
      domSettleTimeoutMs: args.options?.domSettleTimeoutMs,
      selfHeal: args.options?.selfHeal,
      systemPrompt: args.options?.systemPrompt,
      verbose: args.options?.verbose,
      experimental: args.options?.experimental,
    });

    await persistAllocatedSession(ctx, {
      sessionId: session.sessionId,
      region: resolvedRegion,
      status: "active",
      operation: "workflow",
      settings: sessionSettings(config.sessionConfig),
      url: args.url,
    }, config, !args.browserbaseSessionID);

    try {
      await runWithRegionRetry(ctx, {
        sessionId: session.sessionId,
        initialRegion: resolvedRegion,
        onRegionResolved: async (region) => {
          resolvedRegion = region;
        },
        run: async (region) =>
          api.navigate(
            session.sessionId,
            args.url,
            config,
            {
              waitUntil: args.options?.waitUntil,
              timeout: args.options?.timeout,
            },
            region,
          ),
      });

      return {
        sessionId: session.sessionId,
        cdpUrl: session.cdpUrl ?? undefined,
      };
    } catch (error) {
      await endSessionWithRouting(ctx, {
        sessionId: session.sessionId,
        config,
        fallbackRegion: resolvedRegion,
      });
      throw error;
    }
  },
});

/**
 * End a browser session.
 */
export const endSession = action({
  args: {
    browserbaseApiKey: v.string(),
    browserbaseProjectId: v.string(),
    modelApiKey: v.string(),
    modelName: v.optional(v.string()),
    sessionId: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx: any, args: any) => {
    const config: api.ApiConfig = {
      browserbaseApiKey: args.browserbaseApiKey,
      browserbaseProjectId: args.browserbaseProjectId,
      modelApiKey: args.modelApiKey,
      modelName: args.modelName,
      sessionConfig: args.sessionConfig,
    };

    const success = await endSessionWithRouting(ctx, {
      sessionId: args.sessionId,
      config,
    });
    return { success };
  },
});

/**
 * Extract structured data from a web page using AI.
 * If sessionId is provided, uses existing session (doesn't end it).
 * Otherwise, handles full session lifecycle: start -> navigate -> extract -> end
 */
export const extract = action({
  args: {
    browserbaseApiKey: v.string(),
    browserbaseProjectId: v.string(),
    modelApiKey: v.string(),
    modelName: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    url: v.optional(v.string()),
    instruction: v.string(),
    schema: v.any(),
    browserbaseSessionCreateParams: v.optional(v.any()),
    model: modelValidator,
    sessionConfig: sessionConfigValidator,
    options: v.optional(
      v.object({
        timeout: v.optional(v.number()),
        waitUntil: v.optional(waitUntilValidator),
        selector: v.optional(v.string()),
      }),
    ),
  },
  returns: v.any(),
  handler: async (ctx: any, args: any) => {
    if (!args.sessionId && !args.url) {
      throw new Error("Either sessionId or url must be provided");
    }

    const config: api.ApiConfig = {
      browserbaseApiKey: args.browserbaseApiKey,
      browserbaseProjectId: args.browserbaseProjectId,
      modelApiKey: args.modelApiKey,
      modelName: args.modelName,
      sessionConfig: args.sessionConfig,
    };

    const ownSession = !args.sessionId;
    let sessionId = args.sessionId;
    let resolvedRegion: api.BrowserbaseRegion | undefined;

    if (ownSession) {
      resolvedRegion =
        getRequestedRegion(args.browserbaseSessionCreateParams) ??
        DEFAULT_BROWSERBASE_REGION;
      const session = await api.startSession(config, {
        browserbaseSessionCreateParams: args.browserbaseSessionCreateParams,
        model: args.model,
        ...args.sessionConfig,
      });
      sessionId = session.sessionId;
      await persistAllocatedSession(ctx, {
        sessionId,
        region: resolvedRegion,
        status: "active",
        operation: "extract",
        settings: sessionSettings(config.sessionConfig),
        url: args.url,
      }, config);
    }

    if (!sessionId) {
      throw new Error("Failed to initialize session");
    }

    if (!ownSession) {
      resolvedRegion = await resolveSessionRegion(ctx, sessionId, resolvedRegion);
      const storedSettings = await ctx.runQuery(internal.metadata.getSessionSettings, { sessionId });
      if (storedSettings !== null) config.sessionConfig = storedSettings;
    }

    return withOwnedCleanup(ctx, {
      sessionId, config, owned: ownSession, region: () => resolvedRegion,
    }, async () => {
      if (args.url) {
        await runWithRegionRetry(ctx, {
          sessionId,
          initialRegion: resolvedRegion,
          onRegionResolved: async (region) => {
            resolvedRegion = region;
          },
          run: async (region) =>
            api.navigate(
              sessionId,
              args.url,
              config,
              {
                waitUntil: args.options?.waitUntil,
                timeout: args.options?.timeout,
              },
              region,
            ),
        });
      }

      const result = await runWithRegionRetry(ctx, {
        sessionId,
        initialRegion: resolvedRegion,
        onRegionResolved: async (region) => {
          resolvedRegion = region;
        },
        run: async (region) =>
          api.extract(
            sessionId,
            args.instruction,
            args.schema,
            config,
            {
              model: args.model,
              timeout: args.options?.timeout,
              selector: args.options?.selector,
            },
            region,
          ),
      });

      return result.result;
    });
  },
});

/**
 * Execute browser actions using natural language instructions.
 * If sessionId is provided, uses existing session (doesn't end it).
 * Otherwise, handles full session lifecycle: start -> navigate -> act -> end
 */
export const act = action({
  args: {
    browserbaseApiKey: v.string(),
    browserbaseProjectId: v.string(),
    modelApiKey: v.string(),
    modelName: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    url: v.optional(v.string()),
    action: v.string(),
    browserbaseSessionCreateParams: v.optional(v.any()),
    model: modelValidator,
    sessionConfig: sessionConfigValidator,
    options: v.optional(
      v.object({
        timeout: v.optional(v.number()),
        waitUntil: v.optional(waitUntilValidator),
        variables: variablesValidator,
      }),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    actionDescription: v.string(),
  }),
  handler: async (ctx: any, args: any) => {
    if (!args.sessionId && !args.url) {
      throw new Error("Either sessionId or url must be provided");
    }

    const config: api.ApiConfig = {
      browserbaseApiKey: args.browserbaseApiKey,
      browserbaseProjectId: args.browserbaseProjectId,
      modelApiKey: args.modelApiKey,
      modelName: args.modelName,
      sessionConfig: args.sessionConfig,
    };

    const ownSession = !args.sessionId;
    let sessionId = args.sessionId;
    let resolvedRegion: api.BrowserbaseRegion | undefined;

    if (ownSession) {
      resolvedRegion =
        getRequestedRegion(args.browserbaseSessionCreateParams) ??
        DEFAULT_BROWSERBASE_REGION;
      const session = await api.startSession(config, {
        browserbaseSessionCreateParams: args.browserbaseSessionCreateParams,
        model: args.model,
        ...args.sessionConfig,
      });
      sessionId = session.sessionId;
      await persistAllocatedSession(ctx, {
        sessionId,
        region: resolvedRegion,
        status: "active",
        operation: "act",
        settings: sessionSettings(config.sessionConfig),
        url: args.url,
      }, config);
    }

    if (!sessionId) {
      throw new Error("Failed to initialize session");
    }

    if (!ownSession) {
      resolvedRegion = await resolveSessionRegion(ctx, sessionId, resolvedRegion);
      const storedSettings = await ctx.runQuery(internal.metadata.getSessionSettings, { sessionId });
      if (storedSettings !== null) config.sessionConfig = storedSettings;
    }

    return withOwnedCleanup(ctx, {
      sessionId, config, owned: ownSession, region: () => resolvedRegion,
    }, async () => {
      if (args.url) {
        await runWithRegionRetry(ctx, {
          sessionId,
          initialRegion: resolvedRegion,
          onRegionResolved: async (region) => {
            resolvedRegion = region;
          },
          run: async (region) =>
            api.navigate(
              sessionId,
              args.url,
              config,
              {
                waitUntil: args.options?.waitUntil,
                timeout: args.options?.timeout,
              },
              region,
            ),
        });
      }

      const result = await runWithRegionRetry(ctx, {
        sessionId,
        initialRegion: resolvedRegion,
        onRegionResolved: async (region) => {
          resolvedRegion = region;
        },
        run: async (region) =>
          api.act(
            sessionId,
            args.action,
            config,
            {
              model: args.model,
              variables: args.options?.variables,
              timeout: args.options?.timeout,
            },
            region,
          ),
      });

      return {
        success: result.result.success,
        message: result.result.message,
        actionDescription: result.result.actionDescription,
      };
    });
  },
});

/**
 * Find available actions on a web page matching an instruction.
 * If sessionId is provided, uses existing session (doesn't end it).
 * Otherwise, handles full session lifecycle: start -> navigate -> observe -> end
 */
export const observe = action({
  args: {
    browserbaseApiKey: v.string(),
    browserbaseProjectId: v.string(),
    modelApiKey: v.string(),
    modelName: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    url: v.optional(v.string()),
    instruction: v.string(),
    browserbaseSessionCreateParams: v.optional(v.any()),
    model: modelValidator,
    sessionConfig: sessionConfigValidator,
    options: v.optional(
      v.object({
        timeout: v.optional(v.number()),
        waitUntil: v.optional(waitUntilValidator),
        selector: v.optional(v.string()),
      }),
    ),
  },
  returns: v.array(observedActionValidator),
  handler: async (ctx: any, args: any) => {
    if (!args.sessionId && !args.url) {
      throw new Error("Either sessionId or url must be provided");
    }

    const config: api.ApiConfig = {
      browserbaseApiKey: args.browserbaseApiKey,
      browserbaseProjectId: args.browserbaseProjectId,
      modelApiKey: args.modelApiKey,
      modelName: args.modelName,
      sessionConfig: args.sessionConfig,
    };

    const ownSession = !args.sessionId;
    let sessionId = args.sessionId;
    let resolvedRegion: api.BrowserbaseRegion | undefined;

    if (ownSession) {
      resolvedRegion =
        getRequestedRegion(args.browserbaseSessionCreateParams) ??
        DEFAULT_BROWSERBASE_REGION;
      const session = await api.startSession(config, {
        browserbaseSessionCreateParams: args.browserbaseSessionCreateParams,
        model: args.model,
        ...args.sessionConfig,
      });
      sessionId = session.sessionId;
      await persistAllocatedSession(ctx, {
        sessionId,
        region: resolvedRegion,
        status: "active",
        operation: "observe",
        settings: sessionSettings(config.sessionConfig),
        url: args.url,
      }, config);
    }

    if (!sessionId) {
      throw new Error("Failed to initialize session");
    }

    if (!ownSession) {
      resolvedRegion = await resolveSessionRegion(ctx, sessionId, resolvedRegion);
      const storedSettings = await ctx.runQuery(internal.metadata.getSessionSettings, { sessionId });
      if (storedSettings !== null) config.sessionConfig = storedSettings;
    }

    return withOwnedCleanup(ctx, {
      sessionId, config, owned: ownSession, region: () => resolvedRegion,
    }, async () => {
      if (args.url) {
        await runWithRegionRetry(ctx, {
          sessionId,
          initialRegion: resolvedRegion,
          onRegionResolved: async (region) => {
            resolvedRegion = region;
          },
          run: async (region) =>
            api.navigate(
              sessionId,
              args.url,
              config,
              {
                waitUntil: args.options?.waitUntil,
                timeout: args.options?.timeout,
              },
              region,
            ),
        });
      }

      const result = await runWithRegionRetry(ctx, {
        sessionId,
        initialRegion: resolvedRegion,
        onRegionResolved: async (region) => {
          resolvedRegion = region;
        },
        run: async (region) =>
          api.observe(
            sessionId,
            args.instruction,
            config,
            {
              model: args.model,
              timeout: args.options?.timeout,
              selector: args.options?.selector,
            },
            region,
          ),
      });

      return result.result.map((action) => ({
        description: action.description,
        selector: action.selector,
        method: action.method,
        arguments: action.arguments,
        backendNodeId: action.backendNodeId,
      }));
    });
  },
});

/**
 * Execute autonomous multi-step browser automation using an AI agent.
 * The agent interprets the instruction and decides what actions to take.
 * If sessionId is provided, uses existing session (doesn't end it).
 * Otherwise, handles full session lifecycle.
 */
export const agent = action({
  args: {
    browserbaseApiKey: v.string(),
    browserbaseProjectId: v.string(),
    modelApiKey: v.string(),
    modelName: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    url: v.optional(v.string()),
    instruction: v.string(),
    browserbaseSessionCreateParams: v.optional(v.any()),
    model: modelValidator,
    sessionConfig: sessionConfigValidator,
    options: v.optional(
      v.object({
        cua: v.optional(v.boolean()),
        mode: v.optional(v.string()),
        maxSteps: v.optional(v.number()),
        systemPrompt: v.optional(v.string()),
        timeout: v.optional(v.number()),
        waitUntil: v.optional(waitUntilValidator),
        executionModel: modelValidator,
        provider: v.optional(v.string()),
        highlightCursor: v.optional(v.boolean()),
        shouldCache: v.optional(v.boolean()),
      }),
    ),
  },
  returns: v.object({
    actions: v.array(agentActionValidator),
    completed: v.boolean(),
    message: v.string(),
    success: v.boolean(),
    metadata: v.optional(v.any()),
    usage: v.optional(
      v.object({
        input_tokens: v.number(),
        output_tokens: v.number(),
        reasoning_tokens: v.optional(v.number()),
        cached_input_tokens: v.optional(v.number()),
        inference_time_ms: v.number(),
      }),
    ),
  }),
  handler: async (ctx: any, args: any) => {
    if (!args.sessionId && !args.url) {
      throw new Error("Either sessionId or url must be provided");
    }

    const config: api.ApiConfig = {
      browserbaseApiKey: args.browserbaseApiKey,
      browserbaseProjectId: args.browserbaseProjectId,
      modelApiKey: args.modelApiKey,
      modelName: args.modelName,
      sessionConfig: args.sessionConfig,
    };

    const ownSession = !args.sessionId;
    let sessionId = args.sessionId;
    let resolvedRegion: api.BrowserbaseRegion | undefined;

    if (ownSession) {
      resolvedRegion =
        getRequestedRegion(args.browserbaseSessionCreateParams) ??
        DEFAULT_BROWSERBASE_REGION;
      const session = await api.startSession(config, {
        browserbaseSessionCreateParams: args.browserbaseSessionCreateParams,
        model: args.model,
        ...args.sessionConfig,
      });
      sessionId = session.sessionId;
      await persistAllocatedSession(ctx, {
        sessionId,
        region: resolvedRegion,
        status: "active",
        operation: "workflow",
        settings: sessionSettings(config.sessionConfig),
        url: args.url,
      }, config);
    }

    if (!sessionId) {
      throw new Error("Failed to initialize session");
    }

    if (!ownSession) {
      resolvedRegion = await resolveSessionRegion(ctx, sessionId, resolvedRegion);
      const storedSettings = await ctx.runQuery(internal.metadata.getSessionSettings, { sessionId });
      if (storedSettings !== null) config.sessionConfig = storedSettings;
    }

    return withOwnedCleanup(ctx, {
      sessionId, config, owned: ownSession, region: () => resolvedRegion,
    }, async () => {
      if (args.url) {
        await runWithRegionRetry(ctx, {
          sessionId,
          initialRegion: resolvedRegion,
          onRegionResolved: async (region) => {
            resolvedRegion = region;
          },
          run: async (region) =>
            api.navigate(
              sessionId,
              args.url,
              config,
              {
                waitUntil: args.options?.waitUntil,
                timeout: args.options?.timeout,
              },
              region,
            ),
        });
      }

      const result = await runWithRegionRetry(ctx, {
        sessionId,
        initialRegion: resolvedRegion,
        onRegionResolved: async (region) => {
          resolvedRegion = region;
        },
        run: async (region) =>
          api.runBrowserTask(
            sessionId,
            {
              cua: args.options?.cua,
              mode: args.options?.mode,
              model: args.model,
              systemPrompt: args.options?.systemPrompt,
              executionModel: args.options?.executionModel,
              provider: args.options?.provider,
            },
            {
              instruction: args.instruction,
              maxSteps: args.options?.maxSteps,
              timeout: args.options?.timeout,
              highlightCursor: args.options?.highlightCursor,
            },
            config,
            args.options?.shouldCache,
            region,
          ),
      });

      // Strip passthrough fields to match the Convex return validator.
      // The API may return extra fields (e.g. timestamp, messages) not in the validator.
      const r = result.result;
      return {
        actions: r.actions.map((a: any) => ({
          type: a.type,
          action: a.action,
          reasoning: a.reasoning,
          timeMs: a.timeMs,
          taskCompleted: a.taskCompleted,
          pageText: a.pageText,
          pageUrl: a.pageUrl,
          instruction: a.instruction,
        })),
        completed: r.completed,
        message: r.message,
        success: r.success,
        metadata: r.metadata,
        usage: r.usage
          ? {
              input_tokens: r.usage.input_tokens,
              output_tokens: r.usage.output_tokens,
              reasoning_tokens: r.usage.reasoning_tokens,
              cached_input_tokens: r.usage.cached_input_tokens,
              inference_time_ms: r.usage.inference_time_ms,
            }
          : undefined,
      };
    });
  },
});
