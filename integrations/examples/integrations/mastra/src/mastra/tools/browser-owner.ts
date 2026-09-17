import { browserbase, Stagehand } from '@browserbasehq/stagehand';

export class BrowserOwner {
  private connection: Promise<Stagehand> | undefined;
  private queue: Promise<void> = Promise.resolve();
  private closing: Promise<void> | undefined;

  run<T>(operation: (stagehand: Stagehand) => Promise<T>): Promise<T> {
    if (this.closing) return Promise.reject(new Error('Browser owner is closed'));
    const result = this.queue.then(async () => {
      this.connection ??= browserbase
        .launch({ apiKey: process.env.BROWSERBASE_API_KEY! })
        .then(async browser => {
          try {
            return await Stagehand.create({ browser });
          } catch (error) {
            try {
              await browser.close();
            } catch (cleanupError) {
              console.error('Browser initialization cleanup failed', cleanupError);
            }
            throw error;
          }
        })
        .catch(error => {
          this.connection = undefined;
          throw error;
        });
      return operation(await this.connection);
    });
    this.queue = result.then(() => {}, () => {});
    return result;
  }

  close(): Promise<void> {
    this.closing ??= this.queue.then(async () => {
      if (!this.connection) return;
      const stagehand = await this.connection;
      try {
        await stagehand.close();
      } finally {
        await stagehand.browser.close();
      }
    });
    return this.closing;
  }
}

const owners = new WeakMap<object, BrowserOwner>();

export function bindBrowserOwner(requestContext: object): BrowserOwner {
  if (owners.has(requestContext)) throw new Error('Request context already has a browser owner');
  const owner = new BrowserOwner();
  owners.set(requestContext, owner);
  return owner;
}

export function browserOwnerFor(requestContext?: object): BrowserOwner {
  const owner = requestContext && owners.get(requestContext);
  if (!owner) throw new Error('Browser tools require a server-owned invocation context');
  return owner;
}
