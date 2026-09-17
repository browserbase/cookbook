import { internalMutation, internalQuery } from "./_generated/server.js";
import { v } from "convex/values";
import { sessionSettingsValidator } from "./sessionSettings.js";
const browserbaseRegionValidator = v.union(
  v.literal("us-west-2"),
  v.literal("us-east-1"),
  v.literal("eu-central-1"),
  v.literal("ap-southeast-1"),
);

const sessionStatusValidator = v.union(
  v.literal("active"),
  v.literal("completed"),
  v.literal("error"),
);

const sessionOperationValidator = v.union(
  v.literal("extract"),
  v.literal("act"),
  v.literal("observe"),
  v.literal("workflow"),
);

export const upsertSessionMetadata = internalMutation({
  args: {
    sessionId: v.string(),
    settings: v.optional(sessionSettingsValidator),
    region: v.optional(browserbaseRegionValidator),
    status: v.optional(sessionStatusValidator),
    operation: v.optional(sessionOperationValidator),
    url: v.optional(v.string()),
    endedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();

    if (existing) {
      const patch: Record<string, unknown> = {};
      if (args.settings !== undefined) patch.settings = args.settings;
      if (args.region !== undefined) patch.region = args.region;
      if (args.status !== undefined) patch.status = args.status;
      if (args.operation !== undefined) patch.operation = args.operation;
      if (args.url !== undefined) patch.url = args.url;
      if (args.endedAt !== undefined) patch.endedAt = args.endedAt;
      if (args.error !== undefined) patch.error = args.error;
      await ctx.db.patch(existing._id, patch);
      return null;
    }

    await ctx.db.insert("sessions", {
      sessionId: args.sessionId,
      settings: args.settings,
      region: args.region,
      startedAt: Date.now(),
      endedAt: args.endedAt,
      status: args.status ?? "active",
      operation: args.operation ?? "workflow",
      url: args.url ?? "",
      error: args.error,
    });
    return null;
  },
});

export const getSessionRegion = internalQuery({
  args: {
    sessionId: v.string(),
  },
  returns: v.union(browserbaseRegionValidator, v.null()),
  handler: async (ctx: any, args: any) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", args.sessionId))
      .first();
    return session?.region ?? null;
  },
});


export const getSessionSettings = internalQuery({
  args: { sessionId: v.string() },
  returns: v.union(sessionSettingsValidator, v.null()),
  handler: async (ctx, args) => {
    const session = await ctx.db.query("sessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", args.sessionId)).first();
    return session?.settings ?? null;
  },
});


export const recordPendingCleanup = internalMutation({
  args: { sessionId: v.string(), projectId: v.string(), region: v.optional(browserbaseRegionValidator) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("cleanupRequests")
      .withIndex("by_project_session", q => q.eq("projectId", args.projectId).eq("sessionId", args.sessionId)).unique();
    if (!existing) {
      await ctx.db.insert("cleanupRequests", {
        sessionId: args.sessionId, projectId: args.projectId,
        ...(args.region ? { region: args.region } : {}),
        state: "pending", attempts: 1, nextAttemptAt: Date.now(),
      });
    }
    return null;
  },
});

export const dueCleanup = internalQuery({
  args: { projectId: v.string(), limit: v.number() },
  returns: v.array(v.object({ sessionId: v.string(), region: v.optional(browserbaseRegionValidator) })),
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100) throw new Error("Invalid cleanup limit");
    const rows = await ctx.db.query("cleanupRequests")
      .withIndex("by_project_state_due", q => q.eq("projectId", args.projectId).eq("state", "pending").lte("nextAttemptAt", Date.now()))
      .take(args.limit);
    return rows.map(row => ({ sessionId: row.sessionId, ...(row.region ? { region: row.region } : {}) }));
  },
});

export const claimCleanup = internalMutation({
  args: { projectId: v.string(), sessionId: v.string(), token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db.query("cleanupRequests")
      .withIndex("by_project_session", q => q.eq("projectId", args.projectId).eq("sessionId", args.sessionId)).unique();
    const now = Date.now();
    if (!row || row.state !== "pending" || row.nextAttemptAt > now || (row.leaseExpiresAt ?? 0) > now) return false;
    await ctx.db.patch(row._id, { leaseToken: args.token, leaseExpiresAt: now + 120_000,
      nextAttemptAt: now + 120_000, attempts: row.attempts + 1 });
    return true;
  },
});

export const finishCleanup = internalMutation({
  args: { projectId: v.string(), sessionId: v.string(), token: v.string(), released: v.boolean() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db.query("cleanupRequests")
      .withIndex("by_project_session", q => q.eq("projectId", args.projectId).eq("sessionId", args.sessionId)).unique();
    if (!row || row.state !== "pending" || row.leaseToken !== args.token) return false;
    await ctx.db.patch(row._id, {
      state: args.released ? "release_requested" : "pending",
      leaseToken: undefined, leaseExpiresAt: undefined,
      nextAttemptAt: args.released ? Date.now() : Date.now() + Math.min(3_600_000, 30_000 * 2 ** Math.min(row.attempts, 7)),
    });
    return true;
  },
});
