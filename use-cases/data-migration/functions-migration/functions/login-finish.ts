import { defineFn } from "@browserbasehq/sdk-functions";
import Browserbase from "@browserbasehq/sdk";
import { z } from "zod";
import { BROWSERBASE_API_KEY } from "../shared/config";

/**
 * platform-a-login-finish — end the login session so its login state is flushed into the context (persist:true
 * flushes on release). Poll until the session is no longer RUNNING, then hand back the contextId, which is
 * now ready to be passed to the workflow functions as `params.contextId`.
 */
const params = z.object({
  sessionId: z
    .string()
    .describe("The login sessionId returned by platform-a-login-start."),
  contextId: z
    .string()
    .describe(
      "The contextId returned by platform-a-login-start (echoed back on success).",
    ),
});

defineFn(
  "platform-a-login-finish",
  async (_context, raw) => {
    const p = raw as z.infer<typeof params>;
    const bb = new Browserbase({ apiKey: BROWSERBASE_API_KEY });
    await (bb.sessions.update as any)(p.sessionId, {
      status: "REQUEST_RELEASE",
    }).catch(() => {});

    const deadline = Date.now() + 30_000;
    let status = "RUNNING";
    while (Date.now() < deadline) {
      try {
        const s = await bb.sessions.retrieve(p.sessionId);
        status = s.status ?? "UNKNOWN";
        if (status !== "RUNNING") break;
      } catch {
        // transient — keep polling
      }
      await new Promise((r) => setTimeout(r, 1_500));
    }

    return {
      contextId: p.contextId,
      sessionId: p.sessionId,
      status: "saved",
      sessionStatus: status,
    };
  },
  { parametersSchema: params },
);
