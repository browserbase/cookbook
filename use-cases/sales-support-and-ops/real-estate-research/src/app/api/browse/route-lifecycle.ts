import type { Stagehand } from "@browserbasehq/stagehand";

export function createRequestLifecycle(requestSignal: AbortSignal) {
  const abortController = new AbortController();
  let stagehand: Stagehand | null = null;
  let cleanupPromise: Promise<void> | null = null;
  let cleanedStagehand: Stagehand | null = null;

  const cleanup = () => {
    abortController.abort();
    const owned = stagehand;
    if (!owned || cleanedStagehand === owned) return cleanupPromise ?? Promise.resolve();
    cleanedStagehand = owned;
    cleanupPromise = Promise.allSettled([owned.close(), owned.browser.close()]).then(() => {});
    return cleanupPromise;
  };

  const onAbort = () => void cleanup();
  if (requestSignal.aborted) abortController.abort();
  else requestSignal.addEventListener("abort", onAbort, { once: true });

  return {
    signal: abortController.signal,
    get aborted() { return abortController.signal.aborted; },
    async own(instance: Stagehand) {
      stagehand = instance;
      if (abortController.signal.aborted) await cleanup();
    },
    async cleanup() {
      requestSignal.removeEventListener("abort", onAbort);
      await cleanup();
    },
  };
}
