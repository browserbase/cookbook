import { defineHook } from "eve/hooks";

import { closeBrowserRuntime } from "../lib/browser-runtime";
import { applyTaskEvent, taskState } from "../lib/task-state";

const update = (event: unknown, ctx: { session: { id: string } }) =>
  taskState.update((current) =>
    applyTaskEvent(
      current,
      event as {
        type: string;
        data?: Record<string, unknown>;
        meta?: { id?: string; at?: string };
      },
      ctx.session.id,
    ),
  );

const cancel = async (event: unknown, ctx: { session: { id: string } }) => {
  update(event, ctx);
  await closeBrowserRuntime(ctx.session.id);
};
export default defineHook({
  events: {
    "session.started": update,
    "turn.started": update,
    "message.received": update,
    "step.started": update,
    "message.completed": update,
    "action.result": update,
    "input.requested": update,
    "input.resolved": update,
    "turn.completed": update,
    "turn.failed": update,
    "turn.cancelled": cancel,
    "session.waiting": update,
    "session.failed": update,
    "session.completed": update,
  },
});
