type HealthState = { errors: string[]; truncated: boolean };
type HealthWindow = Window & { __cookbookPageHealth?: HealthState };

// These functions are serialized into the page, so they cannot close over module values.
export function installPageHealth(): void {
  const target = window as HealthWindow;
  if (target.__cookbookPageHealth) return;
  const state: HealthState = { errors: [], truncated: false };
  target.__cookbookPageHealth = state;
  const record = (category: string) => {
    if (state.errors.length < 100) state.errors.push(category);
    else state.truncated = true;
  };
  window.addEventListener("error", event => {
    record(event instanceof ErrorEvent ? "runtime-error" : "resource-error");
  }, true);
  window.addEventListener("unhandledrejection", () => record("unhandled-rejection"));
}

export function readPageHealth() {
  const navigation = performance.getEntriesByType("navigation")[0] as
    (PerformanceNavigationTiming & { responseStatus?: number }) | undefined;
  const status = navigation?.responseStatus;
  const interactive = navigation?.domInteractive;
  const state = (window as HealthWindow).__cookbookPageHealth;
  return {
    pageUrl: location.href,
    pageTitle: document.title,
    statusCode: typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    domInteractiveTime: typeof interactive === "number" && Number.isFinite(interactive) && interactive > 0 ? interactive : null,
    errors: state ? [...state.errors] : null,
    errorsTruncated: state ? state.truncated : null,
    errorCoverage: state ? "document-start" as const : "unavailable" as const,
  };
}
