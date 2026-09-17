const POSTMARK_PATTERNS = [
  /accepted at postal-service/i,
  /postal-service in possession of item/i,
  /postal-service picked up item/i,
  /arrived at postal-service/i,
];

export function hasPostmarkPattern(value: string): boolean {
  return POSTMARK_PATTERNS.some((pattern) => pattern.test(value));
}

export function findPostmarkEvidence(
  timelineEvents: string[],
  pageTextValue: string,
  trackingNumber: string,
): { postmarkEvent: string; latestStatus?: string } | null {
  const normalizedTracking = trackingNumber
    .replace(/[^A-Za-z0-9]/g, "")
    .toLowerCase();
  const normalizedPage = pageTextValue
    .replace(/[^A-Za-z0-9]/g, "")
    .toLowerCase();
  if (!normalizedTracking || !normalizedPage.includes(normalizedTracking)) {
    return null;
  }
  const accepted = timelineEvents
    .map((event) => event.replace(/\s+/g, " ").trim())
    .filter(hasPostmarkPattern);
  if (accepted.length !== 1) return null;
  const lines = pageTextValue
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const latestIndex = lines.findIndex((line) => /latest update/i.test(line));
  const latestStatus = latestIndex >= 0 ? lines[latestIndex + 1] : undefined;
  return { postmarkEvent: accepted[0], latestStatus };
}
