import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { sessionSettingsValidator } from "./sessionSettings.js";

export default defineSchema({
  cleanupRequests: defineTable({
    sessionId: v.string(),
    projectId: v.string(),
    region: v.optional(v.union(v.literal("us-west-2"), v.literal("us-east-1"), v.literal("eu-central-1"), v.literal("ap-southeast-1"))),
    state: v.union(v.literal("pending"), v.literal("release_requested")),
    attempts: v.number(),
    nextAttemptAt: v.number(),
    leaseToken: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
  }).index("by_project_session", ["projectId", "sessionId"])
    .index("by_project_state_due", ["projectId", "state", "nextAttemptAt"]),
  sessions: defineTable({
    sessionId: v.string(),
    settings: v.optional(sessionSettingsValidator),
    region: v.optional(
      v.union(
        v.literal("us-west-2"),
        v.literal("us-east-1"),
        v.literal("eu-central-1"),
        v.literal("ap-southeast-1"),
      ),
    ),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("error"),
    ),
    operation: v.union(
      v.literal("extract"),
      v.literal("act"),
      v.literal("observe"),
      v.literal("workflow"),
    ),
    url: v.string(),
    error: v.optional(v.string()),
  }).index("by_sessionId", ["sessionId"]),
});
