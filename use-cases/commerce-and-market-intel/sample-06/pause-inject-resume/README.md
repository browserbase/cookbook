# Pause, inject, resume — Stagehand v4 inside your own agent loop

A runnable answer to the question "v4 removed `agent()` — so how much do we have to own now?"

The short version: you own the loop, and that is the feature. This demo drives a browser with
Stagehand v4 from inside a **Claude Agent SDK** loop, pauses mid-session to call a Retailer-owned
internal API, injects that result into the live page, and resumes browsing — with the browser
session never closing and Retailer's own tools sitting in the same loop as Stagehand's.

Everything here is Python and runs in about a minute.

```bash
cp .env.example .env      # add BROWSERBASE_API_KEY
uv sync
uv run demo
```

That single Browserbase key is the whole setup. Stagehand's `act`/`observe`/`extract` calls run on
the **Browserbase Model Gateway**, so there is no LLM provider to configure — omit the model and
Browserbase picks one. Bring your own with `RETAILER_DEMO_MODEL_NAME` if you'd rather pin it.

---

## What changed in v4, and why

In v3, `stagehand.agent()` ran the loop for you: act → observe → extract, in a cycle you couldn't
step into. That made it hard to interleave your own signals. If you wanted to consult an internal
service between two browser actions, there was no seam to do it in.

v4 removes the loop and hands you the pieces. Stagehand is now a set of ~90 methods you register as
tools in whatever harness you already use — Claude Agent SDK here, but the shape is the same for
Pydantic AI, LangGraph, or a hand-rolled loop. The seam you were missing is now every step.

| | v3 | v4 |
| --- | --- | --- |
| who runs the loop | Stagehand | you |
| interleaving your own tools | hard | they're just more tools in the same loop |
| pausing mid-run | no seam | every step is a seam |
| what you can log/deny | the agent's final answer | every individual call |
| your own MCP servers | separate process, separate loop | registered side by side |

## The loop this demo builds

```
                       ┌──────────────────────────────┐
                       │      Claude Agent SDK        │
                       │   (your loop, your rules)    │
                       └──────┬────────────────┬──────┘
                              │                │
       mcp__browser_tools__*  │                │  mcp__retailer_signals__*
                              │                │
              ┌───────────────▼──────┐  ┌──────▼───────────────┐
              │  MCP server          │  │  MCP server          │
              │  YOUR CODE, ~50 ln   │  │  YOUR CODE           │
              │  stagehand_tools/    │  │  retailer/mcp.py      │
              │  mcp.py              │  │                      │
              └───────────────┬──────┘  └──────┬───────────────┘
                              │ imports        │ calls
              ┌───────────────▼──────┐  ┌──────▼───────────────┐
              │  Stagehand v4        │  │  Retailer internal    │
              │  THE BROWSER         │  │  service             │
              │  INTELLIGENCE LAYER  │  │  retailer/signals.py  │
              │  act/observe/extract │  │  price_affinity      │
              │  + Page/Locator      │  │                      │
              └───────────────┬──────┘  └──────────────────────┘
                              │
              ┌───────────────▼──────┐
              │  ONE live browser    │  ← never closes, never restarts
              │  session             │     across the entire run
              └──────────────────────┘
```

**Stagehand is the browser intelligence layer, not an MCP server.** It's an SDK you import —
`from stagehand import Stagehand`. The `pip install stagehand` package ships no server and no
runnable entry point.

MCP appears here only because Claude Agent SDK consumes MCP. The two servers in the middle row are
*this demo's* code: `stagehand_tools/mcp.py` is ~50 lines of one-line wrappers over SDK methods,
registered with `create_sdk_mcp_server()` — a **Claude Agent SDK** function, not a Stagehand one.
That's why the namespace is `mcp__browser_tools__*` and not `mcp__stagehand__*`: the MCP server is
the adapter, and Stagehand is what the adapter calls. Swap in plain function tools, LangGraph nodes,
or direct calls and nothing below that row changes.

