import {
  getDemoSnapshot,
  subscribeToDemo,
} from "../../../../lib/demo-controller";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const demoId = url.searchParams.get("demoId");

  if (!demoId) {
    return new Response("Missing demoId.", { status: 400 });
  }

  const encoder = new TextEncoder();

  let cleanup: (closeStream: boolean) => void = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let unsubscribe: (() => void) | undefined;
      const abort = () => cleanup(true);
      cleanup = (closeStream) => {
        if (closed) return;
        closed = true;
        request.signal.removeEventListener("abort", abort);
        if (heartbeat !== undefined) clearInterval(heartbeat);
        unsubscribe?.();
        if (closeStream) {
          try { controller.close(); } catch { /* Already cancelled or errored. */ }
        }
      };
      const write = (event: string, snapshot: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(snapshot)}\n\n`));
        } catch {
          cleanup(false);
          controller.error(new Error("Status stream could not be written"));
        }
      };
      request.signal.addEventListener("abort", abort, { once: true });
      if (request.signal.aborted) { cleanup(true); return; }
      try {
        write("snapshot", getDemoSnapshot(demoId));
        if (closed) return;
        const release = subscribeToDemo(demoId, snapshot => write("snapshot", snapshot));
        // Subscription setup can synchronously trigger an abort or failed write.
        if (closed) { release(); return; }
        unsubscribe = release;
        heartbeat = setInterval(() => write("ping", {}), 15000);
        if (closed) clearInterval(heartbeat);
      } catch {
        cleanup(false);
        controller.error(new Error("Status stream could not be initialized"));
      }
    },
    cancel() { cleanup(false); },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}
