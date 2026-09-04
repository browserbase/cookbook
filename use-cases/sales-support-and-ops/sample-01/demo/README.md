# OpenTable reservation function

`index.ts` registers **`book-reservation`** with Browserbase Functions. It searches OpenTable for a restaurant in **San Francisco, CA**, selects a requested slot, and attempts guest checkout using Stagehand and an outer OpenAI agent.

Calling this function can create a real reservation. The agent is instructed to stop when a credit card is required; that instruction is not a separately enforced checkout guard. This recipe has local configuration tests, but no live reservation verification.

## Setup

Use Node.js 22 or newer and work inside this directory. Install this package independently, preserving the cookbook's seven-day dependency age policy:

```bash
pnpm --config.minimumReleaseAge=10080 install
cp .env.example .env
```

Fill in the local template without committing it:

| Caller configuration | Purpose |
| --- | --- |
| `BROWSERBASE_API_KEY` | Authenticates Functions API requests. |
| `BROWSERBASE_PROJECT_ID` | Selects the project when publishing with the CLI. |
| `MODEL_API_KEY` | Passed as `apiKey` for the Stagehand primitive model. The current default needs an Anthropic key. |
| `OPENAI_API_KEY` | Passed separately as required `agentApiKey` for the outer OpenAI agent. |
| `FUNCTION_ID` | UUID returned when this function is published; add it to your caller environment. |

The function receives model keys in its parameters. Copying `.env` alone does not send those parameters or load a caller's environment. For a saved JavaScript caller, Node can load the file with `node --env-file=.env caller.mjs`.

The existing `pnpm run deploy` script runs `bb publish index.ts`. It requires a separately available, authenticated Browserbase CLI; this package does not declare the CLI as a dependency. Publishing is a separate cloud action. Record the returned Function ID for API calls. The registered name is `book-reservation`, but the HTTP endpoint takes that **Function ID**, not the name.

## Inputs

Every field below belongs inside the request's `params` object.

| Parameter | Required | Contract |
| --- | --- | --- |
| `restaurantName` | Yes | Nonempty string; searched in San Francisco. |
| `date` | Yes | String in `YYYY-MM-DD` format. Supply a real future date; the schema checks the format only. |
| `time` | Yes | String, such as `19:00` or `7:00 PM`. |
| `partySize` | Yes | Number from 1 to 20. Supply a whole number; the schema does not enforce integrality. |
| `guestFirstName`, `guestLastName` | Yes | Nonempty strings. |
| `guestEmail` | Yes | Valid email string. |
| `guestPhoneNumber` | Yes | String; formatted by `shared/utils.ts`. |
| `apiKey` | Yes | Nonblank provider key for Stagehand primitives. |
| `agentApiKey` | Yes | Nonblank OpenAI key for the outer agent. |
| `specialRequests` | No | String added to the booking instructions. |
| `model` | No | Stagehand provider/model ID; current code default is `anthropic/claude-sonnet-4-20250514`. Choose a supported model for your provider account and pass its matching key. |
| `agentModel` | No | Bare OpenAI model ID; current code default is `gpt-5.4-mini`. |
| `maxSteps` | No | Numeric agent step limit, default 50. Supply a positive integer; the schema does not enforce that restriction. |

`bookingUrl` and `location` are unsupported. They cannot replace `restaurantName` or change the hardcoded search city. Selecting another primitive model does not switch the outer agent's provider or remove its OpenAI key requirement. Local preflight checks configuration presence and syntax, not provider access or model availability.

## Submit an invocation

The following function illustrates the exact API envelope. It does nothing until called. Replace the synthetic restaurant and guest details with the intended reservation details before calling it. The date defaults to 30 days ahead for illustration; select the actual desired date.

```javascript
async function requestReservation(env = process.env, fetchImpl = fetch) {
  for (const name of ['BROWSERBASE_API_KEY', 'FUNCTION_ID', 'MODEL_API_KEY', 'OPENAI_API_KEY']) {
    if (!env[name]?.trim()) throw new Error(`Missing ${name}`);
  }
  const response = await fetchImpl(
    `https://api.browserbase.com/v1/functions/${encodeURIComponent(env.FUNCTION_ID)}/invoke`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bb-api-key': env.BROWSERBASE_API_KEY,
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        params: {
          restaurantName: 'REPLACE WITH THE INTENDED RESTAURANT',
          date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
          time: '19:00',
          partySize: 2,
          guestFirstName: 'Example',
          guestLastName: 'Guest',
          guestEmail: 'guest@example.invalid',
          guestPhoneNumber: '415-555-0100',
          apiKey: env.MODEL_API_KEY,
          agentApiKey: env.OPENAI_API_KEY,
        },
      }),
    },
  );
  if (!response.ok) throw new Error(`Invocation request failed: HTTP ${response.status}`);
  const invocation = await response.json();
  if (typeof invocation.id !== 'string' || !invocation.id) {
    throw new Error('Missing invocation ID');
  }
  return invocation;
}
```

After editing the example, `await requestReservation()` submits the request. A successful POST returns an invocation record, not the reservation result. Save its `id` and poll `GET https://api.browserbase.com/v1/functions/invocations/{id}` with the same `x-bb-api-key` header. Wait between polls and bound the polling duration. `PENDING` and `RUNNING` are nonterminal; `FAILED` is an invocation failure; `COMPLETED` exposes the handler's return value in `results`. Treat an unknown status as an error.

See the [Functions invocation API](https://docs.browserbase.com/reference/api/invoke-a-function) for the request and invocation record contract. A request timeout or polling timeout does not establish whether checkout occurred. Inspect the existing invocation and session before deciding what to do next; resubmitting creates another attempt.

## Interpret the result

The handler returns `success`, `creditCardRequired`, `confirmed`, `confirmationNumber`, `restaurant`, `reservation`, `guest`, `cancellationPolicy`, `error`, `message`, `availableAlternatives`, `actions`, `sessionReplayUrl`, and `duration` (milliseconds).

`success` comes from the browser agent's completion outcome. Reservation fields come from parsing the agent's message as JSON, without a separate output schema or independent confirmation receipt check. Neither a completed invocation nor `success: true` alone proves a booking. Inspect `confirmed`, the confirmation details, errors, and the session replay together. Missing values default to false, empty strings, objects, or arrays; these defaults do not prove that a credit card was unnecessary or that no reservation occurred.

If the agent message is not valid JSON, the handler keeps it as `message` and defaults the other fields. Errors caught inside the handler return `success: false`; parameter validation occurs outside that catch and may instead fail the invocation. Consequently, not every failure has the handler's result shape or replay field.

## Files and local checks

- `index.ts`: registered function, input schema, San Francisco booking instructions, and result mapping.
- `browser-task.ts`: outer OpenAI agent and Stagehand tools.
- `shared/utils.ts`: phone formatting and screenshot stripping.
- `tests/model-config.test.mjs`: synthetic configuration and handler tests.
- `tests/readme-contract.test.mjs`: executes the README request against a fake transport and validates its parameters with the actual registered schema.

After dependencies are available:

```bash
node --test tests/*.test.mjs
pnpm run typecheck
```

The tests do not call providers, attach to Browserbase, or reserve a table. Scoped installed-SDK type checks are distinct from a fresh package install or a successful cloud deployment. The function configures a 300-second session API timeout; there is no measured execution-time guarantee.
