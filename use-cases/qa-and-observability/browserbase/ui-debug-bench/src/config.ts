export const DEFAULT_CLAUDE_MODEL = "claude-opus-4-8";

export function agentModelName(): string {
  return process.env.CLAUDE_MODEL ?? DEFAULT_CLAUDE_MODEL;
}

export function stagehandModelName(): string {
  const configured = process.env.STAGEHAND_MODEL ?? process.env.CLAUDE_MODEL ?? DEFAULT_CLAUDE_MODEL;
  return configured.includes("/") ? configured : `anthropic/${configured}`;
}