That adapter being yours *is* the v4 model: it's why you decide which of the 90+ methods the model
can reach, and where you put logging, gating, and approval.

One related note so the naming doesn't mislead in the other direction: Stagehand *does* speak MCP,
but as a **client**. `page.tools()` discovers WebMCP tools that a *web page* advertises and
`WebMCPTool.invoke()` calls them — Stagehand consuming someone else's tools, the opposite direction
from this demo.

Two in-process MCP servers, one loop, one browser session. `src/retail_demo/harness.py` is the
whole thing — registering your existing MCP server alongside is one more entry in `mcp_servers`.

## The two modes

Set `RETAILER_DEMO_MODE`:

### `tools` — direct tool calls

Claude picks one Stagehand tool per step. Maximum visibility: every browser action is a distinct
tool call you can log, gate, or reject.

```
[claude agent] requested mcp__browser_tools__browser_open_page
  [stagehand-v4] browser_open_page data:text/html;charset=utf-8,%3C%21doctype%20html...
[claude agent] requested mcp__browser_tools__page_fill
  [stagehand-v4] page_fill #search-input
...
```

### `code` — the batching path

Claude writes a Stagehand script and sends it with `stagehand_batch`. Stagehand serializes it to the
extension running next to the browser, where the sequence runs through one batch invocation. The demo does not instrument transport requests.

```python
await stagehand.experimental_batch(source, input, timeout=60_000)
```

```js
// what the model writes
async (batch, input) => {
  await batch.page.goto(input.url);
  await batch.page.locator("#search-input").fill(input.query);
  await batch.page.locator("#apply-search").click();
  await batch.page.waitForSelector('body[data-search-applied="true"]');
  return await batch.extract("every product card", input.schema);
}
```

The summary counts instrumented Stagehand adapter invocations. One `browser_open_page`
invocation can call several SDK methods, while one `stagehand_batch` invocation can execute
many operations inside the browser. These counts describe orchestration granularity; they do
not measure network requests, latency savings or transport round trips. Earlier numeric
mode comparisons have been removed because this counter cannot substantiate them.

Scripts can call the AI layer too — `batch.act`, `batch.observe`, and `batch.extract` are all
available inside the callback, so code mode is not limited to deterministic actions.

> The script executes next to the browser, not in your process. It can't close over host variables;
> everything it needs arrives through `input`. The tool description says so, which is what keeps the
> model from writing closures that fail.

## The pause / inject / resume beat

1. Stagehand opens the shelf, fills the search, submits it.
2. Stagehand reads the products — via `stagehand.extract()` with a schema, so the result is
   validated Python objects, not scraped strings.
3. **Pause.** The agent calls `mcp__retailer_signals__price_affinity`. This is Retailer-owned code in
   Retailer's network context. Stagehand isn't involved and doesn't need to be.
4. **Inject.** The returned segment, budget ceiling, and per-SKU affinity scores are written into
   the still-open page — the shelf reorders and the recommended SKU is highlighted.
5. **Resume.** The same session adds the recommended SKU to the cart.
6. `read_final_state` checks that the recommended SKU was added after the current injection.
   The summary prints `VERIFIED SEQUENCE` only when the host receipt, page observations and cart agree.
   It does not prove what caused the model to choose that SKU.

## Tools registered in this demo

Ten of the 90+ methods Stagehand v4 exposes, chosen to span both layers. Each wrapper in
`src/retail_demo/stagehand_tools/mcp.py` is one line, so the mapping is obvious:

