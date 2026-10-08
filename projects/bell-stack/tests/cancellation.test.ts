import { describe, expect, it, vi } from "vitest";

import { BrowsieCancellationError, runWithCancellation } from "../agent/lib/cancellation";

describe("browser operation cancellation", () => {
  it("waits for browser cleanup and rejects as canceled", async () => {
    const controller = new AbortController();
    let releaseCleanup!: () => void;
    const cleanupGate = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    const cleanup = vi.fn(() => cleanupGate);
    const work = runWithCancellation(
      controller.signal,
      () => new Promise<string>(() => undefined),
      cleanup,
    );

    controller.abort();
    await Promise.resolve();
    expect(cleanup).toHaveBeenCalledOnce();
    releaseCleanup();
    await expect(work).rejects.toBeInstanceOf(BrowsieCancellationError);
  });

  it("runs cleanup only once for one abort signal", async () => {
    const controller = new AbortController();
    const cleanup = vi.fn(async () => undefined);
    const work = runWithCancellation(
      controller.signal,
      () => new Promise<string>(() => undefined),
      cleanup,
    );

    controller.abort();
    controller.abort();
    await expect(work).rejects.toBeInstanceOf(BrowsieCancellationError);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("does not close a browser after completed work", async () => {
    const cleanup = vi.fn(async () => undefined);
    await expect(
      runWithCancellation(new AbortController().signal, async () => "done", cleanup),
    ).resolves.toBe("done");
    expect(cleanup).not.toHaveBeenCalled();
  });
});
