# Procurement Automation Demo

A self-contained mock of an SAP purchase-contract workflow. Contract titles, suppliers, buyers, part numbers, prices, and files in the demo are fictionalized.

## Run

```bash
npm run agent:setup
npm run dev
```

Open `http://127.0.0.1:4173`.

`npm run agent:setup` creates the reusable **this example SAP Purchase Contract Agent** on the first run and updates its system prompt/schema on later runs. Its system prompt owns the calculation-first workflow, SAP operating procedure, verification requirements, and approval guardrails. Each invocation supplies only run-specific URLs and contract inputs. The non-secret Agent ID is stored in `.browserbase-agent.json`; every UI invocation references that ID.

## Demo flow

1. Export `BROWSERBASE_API_KEY` in the server environment, then click **Run Browserbase Agent**.
2. The backend creates a temporary, secret-gated Cloudflare tunnel to the local app and starts a managed Browserbase Agent run.
3. The Agent fetches the live public [FRED/EIA monthly WTI series](https://fred.stlouisfed.org/series/MCOILWTICO), compares its two latest observations in the Agent runtime, and applies the contract's 50% LTA pass-through formula.
4. It materializes and checks a JSON calculation artifact in the runtime result (and writes `/tmp/calculated-adjustments.json` when filesystem access is exposed), then the real cloud browser opens the SAP-style portal and updates condition `9977 Energy surcharge` on contract `PC-2026-03782`.
5. The panel streams the public-data fetch, runtime calculation, and browser actions, and exposes the Browserbase live-session/replay link.
6. After the Agent verifies the blue condition bar, green Total Price, and PCR timeline, the buyer reviews the live-derived value and can submit it for manager approval.

The API key is read only by `server.js`; it is never sent to browser code or stored in this repository. The tunnel bootstrap secret is redacted from all application API responses.

The SAP mock can also be explored manually: open a contract, select an item, click **Edit**, and add a pricing condition. Saving a condition immediately splits the affected calendar bar at its effective date, recalculates the green Total Price bar, and updates the PCR reason timeline.

## Local server boundary

The server binds to `127.0.0.1` and accepts the configured port on `127.0.0.1` or `localhost`. Its asset allowlist contains only `index.html`, `app.js`, `styles.css`, and `assets/browserbase-logo.png`. Configuration, source files, and generated artifacts are not served. Symlinked assets are rejected.

The local page receives a fresh control token on each server start and supplies it on every agent API request. Reload the page after restarting the server. Foreign origins and unexpected Host headers are rejected. The tunnel exposes the mock UI, omits the local control token, and blocks all agent API routes, including status and messages. Start and monitor runs from the local page. The token is a local development boundary; other processes running on your computer can access the local page. This server is not a multi-user deployment.

Run the regression checks without credentials:

```sh
node --test tests/static-boundary.test.cjs
```

Tests use synthetic files, exercise the actual HTTP handler and an ephemeral loopback listener, and reject dotfiles, source files, symlinked assets, foreign origins, and unauthenticated control calls. They do not start a tunnel, provision an agent, read real configuration, or run a cloud browser.

## Accepting an agent result

A completed run is eligible for review only when it reports `success: true` and `runtimeCalculationUsed: true`, includes a nonempty verification explanation and JSON calculation artifact, and matches this demo's supplied source, series, contract, item, condition, reason, and effective date. The UI validates the complete adjustment before changing pricing state. It rejects extra or partially invalid adjustments, string-coerced numbers, impossible dates, and inconsistent prices.

The calculation artifact must contain JSON data, not a filename. Its observations, identifiers, current price, 50% pass-through, baseline total, effective period, calculated price, and total must agree with the result and task inputs. The UI independently recomputes the price and total using three-decimal half-up rounding. `indexChangePct` uses percentage units and allows a 0.001 percentage-point rounding difference. Observation dates use `YYYY-MM-DD`; the effective date uses `MM-DD-YYYY`.

Unsuccessful or incomplete results remain unprepared, show the explanation as text, and offer retry. Starting another run clears the previous result. A passed check demonstrates consistency of the reported calculation; source freshness, actual sandbox execution, and portal verification remain agent-reported and require buyer review.

The agent schema now requires artifact contents and specifies date and percentage formats. Existing reusable agents need `npm run agent:setup` to update their schema and instructions before the next live run; this command writes to your Browserbase account.

Run the regression suite without credentials:

```sh
node --test tests/*.test.cjs
```

An additional rendered UI check is available through `node tests/result-browser.mjs` with a local `playwright-core` installation and Chrome. Set `COOKBOOK_PLAYWRIGHT_MODULE` to an installed Playwright module path and `COOKBOOK_CHROME` if using a different Chrome executable. It serves the actual UI through intercepted requests, uses synthetic agent responses, and checks failure, retry, accepted output, and review. All external requests are aborted.
