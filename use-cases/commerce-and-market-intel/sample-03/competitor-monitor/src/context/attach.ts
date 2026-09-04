import {
  createSession,
  type ManagedSession,
  type SessionOpts,
} from "../session";
import { getContext } from "./store";
import type { Competitor, Country } from "../config";

/**
 * Open a session that reuses the persisted Context for (competitor, country) AND
 * routes through that SAME country's residential proxy.
 *
 * This coupling is MANDATORY and is why both are derived from one `country` value:
 *  - The Context holds country-specific, account-bound cookies (e.g. a Shopee BR
 *    login). They are only valid on that country's domain/account.
 *  - Replaying them from a different country's exit IP triggers geo-mismatch
 *    security challenges (step-up auth / OTP) and returns wrong-locale data
 *    (wrong currency, catalog, availability).
 *
 * There is intentionally no way to pass a contextId with a mismatched country here —
 * `country` is the single source of truth for both the cookie set and the exit IP.
 */
export async function attachCountryContext(
  competitor: Competitor,
  country: Country,
  opts: Omit<SessionOpts, "contextId"> = {},
): Promise<ManagedSession> {
  const contextId = await getContext(`${competitor}:${country}`);
  if (!contextId) {
    throw new Error(
      `No logged-in Context for ${competitor}:${country}. ` +
        `Bootstrap it first (the login runs on a ${country} proxy, so the Context and ` +
        `proxy geo match):  npm run bootstrap -- ${competitor} ${country}`,
    );
  }
  // Same `country` drives the proxy geo in createSession → guaranteed match.
  return createSession(country, { ...opts, contextId });
}
