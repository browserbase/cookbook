# County tax bill → PDF, with Stagehand

Production-ready Browserbase + Stagehand scripts that fetch a property-tax bill
from the Allen County (IN) portal. Same outcome as the bash `fetch-bill.sh`, but
the browser actions are **AI-resolved** (`page.act`) instead of hard-coded CSS
selectors — so they survive portal markup changes and read like the task itself.

## Two versions

| Script | Approach |
|---|---|
| `fetch-bill.ts` | **Controlled** — explicit `act()` steps: type address → Search → open property → open View Tax Bill. Predictable, fast, easy to demo. |
| `fetch-bill-agent.ts` | **Autonomous** — hands the goal to `stagehand.agent()` and lets it navigate the portal on its own. The "point it at any portal" version. |

Both then read the bill's PDF link from the DOM and download it to `~/Desktop/tax-bill.pdf`.

## Run

From the demo root (after `npm install` and setting up `.env`):

```bash
# controlled
npm run fetch -- ["123 Some St"]

# autonomous agent
npm run fetch:agent -- ["123 Some St"]
```

Defaults to `1010 Boulder Ridge Trl` if no address is given. Each run prints a
**Browserbase session URL** (live + replay) you can open during a demo.

## Config / env

Reads from the demo-root `.env`:

- `BROWSERBASE_API_KEY` — the cloud browser
- `ANTHROPIC_API_KEY` — the model that resolves the actions
- `STAGEHAND_MODEL` (optional) — defaults to `anthropic/claude-sonnet-4-5`

## Design notes

- **AI for actions, DOM for facts.** Interactions (`type`, `click`) go through
  `page.act()`; reading the exact PDF `href` is a deterministic DOM read
  (`findBillHref` in `lib.ts`), not an LLM guess — more reliable than asking the
  model to "return the URL."
- **Download is direct.** The portal serves the bill from an API endpoint, so the
  file is fetched straight to disk once the link is known.
- Shared setup (env loading, Stagehand factory, replay URL, download) lives in
  `lib.ts`.
