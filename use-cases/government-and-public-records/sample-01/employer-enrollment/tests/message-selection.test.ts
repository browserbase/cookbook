import { beforeAll, describe, expect, it, vi } from "vitest";

const list = vi.fn(async () => ({
  messages: [
    {
      message_id: "receipt",
      subject: "Receipt",
      extracted_text: "Thanks for your purchase",
      received_at: "2026-01-01T00:00:02.000Z",
    },
    {
      message_id: "activation",
      subject: "Activate enrollment",
      extracted_text: "Open https://edd.ca.gov/activate?token=synthetic",
      received_at: "2026-01-01T00:00:01.000Z",
    },
  ],
}));

vi.mock("agentmail", () => ({
  AgentMailClient: class {
    inboxes = { messages: { list, get: vi.fn() } };
  },
}));

let waitForMessage: typeof import("../src/inbox/agentmail.js").waitForMessage;
let extractConfirmationLink: typeof import("../src/inbox/extractors.js").extractConfirmationLink;

beforeAll(async () => {
  process.env.AGENTMAIL_API_KEY = "synthetic-test-key";
  ({ waitForMessage } = await import("../src/inbox/agentmail.js"));
  ({ extractConfirmationLink } = await import("../src/inbox/extractors.js"));
});

describe("waitForMessage", () => {
  it("skips a newer unrelated message and returns the matching activation", async () => {
    const message = await waitForMessage({
      inboxId: "synthetic@example.invalid",
      sinceMs: Date.parse("2026-01-01T00:00:00.000Z"),
      timeoutMs: 100,
      pollMs: 1,
      fetchFullBody: false,
      matchFn: (candidate) =>
        !!extractConfirmationLink(candidate, { allowedHosts: ["edd.ca.gov"] }),
    });
    expect(message.messageId).toBe("activation");
    expect(list).toHaveBeenCalledTimes(1);
  });
});
