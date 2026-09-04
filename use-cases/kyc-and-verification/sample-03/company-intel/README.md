# Sample Organization Company Website Intelligence

> **Agentically crawls a company's website to extract ATS, leadership, blog mentions of a target person, and technology signals.**

Built for Sample Organization's GTM Engineering team. Replaces the current Puppeteer-based website scraping with an agentic approach that adapts to different site layouts — handles the "long tail" of company websites that rigid scripts can't.

## What It Does

Given a company name and domain (plus an optional target person):

1. **ATS Detection** — Finds the careers page, identifies the hiring platform (Greenhouse, Lever, Ashby, etc.), counts open roles
2. **Person Mentions** — Uses Google `site:` search + direct blog crawling to find references to a target person
3. **Leadership Extraction** — Crawls the About/Team page for exec names and titles
4. **Tech Signals** — Analyzes job postings for technology stack and infrastructure hints

```
Input:  { company: "Browserbase", domain: "browserbase.com", target: "Paul Klein" }
  |
  v
[Phase 1: ATS] → careers page discovery → platform detection → role count
[Phase 2: Person] → Google site-search → blog crawl → extract mentions
[Phase 3: Intel] → about page → leadership → job postings → tech signals
  |
  v
Output: structured JSON with all findings + session replay URL
```

## Quick Start

### 1. Install

```bash
cd kyc-and-verification/sample-03/company-intel
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Fill in your Browserbase and AI model credentials.

### 3. Run (single company)

```bash
npm run intel
```

## Sample Output (browserbase.com)

```
COMPANY INTELLIGENCE REPORT
======================================================================
  Company:     Browserbase
  Domain:      browserbase.com
  Description: All manual tasks on the web can now be automated with AI.
  Duration:    66.3s
  Pages:       5 visited

--- ATS DETECTION ---
  Platform:    Unknown (no recognized vendor-domain evidence)
  Open Roles:  18

--- MENTIONS OF "Paul Klein" ---
  • [blog_post] Introducing Director: Web Automation for Everyone
    "Paul Klein Founder & CEO. June 16, 2025."
  • [blog_post] Building the future of web automation
    "Paul Klein Founder & CEO. June 17, 2025."
  • [blog_post] You should own your browser.
    "Paul Klein Founder & CEO. July 18, 2025."
  ... (9 total mentions found)

--- TECH SIGNALS ---
  • Distributed Systems engineering (high) — from job titles
  • Enterprise Security Engineering (medium) — from job titles
  • San Francisco based, full-time roles (high)
  • Cross-functional teams: Engineering, Design, GTM (medium)
```

## How It Works

### Phase 1: ATS Detection

1. Loads the homepage and requires a successful careers-link action, or tries explicit careers paths with successful HTTP responses.
2. Requires a visible careers/jobs heading before treating the page as discovered. A generic HTTP 200 page is insufficient; the final observed URL is recorded after redirects.
3. Parses URLs and checks exact vendor hostnames or their subdomains. Query strings, paths, lookalikes such as `lever.co.example.invalid`, user-info URLs and unsupported schemes cannot establish a vendor match.
4. Looks for a recognized hostname in the careers URL or visible job links/iframes. Conflicting vendors or absent domain evidence yield unknown; branding text alone does not establish an integration. This is an observed vendor-domain signal, not proof of an installed ATS.
5. Counts visible roles separately; failed or invalid counts remain unknown.

This conservative check can miss careers pages without headings or providers outside its explicit domain map. The lookup does not infer “Custom/In-house” merely because no known vendor was observed.

Local tests: `node --test tests/ats.test.mjs` after dependencies are installed. Synthetic workflow fixtures cover failed actions, redirects, lookalike hosts, conflicting vendors and invalid counts. Local Chrome fixtures exercise the DOM visibility check. These checks do not verify a live company's hiring platform.

### Phase 2: Person Mentions

1. Searches Google for the target person on the company domain, then falls back to a blog/news listing when no search mentions were extracted.
2. Extracts the result/article href and checks it against links observed on the discovery page. Relative links resolve against the actual listing URL after redirects. Google result wrappers are unwrapped before matching; unrelated hosts, lookalikes, unsupported schemes and user-info URLs are rejected.
3. Returns `page_url` as the article target, or `null` when unavailable or unverified. It never substitutes the company homepage or listing page for a missing article link.
4. Returns `discovery_url` separately and labels `evidence_kind` as `search_snippet` or `listing_excerpt`. Context and date describe the snippet/listing that was read; linked articles are not visited by this phase. Title/context association remains model-extracted.

Consumers must handle nullable `page_url`. Use `discovery_url` to inspect evidence when no article URL is established. A link observed on a page is not proof that the full article supports the snippet.

Local tests: `node --test tests/*.test.mjs` after dependencies are installed. Mention fixtures verify exact targets, relative links, Google wrappers, missing or invented links, and separate discovery/evidence fields without external requests.

### Phase 3: Leadership & Tech Signals

1. Tries About page paths: `/about`, `/team`, `/leadership`, etc.
2. Extracts team member names, titles, departments
3. Extracts company description
4. Goes to careers page and analyzes job postings for tech stack signals

### Browserbase Config

- **Advanced Stealth**: Enabled for sites with bot detection
- **Block Ads**: Enabled for faster page loads
- **Proxies**: Residential proxy with US geolocation
- **Session Recording**: Every crawl is recorded for debugging

## Customization

### Change the test company

Edit the `input` object in `main()`:

```typescript
const input: IntelInput = {
  company_name: "Stripe",
  domain: "stripe.com",
  target_person: "Patrick Collison",
};
```

### Add more ATS platforms

Extend the URL-based detection in `detectATS()`:

```typescript
if (currentUrl.includes("newplatform.com")) {
  atsFromUrl = "New Platform";
}
```

### Customize tech signal extraction

Modify the extraction prompt in `extractLeadershipAndSignals()` to focus on specific technologies relevant to Sample Organization's ICP.

## Performance

- **Single company**: ~60-90 seconds (depends on site complexity)
- **Pages visited**: Typically 4-6 per company
- **Token usage**: ~10-15K tokens per company (very efficient)

## Next Steps

- **CSV batch mode**: Read company list from CSV, output results to CSV
- **ATS click-through**: Click into individual job postings for deeper tech stack extraction
- **Competitor comparison**: Run against multiple companies and generate a comparison matrix
- **Functions deployment**: Deploy as a Browserbase Function for API access
- **Webhook integration**: Push results directly to Sample Organization's data pipeline

---

**Built with Browserbase + Stagehand for Sample Organization GTM Engineering**
