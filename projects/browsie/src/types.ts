export interface TraceEvent {
  id: string;
  at: string;
  kind: "system" | "skill" | "context" | "tool" | "browser" | "result" | "error";
  name: string;
  summary: string;
  detail?: unknown;
  code?: string;
  durationMs?: number;
}

export interface BrowserState {
  provider: "local" | "browserbase" | "not-started";
  status: "idle" | "starting" | "active" | "error";
  proxies?: boolean;
  verified?: boolean;
  contextId?: string;
  contextStatus?: "draft" | "saved";
  proxyLocation?: BrowserProxyLocation;
  sessionId?: string;
  liveUrl?: string;
  url?: string;
  title?: string;
  screenshotDataUrl?: string;
}

export interface BrowserProxyLocation {
  country: string;
  state?: string;
  city?: string;
}

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  path: string;
  scope: "browser" | "task" | "site";
}

export interface Bootstrap {
  product: string;
  stagehandVersion: string;
  harness: string;
  model: string;
  reasoningEffort: string;
  toolContract: string[];
  modelConfigured: boolean;
  agentMode: "agent" | "demo";
  browserMode: "local" | "browserbase";
  contexts: Array<{ name: string; configured: boolean }>;
  skills: SkillSummary[];
}

export interface AgentSettings {
  model: string;
  reasoningEffort: "low" | "medium" | "high" | "xhigh";
}

export interface ChatResponse {
  conversationId: string;
  reply: string;
  traces: TraceEvent[];
  browser: BrowserState;
  activeSkill?: string;
  activeContext?: string;
}
