export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8 space-y-6">
      <h1 className="text-2xl font-bold">Browserbase + Trigger.dev examples</h1>
      <p>This page is a setup guide. Run background tasks through the Trigger.dev development worker and dashboard.</p>
      <ol className="list-decimal pl-6 space-y-3">
        <li>Set TRIGGER_PROJECT_REF to your own project reference and authenticate the Trigger.dev CLI.</li>
        <li>In a separate terminal, run <code>npm run dev:tasks</code> and wait for the worker to register its tasks.</li>
        <li>Open your project’s Development environment in the Trigger.dev dashboard. Test <code>puppeteer-log-title</code> with <code>{"{}"}</code>.</li>
        <li>Confirm the run completed with the title <code>Browserbase cookbook worker check</code>. This task opens a local browser fixture and closes it.</li>
      </ol>
      <p>The other examples can contact websites, upload files, run models, or send explicitly requested email. Configure and review each task before invoking it.</p>
      <a className="underline" href="https://trigger.dev/docs/run-tests">Trigger.dev dashboard testing guide</a>
    </main>
  );
}
