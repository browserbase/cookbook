import Anthropic from "@anthropic-ai/sdk";
import { agentModelName } from "../config.js";

export interface LlmResult {
  text: string;
  tokens: number;
}

export interface LlmClient {
  complete(input: { system: string; prompt: string; maxTokens?: number }): Promise<LlmResult>;
}

export class ClaudeClient implements LlmClient {
  private client: Anthropic | undefined;

  constructor(private readonly model = agentModelName()) {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({
        timeout: Number(process.env.CLAUDE_TIMEOUT_MS ?? 300000),
      });
    }
  }

  async complete(input: { system: string; prompt: string; maxTokens?: number }): Promise<LlmResult> {
    if (!this.client) {
      return {
        text: "ANTHROPIC_API_KEY is not set. This dry response preserves the harness flow but cannot diagnose or fix code.",
        tokens: 0,
      };
    }
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: input.maxTokens ?? 8000,
      thinking: { type: "adaptive" },
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    });
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    return {
      text,
      tokens: response.usage.input_tokens + response.usage.output_tokens,
    };
  }
}

export function extractJson<T>(text: string): T {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in LLM response: ${text.slice(0, 500)}`);
  }
  return JSON.parse(body.slice(start, end + 1)) as T;
}
