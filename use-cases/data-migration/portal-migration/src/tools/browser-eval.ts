import { Stagehand } from "@browserbasehq/stagehand";
import { tool } from "ai";
import { z } from "zod";

const DEFAULT_BROWSER_EVAL_TIMEOUT_MS = 5000;
const MAX_BROWSER_EVAL_TIMEOUT_MS = 30000;

// Cap eval results so a huge DOM dump can't blow the agent's context / the trace file.
const MAX_EVAL_RESULT_CHARS = 20_000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Make an eval result safe + bounded for returning to the agent and writing to the trace. */
function sanitizeForEvent(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  let str: string | undefined;
  try {
    str = JSON.stringify(value);
  } catch {
    return String(value).slice(0, MAX_EVAL_RESULT_CHARS);
  }
  if (str === undefined) return undefined; // functions, symbols, etc.
  if (str.length > MAX_EVAL_RESULT_CHARS) {
    return {
      _truncated: true,
      originalLength: str.length,
      preview: str.slice(0, MAX_EVAL_RESULT_CHARS),
    };
  }
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * A custom agent tool that runs JavaScript in the active page's main frame, so the agent can read
 * page state / extract DOM data directly (e.g. query all rows) instead of only scrolling-and-reading.
 * Returns serializable values only; results are sanitized and size-capped.
 */
export function createBrowserEvalTool(stagehand: Stagehand) {
  return tool({
    description:
      "Run JavaScript in the active browser page's main frame. Use this for direct DOM inspection, reading page state, or small browser-side calculations. Return serializable values only; DOM nodes, functions, and very large objects will not survive serialization.",
    inputSchema: z.object({
      code: z
        .string()
        .min(1)
        .describe(
          "JavaScript to execute in the page. In expression mode, provide an expression such as `document.title` or `Array.from(document.querySelectorAll('a')).map(a => a.href)`. In functionBody mode, provide statements and use `return`.",
        ),
      mode: z
        .enum(["expression", "functionBody"])
        .default("expression")
        .describe(
          "Use expression for a single expression. Use functionBody for statements, loops, try/catch, or await.",
        ),
      timeoutMs: z
        .number()
        .int()
        .min(100)
        .max(MAX_BROWSER_EVAL_TIMEOUT_MS)
        .optional()
        .describe("Optional execution timeout in milliseconds."),
    }),
    execute: async ({
      code,
      mode,
      timeoutMs,
    }: {
      code: string;
      mode?: "expression" | "functionBody";
      timeoutMs?: number;
    }) => {
      let pageUrl = "";
      try {
        const page = (await stagehand.browser.context.activePage())!;
        pageUrl = await page.url();

        const effectiveTimeoutMs = Math.min(
          Math.max(timeoutMs ?? DEFAULT_BROWSER_EVAL_TIMEOUT_MS, 100),
          MAX_BROWSER_EVAL_TIMEOUT_MS,
        );

        const expression =
          mode === "functionBody"
            ? `(async () => {\n${code}\n})()`
            : `(async () => (${code}))()`;

        const result = await withTimeout(
          page.evaluate(expression),
          effectiveTimeoutMs,
          "browserEval",
        );

        const sanitized = sanitizeForEvent(result);

        return {
          success: true,
          pageUrl,
          result: sanitized === undefined ? null : sanitized,
          resultType: result === null ? "null" : typeof result,
        };
      } catch (err) {
        return {
          success: false,
          pageUrl,
          error: errorMessage(err),
        };
      }
    },
  });
}
