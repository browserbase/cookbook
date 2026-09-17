export function createBrowserOperationQueue(validate: () => void) {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(() => {
      validate();
      return operation();
    });
    tail = result.catch(() => undefined);
    return result;
  };
}
