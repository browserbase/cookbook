import type { Page, Response } from "playwright-core";
import type { ArmedCapture, CaptureResult, CompetitorAdapter } from "./types";
import { safeHost } from "./types";

// Temu serves the PDP detail from its "oak" framework API — `oak/integration/render`
// (the `_oak_*` params in SAMPLE_ORG's example URL reference the same framework). A live
// probe (src/probeTemu.ts) showed this endpoint is anti-bot-gated: it returns
// 403 + a CAPTCHA (`api/phantom/obtain_captcha`) for flagged sessions, while the
// inline globals (__CHUNK_DATA__/rawData) carry only the page shell (title/store, no
// price) or are absent. So — unlike Shein/AliExpress — we intercept the defended XHR
// and lean on Browserbase's CAPTCHA solve + the outer fresh-IP retry to land a clean
// 200, exactly the resilient-capture thesis applied to SAMPLE_ORG's hardest competitor.
const OAK_RENDER = "/api/oak/integration/render";
// A 200 product body carries these; used both to validate oak/render and to catch
// the detail if Temu serves it from a different endpoint.
const PRODUCT_SIGNAL =
  /"salePrice"|"skuList"|"priceInfo"|"goodsId"|"sku_id"|"goods_id"/i;

function isApiish(url: string): boolean {
  return /\/api\/|oak|goods|detail|bff|mget|query/i.test(url);
}

export const temuAdapter: CompetitorAdapter = {
  competitor: "temu",
  hostMatch: /(^|\.)temu\./i,

  matches(url: string) {
    return this.hostMatch.test(safeHost(url));
  },

  arm(page: Page): ArmedCapture {
    let oakClean: unknown = null; // a 200 oak/render JSON carrying product signals
    let fallback: unknown = null; // product detail seen on any other endpoint
    let fallbackSrc = "";
    let saw403 = false; // oak/render (or seo) anti-bot 403/429
    let sawCaptcha = false;

    const onResp = async (resp: Response) => {
      const u = resp.url();
      try {
        if (/obtain_captcha|\/verify|challenge/i.test(u)) {
          sawCaptcha = true;
          return;
        }
        const isOak = u.includes(OAK_RENDER);
        if (isOak && (resp.status() === 403 || resp.status() === 429)) {
          saw403 = true;
          return;
        }
        // Only read bodies of API-ish JSON responses (bounds cost; some bodies are
        // not re-readable, hence the try/catch).
        if (!isApiish(u) || resp.status() !== 200) return;
        const body = await resp.text();
        if (!PRODUCT_SIGNAL.test(body) || body.length < 500) return;
        let json: unknown;
        try {
          json = JSON.parse(body);
        } catch {
          return;
        }
        if (isOak) oakClean = json;
        else if (!fallback) {
          fallback = json;
          fallbackSrc = `xhr:${new URL(u).pathname.slice(0, 60)}`;
        }
      } catch {
        /* body consumed/closed — fine */
      }
    };
    page.on("response", onResp);

    return {
      async collect(p: Page): Promise<CaptureResult> {
        // oak/render fires during load; by collect time (after the orchestrator's
        // CAPTCHA-wait) it may already be captured. If not but a CAPTCHA was seen
        // (and hopefully solved by now), one reload often re-requests it cleanly on
        // the now-trusted session.
        if (!oakClean && !fallback && sawCaptcha) {
          try {
            await p.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
            await p.waitForTimeout(4000);
          } catch {
            /* reload best-effort */
          }
        }
        p.off("response", onResp);

        if (oakClean) {
          return {
            ok: true,
            source: "xhr:oak/integration/render",
            payload: oakClean,
          };
        }
        if (fallback) {
          return {
            ok: true,
            source: fallbackSrc,
            payload: fallback,
            note: "product detail from non-oak endpoint",
          };
        }

        // No product detail. Note whether an inline global is even present (shell)
        // for diagnostics — but never report ok on the shell (it lacks price/specs).
        const inline = await p.evaluate(() => {
          const names = ["__CHUNK_DATA__", "rawData", "__rawData__"];
          for (let i = 0; i < names.length; i++) {
            const v = (window as any)[names[i]];
            if (v && typeof v === "object" && Object.keys(v).length > 0)
              return names[i];
          }
          return null;
        });

        const blocked = saw403 || sawCaptcha;
        const why = saw403
          ? "oak/render 403"
          : sawCaptcha
            ? "CAPTCHA, no clean oak/render"
            : "no oak/render or product XHR";
        return {
          ok: false,
          source: null,
          payload: null,
          blocked,
          note: `${why}${sawCaptcha ? " (+CAPTCHA)" : ""}; inline=${inline ?? "none"}`,
        };
      },
    };
  },
};