| tool | Stagehand method | layer |
| --- | --- | --- |
| `browser_open_page` | `context.new_page(url)` / `page.goto(url)` | deterministic |
| `page_wait_for_selector` | `page.wait_for_selector(sel, state=, timeout=)` | deterministic |
| `page_fill` | `page.locator(sel).fill(value)` | deterministic |
| `page_click` | `page.locator(sel).click()` | deterministic |
| `page_snapshot` | `page.snapshot()` — a11y tree + reusable XPaths | deterministic |
| `page_evaluate` | `page.evaluate(expression)` | deterministic |
| `stagehand_act` | `stagehand.act(instruction)` | AI, self-healing |
| `stagehand_observe` | `stagehand.observe(instruction)` | AI |
| `stagehand_extract_shelf` | `stagehand.extract(instruction, Shelf)` | AI, schema-validated |
| `stagehand_inject_signals` | `page.evaluate(expression)` | deterministic |
| `stagehand_batch` (code mode) | `stagehand.experimental_batch(source, input)` | batching |

Plus Retailer's own: `price_affinity`, `read_final_state`.

`page_snapshot` is what replaces v3's observe-for-context step. It returns a trimmed accessibility
tree plus a map of reusable XPaths, which is far fewer tokens than a DOM dump.

## Observability

Because you own the loop, you get the numbers. The run summary prints:

- **Counted Stagehand tool invocations** — adapter dispatches in each mode, not transport measurements
- **cache HIT/MISS** per `act`/`observe`/`extract` call (`result.metadata.cache.status`)
- **`stagehand.metrics()`** — prompt, completion, and reasoning tokens plus inference time, broken
  out by operation

## Where Retailer swaps in real logic

**`src/retail_demo/retailer/signals.py`** — `fetch_internal_signals()` is the only place that knows
anything about customers. Replace its body with a call to the real internal API from inside your
network context. Nothing else changes.

**`src/retail_demo/retailer/mcp.py`** — or delete this file entirely and point `mcp_servers` at the
MCP server you already run:

```python
options = ClaudeAgentOptions(
    mcp_servers={
        "stagehand": stagehand_server,
        "retailer_signals": {"command": "python", "args": ["-m", "your_internal_server"]},
    },
    ...
)
```

Stagehand doesn't need to know it exists. That's the part v3 couldn't do.

**`src/retail_demo/stagehand_tools/mcp.py`** — add, remove, or rename tools. The model can only do
what you register.

Point the demo at your own environment with `RETAILER_DEMO_URL=https://...` instead of the bundled
synthetic shelf.

## Configuration

| variable | default | meaning |
| --- | --- | --- |
| `BROWSERBASE_API_KEY` | — | the only key you need; also enables the Model Gateway and server-side caching |
| `RETAILER_DEMO_MODEL_NAME` | *unset* → Model Gateway | pin Stagehand's `act`/`observe`/`extract` model, in `provider/model` form |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_API_KEY` | — | only if you pinned a model above; also how Claude Agent SDK authenticates the loop |
| `RETAILER_DEMO_CLAUDE_MODEL` | SDK default | the model that drives the loop — deliberately a separate knob |
| `RETAILER_DEMO_MODE` | `tools` | `tools` (direct tool calls) or `code` (batched scripts) |
| `RETAILER_DEMO_BROWSER` | auto | `local` or `browserbase`; defaults to `browserbase` when `BROWSERBASE_API_KEY` is set |
| `RETAILER_DEMO_URL` | bundled shelf | point at your own environment |
| `STAGEHAND_HEADLESS` | — | `1` runs the local browser headless |
| `RETAILER_DEMO_STEP_DELAY_MS` | 1800 | pause between story beats (100 when headless) |
| `RETAILER_DEMO_ACTION_DELAY_MS` | 900 | pause around visible browser actions (50 when headless) |

Two separate model knobs is intentional: your loop model and your page-understanding model don't
have to be the same, and in production usually shouldn't be. Leave `RETAILER_DEMO_MODEL_NAME` unset
and Browserbase picks the page-understanding model for you; set it and Stagehand reads the key for
whichever provider you named. The Model Gateway needs a Browserbase session, so
`RETAILER_DEMO_BROWSER=local` requires a pinned model and its key.

If a pinned provider key is missing or rejected, the AI tools fail loudly and the summary reports
that no inference ran — the deterministic tools can otherwise carry this scenario to a green result,
which would be a misleading demo.

