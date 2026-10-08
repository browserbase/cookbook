import App from "../../src/App";

export default function NewSessionPage() {
  return (
    <App
      browserbaseConfigured={Boolean(process.env.BROWSERBASE_API_KEY)}
      modelConfigured={Boolean(process.env.OPENAI_API_KEY)}
      contextConfigured={Boolean(process.env.BROWSERBASE_CONTEXT_ID)}
    />
  );
}
