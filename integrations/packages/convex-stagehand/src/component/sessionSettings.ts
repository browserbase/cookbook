import { v, type Infer } from "convex/values";

export const sessionSettingsValidator = v.object({
  domSettleTimeoutMs: v.optional(v.number()),
  selfHeal: v.optional(v.boolean()),
  systemPrompt: v.optional(v.string()),
  verbose: v.optional(v.union(v.literal(0), v.literal(1), v.literal(2))),
  experimental: v.optional(v.boolean()),
});
export type SessionSettings = Infer<typeof sessionSettingsValidator>;

export function sessionSettings(options?: SessionSettings): SessionSettings {
  const result: SessionSettings = {};
  for (const key of ["domSettleTimeoutMs", "selfHeal", "systemPrompt", "verbose", "experimental"] as const) {
    const value = options?.[key];
    if (value !== undefined) Object.assign(result, { [key]: value });
  }
  return result;
}
