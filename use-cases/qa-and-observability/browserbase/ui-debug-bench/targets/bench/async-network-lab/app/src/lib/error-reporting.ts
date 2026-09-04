type AppBuilderErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type AppBuilderEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: AppBuilderErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: AppBuilderEvents;
  }
}

export function reportAppBuilderError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.__lovableEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
}
