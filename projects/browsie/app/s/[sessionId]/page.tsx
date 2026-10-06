import App from "../../../src/App";

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return (
    <App
      browserbaseConfigured={Boolean(process.env.BROWSERBASE_API_KEY)}
      sessionId={sessionId}
      modelConfigured={Boolean(process.env.OPENAI_API_KEY)}
      contextConfigured={Boolean(process.env.BROWSERBASE_CONTEXT_ID)}
    />
  );
}
