export async function withBrowser<B extends { close(): Promise<void> }, T>(
  browser: B,
  operation: (browser: B) => Promise<T>,
): Promise<T> {
  let failed = false;
  let operationError: unknown;
  try {
    return await operation(browser);
  } catch (error) {
    failed = true;
    operationError = error;
    throw error;
  } finally {
    try { await browser.close(); }
    catch (closeError) {
      if (failed) throw new AggregateError([operationError, closeError], 'Browser operation and cleanup failed');
      throw closeError;
    }
  }
}
