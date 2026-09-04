# Sample Organization × Browserbase — Search & Fetch demo story

A 10-minute, code-first working session for **Brandon Max (CTO, Sample Organization)**.
Built from the mock-call transcript (2026-06-02). Brandon's own ask was:
*"let's look at your code together… we can actually replace that Serper call
with search."* This is that session.

---

## The setup (their world, in their words)

Sample Organization's mission: **beat the RFP**. 80% of public-sector RFPs are pre-baked by
a competitor, so Sample Organization gets 6–8 months ahead by reading ~130,000 public
entity sites nightly (cities, counties, school districts) — 500 pages each,
**65M pages/night** — and surfacing buying signals for customers like
**Flock Safety** (license-plate recognition) and **OpenGov**.

What Brandon said hurts:
- *"We're running this all on ECS… maintaining that in itself is super painful.
  They crash. The instances get banned. We rotate proxies… an engineer has to
  go manually restart the pods."*
- *"We use a bazooka to kill a fly — we throw Playwright at everything where some
  of these might just need curl requests. I was wondering if your service could
  provide that."*
- *"Find me the top 500 pages… navigate the site for me, versus what we're doing
  right now, which is brute force. Firecrawl does this well… I think you guys
  have a product too."*
- His Serper today: *"we use a server query to try and find the best pages."*

He's actively evaluating **Firecrawl + Serper API** for exactly this. The whole
point of the demo is to show he already has it, on one API key.

---

## The one-line reframe (open with this)

> Brandon — you said you're using a *bazooka to kill a fly* throwing Playwright
> at every page. Our Fetch launch post literally opens with *"spinning up a full
> browser session to read a page is like killing a mosquito with a rocket
> launcher."* We built the curl-shaped thing you asked for. Let me show you your
> own pipeline running on it.

(That phrasing is real — `browserbase.com/blog/fetch-api`. It lands because it's
his exact metaphor.)

---

## The live run

```bash
cd demos/sample_org
BROWSERBASE_API_KEY=… node pipeline.mjs
```

It runs **Sample Organization's actual pipeline** against 3 real cities, hunting ALPR
signals for Flock Safety — but on Browserbase Search + Fetch instead of
Serper + ECS-Playwright:

1. **Search** (replaces Serper) — ranked signal pages per entity in ~700ms,
   no browser, no proxy bytes. Powered by Exa, one API key.
2. **Decide → Fetch** (replaces brute-force Playwright) — static gov pages go
   through Fetch (no browser, ~$0.007/page). The JS-heavy `.aspx`/portal pages
   (his "ASPX monsters", OpenGov) get routed to a real browser — the
   **search → fetch → decide → browse** tiering. Only ~15% ever need a browser.
3. **Fetch Extract** (the "ready HTML" he asked for) — `format: "json"` + a
   schema pulls a **structured buying signal** straight out of the page. This is
   *Sample Organization's product*, in one API call.

### What it actually found (real, this run)
- **San Marcos** — active ALPR RFI out now (due 02/13) → fresh Flock opportunity
- **San Marcos** — *discontinued* its Flock contract Dec 2025 → competitive/churn intel
- **Gilbert** — approved a **$280K** Flock expansion → existing-account expansion
- **Dubuque** — police *exploring* ALPR and *requesting funding* → the 6-month-early signal Sample Organization lives for

Six sellable signals, 3 cities, ~27s, **one** browser session out of eight fetches.

---

## The cost / control reframe (his real objections)

Brandon is cost- and control-driven (*"the feeling of control is important to
me… 10 cents per hour means I now have to care how long I sit on a site"*).
Fetch answers both:

- **Cost shape changes in his favor.** A browser bills per minute while a 5-minute
  ASPX site loads. Fetch is per-page (~$1/1k raw, $4/1k markdown, $7/1k json),
  10s-capped. The 85% of his pages that are just *reads* stop paying browser-minute
  prices. Search is 1,000/mo free, then bundled — drops the Serper line item.
- **Control improves, not erodes.** No ECS to babysit, no Playwright patch that
  breaks the Docker image, no 3am pod restart. The thing he's afraid of handing
  off (the browser fleet) is exactly the thing that wakes him up.
- **It's additive, not a rip-and-replace.** Tier it: Fetch as a first pass in
  front of his existing browsers. Feature-flag Search in next to Serper and diff
  the results live (his idea: *"we've done that comparison for you via Serper and
  our search… it's the same thing because we just wrap it"*).

---

## The ask (how Brandon said he'll actually adopt)

He told us the motion himself: *"get a super capable engineer on the call, do an
hour, scope it, understand the code, then a call after that to implement it —
chunk it up small, feature-flag it, test the results."*

So the close is **not** a pitch — it's: *"book the 1-hour working session. We
diff Search vs your Serper call and stand up Fetch as a first pass in front of
your browsers, behind a flag, on real San Marcos / Gilbert / Dubuque pages."*

---

## Sources (our docs + blogs)
- Fetch launch — https://www.browserbase.com/blog/fetch-api  ("mosquito / rocket launcher", $1/1k, search→fetch→decide→browse)
- Search launch — https://www.browserbase.com/blog/search  (Exa-powered, 4.5M google.com requests/cycle, 1k/mo free)
- Platform thesis — https://www.browserbase.com/blog/platform  ("APIs see 15% of the web, unlock the other 85%", one API key)
- Fetch API docs — https://docs.browserbase.com/platform/fetch/overview  (format raw/markdown/json, schema, proxies, limits)
- Getting started — https://www.browserbase.com/templates/getting-started-with-browserbase
