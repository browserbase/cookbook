/** Resources belong to a measurement from the moment allocation returns. */
export interface Closeable { close(): Promise<unknown>; }
export interface RunResourcesContext {
  signal: AbortSignal;
  own<T extends Closeable>(resource: T): Promise<T>;
}

export class RunResources implements RunResourcesContext {
  private resources = new Set<Closeable>();
  private closing = false;
  private closeByResource = new Map<Closeable, Promise<void>>();
  private closeTasks: Promise<void>[] = [];
  private errors: unknown[] = [];
  constructor(readonly signal: AbortSignal) {}

  private closeResource(resource: Closeable): Promise<void> {
    const existing = this.closeByResource.get(resource);
    if (existing) return existing;
    const task = Promise.resolve().then(() => resource.close()).then(() => {}, error => { this.errors.push(error); });
    this.closeByResource.set(resource, task);
    this.closeTasks.push(task);
    return task;
  }
  async own<T extends Closeable>(resource: T): Promise<T> {
    if (!this.resources.has(resource)) {
      this.resources.add(resource);
      if (this.closing || this.signal.aborted) await this.closeResource(resource);
    }
    this.signal.throwIfAborted();
    if (this.closing) throw new Error("Measurement resources are closing");
    return resource;
  }
  beginClosing(): void {
    if (this.closing) return;
    this.closing = true;
    for (const resource of this.resources) void this.closeResource(resource);
  }
  async close(): Promise<void> {
    this.beginClosing();
    await Promise.all(this.closeTasks);
    if (this.errors.length) throw new AggregateError(this.errors, "Measurement cleanup failed; subsequent measurements must not start");
  }
}
