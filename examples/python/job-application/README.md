# Stagehand + Browserbase: Job Application Automation

Stagehand is the SDK for browser agents.

This template uses Stagehand V4 to discover every role on a public test job board, fill each application with unique test data, upload a PDF resume, and submit it.

## Run

```bash
cp .env.example .env
uv sync
uv run python main.py
```

Set `BROWSERBASE_API_KEY` in `.env`. `MAX_CONCURRENCY` defaults to `2`; set `MAX_JOBS` to a positive number when you want a bounded test run.

Expected output includes the number of discovered jobs, a submission line for every application, and a final completed-submission count. Runtime errors still make the process exit nonzero.

Docs: https://docs.stagehand.dev/v4/first-steps/introduction

## Completion and verification

This is a test board. Its public client code validates the form and displays `Deployment Request Submitted!`; it does not deliver an application to a hiring service. The runner reports **local demo confirmation** only.

Each application must use a specific `/jobs/<number>` URL on the demo origin. Every Stagehand action must succeed. Before the final click, the runner reads back the generated agent identifier, email, region, selected multi-region option, and uploaded PDF metadata. Missing or ambiguous upload controls stop the attempt. The PDF must be at most 5 MiB.

After the click, the runner waits up to 20 checks spaced 250 ms apart for a new visible confirmation heading and a message naming the current job, with the form removed and the URL unchanged. An unconfirmed result fails; do not retry automatically because a failed observation does not prove that the preceding click had no effect. Aggregate counts include only confirmed attempts. Browser cleanup is attempted even if Stagehand initialization or cleanup fails.

Run `python3 -B -m unittest discover -s tests -v` from this recipe directory. The fixtures execute the actual Python application functions against synthetic SDK/page boundaries, checking failed actions, incorrect fields, missing uploads, stale or absent confirmations, URL changes, and cleanup. Separately, the identical Python/TypeScript DOM expression passed eight synthetic cases in isolated local Chrome through the installed TypeScript Stagehand 4.0.2 `Page.evaluate` normalization, with all network requests blocked. The Python SDK transport, model accuracy, and live Browserbase session remain unverified.
