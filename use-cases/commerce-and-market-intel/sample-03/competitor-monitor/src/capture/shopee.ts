import type { Page, Response } from "playwright-core";
import type { ArmedCapture, CaptureResult, CompetitorAdapter } from "./types";
import { safeHost } from "./types";

const GET_PC = "/api/v4/pdp/get_pc";

export const shopeeAdapter: CompetitorAdapter = {
  competitor: "shopee",
  hostMatch: /(^|\.)shopee\./i,

  matches(url: string) {
    return this.hostMatch.test(safeHost(url));
  },

  // Shopee's get_pc XHR is anti-scrape protected: for automated-looking requests it
  // returns HTTP 200 with an encrypted/withheld body (error 90309999, numeric-keyed),
  // NOT the product. But the verified browser still renders the real PDP, and Shopee
  // server-renders the full product into a `<script type="text/mfe-initial-data">`
  // blob — that's our resilient capture source. We still grab get_pc opportunistically
  // in case a given product/IP happens to return it clean.
  arm(page: Page): ArmedCapture {
    let cleanGetPc: any = null;
    const onResp = async (resp: Response) => {
      if (!resp.url().includes(GET_PC)) return;
      try {
        const j: any = await resp.json();
        const item = j?.data?.item;
        if (!item || typeof item !== "object" || Array.isArray(item)) return;
        const ids = [item.item_id, item.itemid].filter(id => id !== undefined);
        const normalized = ids.map(id => typeof id === "number" && Number.isSafeInteger(id) && id > 0
          ? String(id) : typeof id === "string" && /^[0-9]+$/.test(id) && !/^0+$/.test(id)
            ? id.replace(/^0+/, "") : null);
        if (normalized.length && normalized.every(id => id !== null && id === normalized[0])) cleanGetPc = j;
      } catch {
        /* protected / non-JSON body — SSR path covers it */
      }
    };
    page.on("response", onResp);

    return {
      async collect(p: Page): Promise<CaptureResult> {
        try {
          if (cleanGetPc) {
            return { ok: true, source: "xhr:get_pc", payload: cleanGetPc };
          }

          // Parse the SSR mfe-initial-data blob and locate the product envelope (the
          // node holding `item.item_id`). __name-safe: no named inner functions —
          // tsx/esbuild keepNames injects a `__name` helper that is undefined in the
          // page's browser context.
          const ssr = await p.evaluate(() => {
            const scripts = document.querySelectorAll(
              'script[type="text/mfe-initial-data"]',
            );
            for (let s = 0; s < scripts.length; s++) {
              const txt = scripts[s].textContent || "";
              let parsed: any;
              try {
                parsed = JSON.parse(txt);
              } catch {
                continue;
              }
              // bounded breadth-first search for { item: { item_id } }
              const queue: any[] = [parsed];
              let steps = 0;
              while (queue.length > 0 && steps < 20000) {
                steps++;
                const node = queue.shift();
                if (!node || typeof node !== "object") continue;
                const item = (node as any).item;
                if (item && typeof item === "object" && !Array.isArray(item)) {
                  const ids = [item.item_id, item.itemid];
                  let identity: string | null = null;
                  let valid = true;
                  for (let index = 0; index < ids.length; index++) {
                    const id = ids[index];
                    if (id === undefined) continue;
                    const normalized = typeof id === "number" && Number.isSafeInteger(id) && id > 0
                      ? String(id) : typeof id === "string" && /^[0-9]+$/.test(id) && !/^0+$/.test(id)
                        ? id.replace(/^0+/, "") : null;
                    if (normalized === null || (identity !== null && identity !== normalized)) valid = false;
                    identity = normalized;
                  }
                  if (valid && identity !== null) return { source: "ssr:mfe-initial-data", payload: node };
                }
                const keys = Object.keys(node);
                for (let k = 0; k < keys.length; k++) {
                  const v = (node as any)[keys[k]];
                  if (v && typeof v === "object") queue.push(v);
                }
              }
            }
            return null;
          });

          if (ssr) {
            return {
              ok: true,
              source: ssr.source,
              payload: ssr.payload,
              note: "Captured Shopee SSR product identity; no usable get_pc payload was available.",
            };
          }
          return {
            ok: false,
            source: null,
            payload: null,
            note: "no get_pc or SSR payload with a valid product identity found (possible block)",
          };
        } finally {
          page.off("response", onResp);
        }
      },
    };
  },
};
