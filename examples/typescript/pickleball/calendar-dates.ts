const COURT_TIME_ZONE = "America/Los_Angeles";

export function parseCalendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Expected YYYY-MM-DD");
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("Invalid calendar date");
  }
  return parsed;
}

export function courtToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COURT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatCalendarDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", weekday: "long", year: "numeric", month: "long", day: "numeric",
  }).format(parseCalendarDate(value));
}

export function calendarDateOptions(now = new Date()): { name: string; value: string }[] {
  const base = parseCalendarDate(courtToday(now));
  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(base);
    day.setUTCDate(base.getUTCDate() + offset);
    const value = day.toISOString().slice(0, 10);
    return { name: `${formatCalendarDate(value)}${offset === 0 ? " (Today in San Francisco)" : ""}`, value };
  });
}
