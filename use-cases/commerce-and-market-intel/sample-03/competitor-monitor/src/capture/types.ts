import type { Page } from "playwright-core";
import type { Stagehand } from "@browserbasehq/stagehand";
import { CONFIG, type Competitor } from "../config";

/** The full PDP payload plus where we got it from. */
export interface CaptureResult {
  ok: boolean;
  /** Provenance, e.g. 'xhr:get_pc', 'window.runParams.data'. */
  source: string | null;
  /** The captured PDP data (full API response or inline global). */
  payload: unknown | null;
  /** Diagnostic note (which global hit, why empty, etc.). */
  note?: string;
  /** Adapter observed an anti-bot block on its target API (e.g. Temu's
   *  `oak/integration/render` → 403 / CAPTCHA) even though the shell HTML rendered
   *  200. fetchOnce treats this as `blocked` so the outer loop retries with a fresh
   *  IP — without it, a 200 shell would misclassify as `empty` and never retry. */
  blocked?: boolean;
}

/** Extra capabilities handed to a collector (e.g. Stagehand for AI extraction). */
export interface CaptureContext {
  /** Stagehand instance owning the session — used for AI extract on CSR sites
   *  (AliExpress) where the data only exists in the rendered DOM. */
  stagehand?: Pick<Stagehand, "extract">;
  /** Opt-in AI parse (--parse). SAMPLE_ORG's contract is RAW data — they run their own
   *  parsers — so structured extraction is a bonus, never the deliverable, and
   *  must stay off the scale path (the LLM round-trip stalls under concurrency). */
  parse?: boolean;
}

/** A capture armed before navigation; `collect` resolves it after navigation. */
export interface ArmedCapture {
  collect(page: Page, ctx?: CaptureContext): Promise<CaptureResult>;
}

export interface CompetitorAdapter {
  competitor: Competitor;
  hostMatch: RegExp;
  /** Optional pre-navigation warm-up URL (e.g. the homepage) to acquire cookies
   *  some sites require before they SSR product data on a direct PDP hit (Shein). */
  warmupUrl?: string;
  /** True if this adapter handles the given product URL (by host). */
  matches(url: string): boolean;
  /**
   * Arm pre-navigation hooks (e.g. response interception for Shopee) and return a
   * collector that yields the payload once navigation + settle is done. Adapters
   * that read an inline `<script>` global arm nothing and just evaluate on collect.
   */
  arm(page: Page): ArmedCapture;
}

/** Parse the hostname out of a URL without throwing on malformed input. */
export function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Factory for the inline-`<script>`-global capture style (Temu / Shein / AliExpress):
 * after the page renders, probe a prioritized list of global paths and return the
 * first non-empty one. Logging which path hit makes site drift visible.
 *
 * `paths` are resolved against `window`, e.g. 'runParams.data' -> window.runParams.data.
 */
export function makeInlineAdapter(
  competitor: Competitor,
  hostMatch: RegExp,
  paths: string[],
  warmupUrl?: string,
): CompetitorAdapter {
  return {
    competitor,
    hostMatch,
    warmupUrl,
    matches(url: string) {
      return hostMatch.test(safeHost(url));
    },
    arm(): ArmedCapture {
      return {
        async collect(page: Page): Promise<CaptureResult> {
          // These globals hydrate async, so wait until one is populated & non-empty
          // (rejects empty `{}` stubs like AliExpress's dead window.runParams). The
          // condition is a STRING expression — Playwright evals it in-page as-is, so
          // it sidesteps the tsx/esbuild __name issue that breaks passed functions.
          const cond = paths
            .map((p) => {
              const access = p
                .split(".")
                .map((k) => `?.[${JSON.stringify(k)}]`)
                .join("");
              return `(function(){var v=window${access};return v!=null&&(typeof v==='object'?Object.keys(v).length>0:typeof v==='string'?v.length>0:false);})()`;
            })
            .join("||");
          try {
            await page.waitForFunction(cond, undefined, {
              timeout: CONFIG.inlineWaitMs,
              polling: 500,
            });
          } catch {
            /* timed out — do a final read anyway in case of a near-miss */
          }

          // __name-safe: plain loops only, no named inner functions / arrow callbacks.
          const hit = await page.evaluate((paths: string[]) => {
            for (const p of paths) {
              let v: any = window;
              const parts = p.split(".");
              for (let i = 0; i < parts.length; i++) {
                v = v == null ? undefined : v[parts[i]];
              }
              const nonEmpty =
                v != null &&
                (typeof v === "object"
                  ? Object.keys(v).length > 0
                  : typeof v === "string"
                    ? v.length > 0
                    : false);
              if (nonEmpty) return { path: p, value: v };
            }
            return null;
          }, paths);

          if (!hit) {
            return {
              ok: false,
              source: null,
              payload: null,
              note: `no non-empty inline global (tried: ${paths.map((p) => "window." + p).join(", ")})`,
            };
          }
          return {
            ok: true,
            source: `window.${hit.path}`,
            payload: hit.value,
            note: `hit window.${hit.path}`,
          };
        },
      };
    },
  };
}
