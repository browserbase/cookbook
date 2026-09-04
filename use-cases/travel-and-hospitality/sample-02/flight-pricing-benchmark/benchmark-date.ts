const DAY_MS = 86_400_000;

function utcToday(now: Date): number {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("A valid current date is required.");
  }
  // Flooring the epoch handles years 0–99 without Date.UTC's historical year offset.
  return Math.floor(now.getTime() / DAY_MS) * DAY_MS;
}

/** Requires a real YYYY-MM-DD calendar date strictly after the current UTC day. */
export function validateDepartureDate(value: string, now: Date = new Date()): string {
  const today = utcToday(now);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("BENCHMARK_DEPARTURE_DATE must use YYYY-MM-DD without whitespace.");
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error("BENCHMARK_DEPARTURE_DATE must be a real calendar date.");
  }
  if (timestamp <= today) {
    throw new Error("BENCHMARK_DEPARTURE_DATE must be after the current UTC day.");
  }
  return value;
}

/** Default is 30 UTC calendar days ahead; an explicitly supplied value is never normalized. */
export function departureDate(value: string | undefined, now: Date = new Date()): string {
  const today = utcToday(now);
  if (value !== undefined) return validateDepartureDate(value, now);
  const target = new Date(today + 30 * DAY_MS);
  if (!Number.isFinite(target.getTime())) throw new Error("Default departure date is out of range.");
  // Expanded ISO years are outside the benchmark's four-digit date contract.
  return validateDepartureDate(target.toISOString().slice(0, 10), now);
}
