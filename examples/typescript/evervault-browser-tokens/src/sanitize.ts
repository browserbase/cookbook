// Errors returned by SDKs can contain credentials, URLs, request bodies, or headers.
// Only errors authored here have public messages; provider errors are never echoed.
export class DemoError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DemoError";
  }
}

export function safeError(error: unknown): { code: string; message: string } {
  return error instanceof DemoError
    ? { code: error.code, message: error.message }
    : {
        code: "RUN_FAILED",
        message:
          "The operation failed. Check configuration and service access; no provider response is displayed.",
      };
}

export function isEvervaultCiphertext(value: unknown): value is string {
  return typeof value === "string" && value.length <= 4096 && /^ev:\S{20,}$/.test(value);
}
