# Company News Finder Function

Search for company news with a Browserbase Function, Stagehand browser tools, and an OpenAI tool-calling agent. The result contains a summary, up to seven article links, and session metadata. The agent synthesizes observations across its browser steps and submits a structured `finish` result, which the handler validates before returning success.

Search results can be incomplete, outdated, or blocked. A valid result schema establishes the data shape, not the truth, freshness, or completeness of the news. Review linked sources before using the summary.

## Setup and deployment

Use Node 24 for the included tests; the package requires Node 22 or newer. Install dependencies inside this directory, keeping its independent package and lockfile boundary:

```bash
npm install
```

Configure `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` for the Functions CLI, then publish with `npm run deploy`. Save the returned function ID as `FUNCTION_ID`. Publishing creates or updates a remote Function; local tests below do not publish anything. See the [Functions deployment documentation](https://docs.browserbase.com/platform/runtime/overview).

## Credentials and inputs

The caller supplies `OPENAI_API_KEY` as the invocation's required `apiKey` parameter. The handler explicitly passes that key to both Stagehand and the OpenAI agent client; it does not depend on an environment variable being uploaded to the runner. Browserbase credentials authenticate the caller and deployment, separately from this model credential.

Invocation parameters can be retained by the Functions service. Treat them and invocation access as sensitive. Do not put real keys in committed JSON files, screenshots, or logs. This recipe never returns the key or raw provider errors.

| Parameter | Contract |
|---|---|
| `companyName` | Nonblank string, at most 200 characters |
| `apiKey` | Required nonblank OpenAI API key |
| `model` | OpenAI model ID without `openai/`; default `gpt-5.4-mini` |
| `maxSteps` | Integer from 1 to 100; default 30 |

Both clients use the chosen OpenAI model. Other providers require changing the agent provider implementation as well as the Stagehand model configuration.

Dashboard invocation parameters (replace the placeholder privately):

```json
{
  "companyName": "Example Company",
  "apiKey": "REPLACE_WITH_OPENAI_KEY",
  "model": "gpt-5.4-mini",
  "maxSteps": 30
}
```

## Invoke and consume the result

Set `BROWSERBASE_API_KEY`, `OPENAI_API_KEY`, and `FUNCTION_ID` in your shell, then run the actual example caller:

```bash
node invoke.mjs "Example Company"
```

[invoke.mjs](invoke.mjs) sends the required parameters, polls both `PENDING` and `RUNNING`, rejects failed or unknown statuses, checks the application-level success result, then prints the summary, links, and `metadata.sessionReplayUrl`. Each HTTP request has a 30-second timeout; polling stops after 300 attempts with three seconds between attempts. Reaching that limit does not cancel a remote invocation. See [Invoke a Function](https://docs.browserbase.com/reference/api/invoke-a-function) and [Get an Invocation](https://docs.browserbase.com/reference/api/get-an-invocation).

For a programmatic caller:

```javascript
import { invokeCompanyNews } from './invoke.mjs';
const result = await invokeCompanyNews({
  browserbaseApiKey: process.env.BROWSERBASE_API_KEY,
  apiKey: process.env.OPENAI_API_KEY,
  functionId: process.env.FUNCTION_ID,
  companyName: 'Example Company',
});
console.log(result.summary);
for (const link of result.topLinks) console.log(link.title, link.url, link.source);
console.log(result.metadata.sessionReplayUrl);
```

## Result contract

The Functions polling response wraps the handler result in `results`. The caller above unwraps it. Illustrative synthetic handler output:

```json
{
  "success": true,
  "companyName": "Example Company",
  "summary": "A synthetic article reports an example product announcement. This is fixture data, not current news.",
  "topLinks": [{ "title": "Example announcement", "url": "https://example.com/news", "source": "Example publisher" }],
  "error": null,
  "metadata": {
    "totalLinks": 1,
    "scrapedAt": "2026-09-07T00:00:00.000Z",
    "duration": 1200,
    "sessionReplayUrl": "https://www.browserbase.com/sessions/synthetic-session"
  }
}
```

A successful summary is nonempty and at most 6,000 characters; each of the 1–7 links requires a title, source, and HTTP(S) URL without embedded credentials. Serialized success results are capped at 60,000 UTF-8 bytes. Raw agent actions, screenshots, and provider messages are excluded. `scrapedAt` is the completion timestamp, not an article publication date.

Search failures, step exhaustion, or invalid output return `success: false`, `summary: null`, `topLinks: []`, a generic `error`, and the same metadata shape. Invalid inputs are rejected before browser connection. A platform status of `COMPLETED` alone does not mean that the search succeeded.

## Local verification and limits

```bash
node --test tests/contract.test.mjs
```

The 32 tests execute the handler, structured finish helper, and example caller with real Zod schemas and synthetic browser/model/HTTP fixtures. They cover successful consumption, malformed output, failed execution, credential routing, cleanup, and polling states. An isolated type check also passes against the declared Functions SDK 1.0.1 declarations and installed Stagehand 4.0.2 / AI 7 types; this is not a fresh dependency installation or a deployed bundle check. Tests do not deploy or invoke a Function, call models, visit Google, or establish live Functions extension/CDP compatibility. Session lifecycle remains owned by Functions; the handler disposes Stagehand resources and disconnects its attached browser handle.

For empty results or errors, inspect the session replay and try a more specific company name. Increasing the step limit permits more browser work but does not guarantee useful results. Model availability and account access must be verified in the deployment environment.
