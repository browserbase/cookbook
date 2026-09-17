import type { Browser } from 'playwright-core';

export async function withBrowserSession<T>(
  connect: () => Promise<Browser>,
  release: () => Promise<unknown>,
  operation: (browser: Browser) => Promise<T>,
): Promise<T> {
  let browser: Browser | undefined;
  let result!: T;
  const errors: unknown[] = [];
  try {
    browser = await connect();
    result = await operation(browser);
  } catch (error) {
    errors.push(error);
  } finally {
    try { await browser?.close(); }
    catch (error) { errors.push(error); }
    try { await release(); }
    catch (error) { errors.push(error); }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'Browser operation or cleanup failed');
  return result;
}
