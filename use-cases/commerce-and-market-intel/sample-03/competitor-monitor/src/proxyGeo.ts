import type { Country } from "./config";

// Browserbase residential proxy geolocation per target country.
//
// `country` is ISO-3166 alpha-2 (Browserbase covers 201 countries). `city` is
// UPPER_SNAKE_CASE and optional — it tightens the exit IP to a metro, which helps
// with locale/currency rendering. If a city ever fails at runtime with
// ERR_TUNNEL_CONNECTION_FAILED (no proxy IP currently available there), drop the
// city and route country-only — see `proxiesForCountry` fallback note below.
const CITY: Record<Country, string> = {
  BR: "SAO_PAULO",
  MX: "MEXICO_CITY",
  CL: "SANTIAGO",
  CO: "BOGOTA",
  AR: "BUENOS_AIRES",
};

export interface BrowserbaseProxy {
  type: "browserbase";
  geolocation: { country: Country; city?: string };
}

/**
 * Proxy config array for a country. Set `cityPrecision: false` to route
 * country-only (the safe fallback if a metro has no available proxy IP).
 */
export function proxiesForCountry(
  country: Country,
  cityPrecision = true,
): BrowserbaseProxy[] {
  return [
    {
      type: "browserbase",
      geolocation: cityPrecision
        ? { country, city: CITY[country] }
        : { country },
    },
  ];
}
