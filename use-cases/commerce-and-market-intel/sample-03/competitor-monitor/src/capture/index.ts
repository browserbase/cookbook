import type { Competitor } from "../config";
import type { CompetitorAdapter } from "./types";
import { shopeeAdapter } from "./shopee";
import { temuAdapter } from "./temu";
import { sheinAdapter } from "./shein";
import { aliexpressAdapter } from "./aliexpress";

export type {
  CaptureResult,
  CompetitorAdapter,
  ArmedCapture,
  CaptureContext,
} from "./types";

export const ADAPTERS: CompetitorAdapter[] = [
  shopeeAdapter,
  temuAdapter,
  sheinAdapter,
  aliexpressAdapter,
];

/** Adapter for a known competitor key. */
export function adapterFor(competitor: Competitor): CompetitorAdapter {
  const a = ADAPTERS.find((x) => x.competitor === competitor);
  if (!a) throw new Error(`no capture adapter for competitor: ${competitor}`);
  return a;
}

/** Infer the adapter from a product URL's host (null if none match). */
export function adapterForUrl(url: string): CompetitorAdapter | null {
  return ADAPTERS.find((a) => a.matches(url)) ?? null;
}
