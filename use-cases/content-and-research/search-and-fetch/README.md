# this example demo — Search & Fetch (and when you need a browser)

Plain Node scripts. No build, no framework. Each one is meant to be **opened and
read on screen** — the Browserbase API call is marked with `👉` in every file.

## Setup

```bash
cp .env.example .env        # add your BROWSERBASE_API_KEY
export $(grep -v '^#' .env | xargs)

# Scripts 01–04 use only Node's global fetch — no install needed.
# Script 05 (browser tier) needs the SDK + Playwright:
npm install
```

| # | Script | What it shows | Browser? |
|---|--------|---------------|----------|
| 01 | `node 01-search.js` | **Search API** — ranked pages, replaces a separate search service | ❌ no |
| 02 | `node 02-fetch.js` | **Fetch API** — read a static gov page raw + markdown | ❌ no |
| 03 | `node 03-extract-signal.js` | **Fetch Extract** (`format:json`) — page → structured buying signal (structured output) | ❌ no |
| 04 | `node 04-search-to-signal.js` | The nightly loop: search → **decide** → fetch, per entity | ❌ mostly |
| 05 | `node 05-browser-when-needed.js` | The ~15%: a JS-rendered portal Fetch can't read → managed browser | ✅ yes |

All scripts take optional args, e.g.:

```bash
node 01-search.js "City of Gilbert Arizona" "ALPR license plate reader"
node 04-search-to-signal.js "City of Dubuque Iowa"
```

**The decision rule** (in `04`): Fetch handles static *and* server-rendered HTML
(including ASPX). You only reach for a browser on client-rendered SPAs, portals
behind a login, or multi-step flows. The one-line test: *did Fetch return content?*

The example is documented as a reusable technical workflow without account-specific sales material.
