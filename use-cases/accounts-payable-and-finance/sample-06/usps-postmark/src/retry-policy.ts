export type FailureCode =
  | "anti_bot_blocked"
  | "tracking_widget_timeout"
  | "tracking_not_found"
  | "history_unavailable"
  | "postmark_not_found"
  | "tracking_identity_mismatch"
  | "ambiguous_tracking_evidence"
  | "capture_failed";

export const RETRYABLE_FAILURE_CODES = new Set<FailureCode>([
  "anti_bot_blocked",
  "tracking_widget_timeout",
  "capture_failed",
]);
