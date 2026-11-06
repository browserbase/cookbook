export type Outcome = {
  status: "ready" | "blocked" | "solving-timeout";
  renavigated: boolean;
};

export class CaptchaMonitor {
  active = false;
  revision = 0;
  finishedAt: number | undefined;

  receive(message: unknown) {
    if (
      message !== "browserbase-solving-started" &&
      message !== "browserbase-solving-finished" &&
      message !== "browserbase-solving-errored"
    )
      return;
    this.revision++;
    this.active = message === "browserbase-solving-started";
    this.finishedAt = message === "browserbase-solving-finished" ? performance.now() : undefined;
  }
}

class DeadlineExceeded extends Error {}

export async function waitAndVerify(options: {
  monitor: CaptchaMonitor;
  navigate: (remainingMs: number) => Promise<unknown>;
  isReady: () => Promise<boolean>;
  timeoutMs: number;
  readinessGraceMs?: number;
  pollMs?: number;
}): Promise<Outcome> {
  const { monitor, navigate, isReady, timeoutMs, readinessGraceMs = 3_000, pollMs = 100 } = options;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("timeoutMs must be positive");
  const deadline = performance.now() + timeoutMs;
  let renavigated = false;
  const remaining = () => Math.max(0, deadline - performance.now());
  async function bounded<T>(operation: () => Promise<T>): Promise<T> {
    if (!remaining()) throw new DeadlineExceeded();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new DeadlineExceeded()), remaining());
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  try {
    await bounded(() => navigate(remaining()));
    while (remaining() > 0) {
      if (!monitor.active) {
        const revision = monitor.revision;
        const ready = await bounded(isReady);
        // A challenge may start while the readiness check is in flight.
        if (revision === monitor.revision && !monitor.active) {
          if (ready) return { status: "ready", renavigated };
          if (
            !renavigated &&
            monitor.finishedAt !== undefined &&
            performance.now() - monitor.finishedAt >= readinessGraceMs
          ) {
            renavigated = true;
            await bounded(() => navigate(remaining()));
          }
        }
      }
      await bounded(
        () => new Promise((resolve) => setTimeout(resolve, Math.min(pollMs, remaining()))),
      );
    }
  } catch (error) {
    if (!(error instanceof DeadlineExceeded)) throw error;
  }
  return { status: monitor.active ? "solving-timeout" : "blocked", renavigated };
}