```bash
# local Chrome needs a pinned model, since the gateway needs a Browserbase session
RETAILER_DEMO_BROWSER=local \
  RETAILER_DEMO_MODEL_NAME=anthropic/claude-sonnet-5 \
  ANTHROPIC_API_KEY=sk-ant-... \
  STAGEHAND_HEADLESS=1 uv run demo
```

## Running it

```bash
# direct tool calls, on Browserbase, with a replayable session recording
uv run demo

# the batching path — compare adapter dispatches, not network requests
RETAILER_DEMO_MODE=code uv run demo

# narrated, for recording a video
RETAILER_DEMO_STEP_DELAY_MS=3000 RETAILER_DEMO_ACTION_DELAY_MS=1500 uv run demo
```

The demo exits non-zero if the run didn't end with Retailer's recommended SKU in the cart, so it's
safe to put in CI.

This directory is self-contained — copy it anywhere, `uv sync`, and it runs. `stagehand==4.0.0` and
`claude-agent-sdk` both come from their package indexes; nothing is linked to a local checkout.

## Layout

```
src/retail_demo/
  __main__.py              entry point, run summary
  harness.py               the Claude Agent SDK loop — where you own the sequencing
  browser.py               browserbase.launch / local_browser.launch + Stagehand.create
  config.py                environment parsing
  state.py                 run state shared by both MCP servers
  stagehand_tools/
    mcp.py                 your MCP wrapper over the Stagehand SDK (direct tool call mode)
    batch.py               your MCP wrapper exposing one code-mode tool (batching)
    inject.py              the JavaScript that renders Retailer's decision into the page
  retailer/
    signals.py             ← replace this with your real internal API
    mcp.py                 ← or replace this with your real MCP server
  shelf/
    html.py                the synthetic shelf, as a self-contained data: URL
```

One note on the bundled shelf, because it will bite you on a real page too: each card renders
its SKU as **visible text**, not only as a `data-product-id` attribute. `stagehand.extract()` reads
the accessibility tree, which doesn't expose arbitrary `data-` attributes — ask it for an id that
only lives in an attribute and the model will invent one, and everything keyed on product id breaks
quietly downstream. Extract what the page actually shows; use `page.evaluate` or a locator when you
need an attribute.

## Verification boundary

A green exit requires search submission and an empty cart observed before injection, a host-recorded receipt for the current recommendation, and a subsequent observed cart-button click for that SKU on the same page. The final injection flag, cart-added flag, selected SKU and cart text must agree. New signals or injection invalidate old receipts and final state. Missing instrumentation on a custom target leaves the run unverified.

The browser callback records cart clicks separately from the model's final report. These observations establish order and consistency in this controlled demo; page JavaScript remains mutable, and they do not establish that injected data caused the model's choice. The synthetic cart no longer makes that causal claim in its status text.

Local verification:

```bash
python3 -B -m unittest discover -s tests
PLAYWRIGHT_MODULE_PATH=/absolute/path/to/playwright-core/index.mjs \
CHROME_PATH="/absolute/path/to/Chrome" node --test tests/browser-sequence.test.mjs
```

Python tests exercise the actual summary and injection tool with synthetic state. Chrome tests use the actual shelf, injection and final-read expressions, then pass observations through the actual Python gate. All page requests are fulfilled locally. No Browserbase session, model or real cart is used.

## Invocation counter scope

`RunState.stagehand_tool_invocations` increments at the existing Stagehand adapter dispatch points: direct browser/AI wrappers, injection after its signal precondition, and each batch attempt. A dispatched failure still counts. Invalid arguments or missing preconditions that fail before dispatch are not counted. Setup, final-state reads, metrics, Retailer tools and operations executed inside batches are excluded. SDK-reported token metrics remain separate.

`tests/test_invocation_counts.py` executes the actual adapters with synthetic methods to show that three SDK calls can correspond to one counted wrapper invocation and that failed dispatches and batch attempts still count. No transport is instrumented or contacted.
