// POST /api/agent — kicks off the agent and returns an SSE stream.
// The frontend reads this stream for real-time status updates, questions
// from the agent, and the final completion/error event.

import { runAgent } from "../../../lib/agent";

// Increase the max duration for Vercel Pro (agent can take a few minutes)
export const maxDuration = 300;

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const ALLOWED_RESUME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function validateAgentRequest(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Request body must be an object");
  const body = value as Record<string, unknown>;
  for (const key of ["firstName", "lastName", "resumeBase64", "resumeFileName", "resumeMimeType"]) {
    if (typeof body[key] !== "string" || !(body[key] as string).trim()) {
      throw new Error(`${key} is required`);
    }
  }
  const resumeFileName = body.resumeFileName as string;
  if (resumeFileName !== resumeFileName.split(/[\\/]/).pop()) {
    throw new Error("resumeFileName must not contain a path");
  }
  if (!ALLOWED_RESUME_TYPES.has(body.resumeMimeType as string)) {
    throw new Error("Unsupported resume file type");
  }
  const extension = resumeFileName.toLowerCase().match(/\.[^.]+$/)?.[0];
  const expectedExtension = new Map([
    ["application/pdf", ".pdf"],
    ["application/msword", ".doc"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ]).get(body.resumeMimeType as string);
  if (extension !== expectedExtension) throw new Error("Resume name and file type do not match");
  const resumeBase64 = body.resumeBase64 as string;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(resumeBase64) || resumeBase64.length % 4 !== 0) {
    throw new Error("resumeBase64 must be valid base64");
  }
  if (Buffer.byteLength(resumeBase64, "base64") > MAX_RESUME_BYTES) {
    throw new Error("Resume exceeds 10 MiB");
  }
  return {
    firstName: (body.firstName as string).trim(),
    lastName: (body.lastName as string).trim(),
    resumeBase64,
    resumeFileName,
  };
}

export async function POST(req: Request) {
  let input;
  try {
    input = validateAgentRequest(await req.json());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();

  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  // Start the agent in the background — don't await it.
  // The stream stays open for the lifetime of the agent execution.
  runAgent({ ...input, id, writer, signal: req.signal }).catch(() => {
    // Error handling is done inside runAgent
  });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
