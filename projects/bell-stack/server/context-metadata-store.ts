import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ContextMetadataFile {
  selectedContextId?: string;
  contexts: Record<
    string,
    {
      name: string;
      createdAt: string;
      updatedAt: string;
      status?: "draft" | "saved";
      ownerSessionId?: string;
      expiresAt?: string;
    }
  >;
}

export class ContextMetadataStore {
  constructor(private readonly filePath = defaultMetadataPath()) {}

  async read(): Promise<ContextMetadataFile> {
    try {
      const value = JSON.parse(
        await readFile(this.filePath, "utf8"),
      ) as Partial<ContextMetadataFile>;
      return {
        selectedContextId:
          typeof value.selectedContextId === "string" ? value.selectedContextId : undefined,
        contexts: value.contexts && typeof value.contexts === "object" ? value.contexts : {},
      };
    } catch {
      return { contexts: {} };
    }
  }

  async add(id: string, name: string, now = new Date()): Promise<void> {
    const current = await this.read();
    const at = now.toISOString();
    current.contexts[id] = { name, createdAt: at, updatedAt: at };
    current.selectedContextId ??= id;
    await this.write(current);
  }

  async addDraft(
    id: string,
    name: string,
    ownerSessionId: string,
    expiresAt: Date,
    now = new Date(),
  ): Promise<void> {
    const current = await this.read();
    const at = now.toISOString();
    current.contexts[id] = {
      name,
      createdAt: at,
      updatedAt: at,
      status: "draft",
      ownerSessionId,
      expiresAt: expiresAt.toISOString(),
    };
    await this.write(current);
  }

  async touchDraft(id: string, expiresAt: Date, now = new Date()): Promise<void> {
    const current = await this.read();
    const context = current.contexts[id];
    if (!context || context.status !== "draft") return;
    context.updatedAt = now.toISOString();
    context.expiresAt = expiresAt.toISOString();
    await this.write(current);
  }

  async promote(id: string, name: string, now = new Date()): Promise<void> {
    const current = await this.read();
    const context = current.contexts[id];
    if (!context) throw new Error("Unknown Context.");
    context.name = name;
    context.updatedAt = now.toISOString();
    context.status = "saved";
    delete context.ownerSessionId;
    delete context.expiresAt;
    current.selectedContextId = id;
    await this.write(current);
  }

  async remove(id: string): Promise<void> {
    const current = await this.read();
    delete current.contexts[id];
    if (current.selectedContextId === id)
      current.selectedContextId = Object.keys(current.contexts)[0];
    await this.write(current);
  }

  async select(id: string): Promise<void> {
    const current = await this.read();
    if (!current.contexts[id]) throw new Error("Unknown Context.");
    current.selectedContextId = id;
    current.contexts[id].updatedAt = new Date().toISOString();
    await this.write(current);
  }

  private async write(value: ContextMetadataFile): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
    await rename(temporary, this.filePath);
  }
}

declare global {
  var __browsieContextMetadataStore: ContextMetadataStore | undefined;
}

export function getContextMetadataStore(): ContextMetadataStore {
  globalThis.__browsieContextMetadataStore ??= new ContextMetadataStore();
  return globalThis.__browsieContextMetadataStore;
}

function defaultMetadataPath(): string {
  return process.env.BROWSIE_CONTEXT_METADATA_PATH
    ? path.resolve(process.env.BROWSIE_CONTEXT_METADATA_PATH)
    : path.join(process.cwd(), ".browsie", "contexts.json");
}
