# Sample Organization demo — live run results (Search & Fetch)

Real output from running the scripts against live public-sector sites, hunting
**ALPR / public-safety buying signals for Flock Safety** (Sample Organization's actual product).
Everything below used **zero browsers** — pure Search + Fetch on one API key.

> Fetch has native `markdown` and `json` output modes — no HTML parsing on your
> side. Docs: https://docs.browserbase.com/platform/fetch/overview

---

## 01 · Search API — replaces the Serper call

```bash
node 01-search.js "City of San Marcos Texas" "ALPR license plate recognition RFP solicitation public safety"
```

```
SEARCH (Serper replacement)
  query: "City of San Marcos Texas ALPR license plate recognition RFP solicitation public safety"

  6 ranked pages in 308ms — no browser, no proxy bytes

  1. Law Enforcement Automated License Plate Recognition ("alpr") Technology - Bid Information - City Of San Marcos | BidNet Direct
     https://www.bidnetdirect.com/texas/solicitations/open-bids/Law-Enforcement-Automated-License-Plate-Recognition-ALPR-Technology/0000411983

  2. Automated License Plate Readers (ALPR) | City of San Marcos, TX
     https://tx-sanmarcoscity.civicplus.com/4530/Automated-License-Plate-Readers-ALPR

  3. License Plate Recognition | City of San Marcos, TX
     https://www.sanmarcostx.gov/3010/License-Plate-Recognition

  4. (untitled)
     http://sanmarcostx.gov/DocumentCenter/View/44094

  5. San Marcos City Council delays decision on license plate readers amid privacy concerns | Community Impact
     https://communityimpact.com/austin/san-marcos-buda-kyle/government/2025/02/19/san-marcos-city-council-delays-decision-on-license-plate-readers-amid-privacy-concerns/

  6. San Marcos City Council votes to deny flock camera expansion after hours of heated debate
     https://cbsaustin.com/news/local/san-marcos-city-council-votes-to-deny-flock-camera-expansion-after-hours-of-heated-debate
```

**Talking point:** ~300ms, ranked, navigational results — same shape as Serper,
same API key as fetch/browsers. Drop-in replacement for their `Serper` call.

---

## 02 · Fetch API — read a page, no browser (raw + markdown)

```bash
node 02-fetch.js   # defaults to a content-rich San Marcos council news story
```

```
FETCH (no browser)
  raw      → HTTP 200, 280266 bytes, 1548ms  ($0.001)
  markdown → HTTP 200, 25922 chars, 2817ms  ($0.004)

  ── markdown preview (nav skipped, real content) ──
  # San Marcos City Council delays decision on license plate readers amid privacy concerns
  By Jamie Moore | 2:59 PM Feb 19, 2025 CST
  San Marcos City Council postponed a resolution at its Feb. 4 meeting that would have allowed the SMPD…
  The resolution, if approved, would have amended the contract with Flock Group Inc. to add 19 LPR cameras…
  Flock Safety's LPR cameras function as a network of license plate readers that provide real-time alerts…

  Full markdown = 25,922 chars in one call (the body above + nav/footer).
```

**Talking point:** one call turns a 280 KB page into ~26 KB of clean,
model-ready markdown — **`format: "markdown"` is native to the Fetch API**, no
ECS, no Playwright, no parsing pipeline.

*Note:* raw markdown includes page chrome (nav/header) because that's DOM order.
When you want ONLY the signal with no chrome, use `format: "json"` + a schema → that's `03`.

---

## 03 · Fetch Extract (`format: "json"`) — page → structured buying signal

This is Sample Organization's product in a single API call.

```bash
node 03-extract-signal.js https://www.bidnetdirect.com/texas/solicitations/open-bids/Law-Enforcement-Automated-License-Plate-Recognition-ALPR-Technology/0000411983
```

```
FETCH EXTRACT → buying signal for Flock Safety
  extracted in 4639ms  (HTTP 200)

  {
    "entity": "City of San Marcos",
    "title": "2026-046 - Law Enforcement Automated License Plate Recognition (\"ALPR\") Technology",
    "category": "Law Enforcement Automated License Plate Recognition (ALPR) Hardware and Software",
    "stage": "RFI",
    "due_date": "02/13/2026",
    "is_relevant": true,
    "signal": "The City of San Marcos is in the early research phase via an RFI to evaluate ALPR technology options, providing a direct opportunity for Flock Safety to educate the city on its solutions before a formal RFP is issued."
  }
```

**Talking point:** raw gov page → a sellable, structured lead, in one Fetch call.
You define the `schema`; the API does the read + extraction. No separate LLM
plumbing, no "only if it has an email on it" heuristics.

---

## 04 · Search → decide → Fetch — the nightly loop for one entity

```bash
node 04-search-to-signal.js "City of San Marcos Texas"
```

```
ENTITY: City of San Marcos Texas   (hunting Flock Safety signals)

SEARCH → 6 pages

✅ SIGNAL   .../Law-Enforcement-Automated-License-Plate-Recognition-ALPR-Technology/0000411983
            Law Enforcement Automated License Plate Recognition ("ALPR") Technology  [RFI]
            → The city is seeking information regarding the availability of ALPR hardware and
              software, which aligns directly with Flock Safety's core technology.

✅ SIGNAL   https://tx-sanmarcoscity.civicplus.com/4530/Automated-License-Plate-Readers-ALPR
            Automated License Plate Readers (ALPR)  [Contract discontinued]
            → City Council voted to discontinue the contract; all city contracted Flock cameras
              were deactivated and removed by February 1, 2026.

✅ SIGNAL   https://www.globaltenders.com/tender-detail/law-enforcement-automated-license-plate-reco-...
            Law Enforcement ALPR Technology Hardware And Software  [Open]
            → The City of San Marcos is seeking a replacement provider for its ALPR program —
              a core product offering for public safety / license plate recognition.

✅ SIGNAL   https://cbsaustin.com/news/local/san-marcos-city-council-votes-to-deny-flock-camera-expansion...
            San Marcos City Council votes to deny flock camera expansion  [denied]
            → Council rejected a proposed expansion of Flock ALPR cameras over data-privacy,
              audit, and misuse concerns.

────────────────────────────────────────────────────────────
  4 signals · 4 fetches (no browser) · 0 browser sessions
```

**Talking point:** the full arc on one city — RFI out now → prior contract
discontinued → seeking a replacement → council debate — assembled from Search +
Fetch alone, **0 browsers**. That ratio is the whole pitch: most of Sample Organization's
65M nightly pages never need a browser.

---

## The numbers to land

| | Sample Organization today | With Search + Fetch |
|---|---|---|
| Find pages | Serper (separate vendor) | **Search** — same API key |
| Read static pages | Playwright on ECS (crashes, proxy bans, 3am restarts) | **Fetch** — no browser |
| Extract the signal | custom parse pipeline + heuristics | **Fetch `format:json`** — 1 call |
| Cost per page | a full browser *minute* per page | $1/1k raw · $4/1k markdown · $7/1k json |
| When you DO need a browser | every page (bazooka on a fly) | only client-rendered SPAs / logins (~15%) |

**One-liner from our own Fetch launch post** (his exact metaphor):
> "Spinning up a full browser session to read a page is like killing a mosquito
> with a rocket launcher." — https://www.browserbase.com/blog/fetch-api
