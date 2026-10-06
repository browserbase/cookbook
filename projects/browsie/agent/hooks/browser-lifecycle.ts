import { defineHook } from "eve/hooks";

import { closeBrowserRuntime, saveBrowserRuntime } from "../lib/browser-runtime";

export default defineHook({
  events: {
    async "turn.completed"(_event, ctx) {
      await saveBrowserRuntime(ctx.session.id).catch(() => undefined);
    },
    async "session.completed"(_event, ctx) {
      await closeBrowserRuntime(ctx.session.id).catch(() => undefined);
    },
    async "session.failed"(_event, ctx) {
      await closeBrowserRuntime(ctx.session.id).catch(() => undefined);
    },
  },
});
