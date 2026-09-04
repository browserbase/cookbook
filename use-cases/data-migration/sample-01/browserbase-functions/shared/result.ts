/**
 * Uniform function-result helpers. A Browserbase function result must be a JSONObject (no `undefined`
 * values), so we keep results to flat string/number/boolean maps. `fail` surfaces the real error + a short
 * stack in the returned result, because invocation logs aren't retrievable via the CLI.
 */
export type FnResult = Record<string, string | number | boolean>;

export const ok = (fields: FnResult): FnResult => ({ ok: true, ...fields });

export const fail = (err: unknown, extra: FnResult = {}): FnResult => ({
  ok: false,
  error: err instanceof Error ? err.message : String(err),
  stack:
    err instanceof Error
      ? (err.stack ?? "").split("\n").slice(0, 6).join(" | ")
      : "",
  ...extra,
});
