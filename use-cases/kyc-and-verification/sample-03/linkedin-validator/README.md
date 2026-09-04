# Sample Organization LinkedIn Profile Validator

> **Validates whether a person still works at the company your CRM says they do — by checking their live LinkedIn profile.**

Built for Sample Organization's GTM Engineering team. Replaces the manual "go check their LinkedIn" step in survivorship logic and data validation workflows.

## What It Does

Given a person's name, expected company, and LinkedIn URL:

1. Opens their LinkedIn profile via Browserbase (stealth + proxy)
2. Extracts current: name, headline, company, title, location
3. Compares against expected company
4. Returns a structured validation result: **NAME MATCH** or **INCONCLUSIVE**

```
Input:  { name: "Sarah Richards", expected_company: "ComplianceCo", linkedin_url: "..." }
  |
  v
[Browserbase + Stagehand + stealth + proxy]
  |
  v
Output: { match: false, actual_company: "Browserbase", actual_title: "GTM Lead", ... }
```

## Quick Start

### 1. Install

```bash
cd kyc-and-verification/sample-03/linkedin-validator
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Fill in your Browserbase and AI model credentials.

### 3. Run (single profile)

```bash
npm run validate
```

## Sample Output

### Match (person still at expected company)

```
Name:     Satya Nadella
Expected: Microsoft
URL:      https://www.linkedin.com/in/satyanadella/

Extracted: Satya Nadella @ Microsoft
NAME MATCH: Profile company Microsoft matches the expected name; employment is not independently verified.
Duration: 15.8s
```

### Mismatch (person moved)

```
Name:     Satya Nadella
Expected: Google
URL:      https://www.linkedin.com/in/satyanadella/

Extracted: Satya Nadella @ Microsoft
MISMATCH: Satya Nadella currently works at Microsoft, NOT at Google
Duration: 19.7s
```

## JSON Output

Every validation returns a structured result:

```json
{
  "name": "Satya Nadella",
  "expected_company": "Microsoft",
  "linkedin_url": "https://www.linkedin.com/in/satyanadella/",
  "actual_name": "Satya Nadella",
  "actual_headline": "Chairman and CEO at Microsoft",
  "actual_company": "Microsoft",
  "actual_title": "Chairman and CEO",
  "actual_location": null,
  "match": true,
  "match_details": "NAME MATCH: Profile company Microsoft matches the expected name; employment is not independently verified.",
  "profile_accessible": true,
  "error": null,
  "session_replay_url": "https://www.browserbase.com/sessions/535142dd-...",
  "duration_ms": 15831
}
```

## Batch Mode

Edit the `sampleBatch` array in `linkedin-validator.ts` or wire it up to read from a CSV/API. Batch mode:

- Processes profiles sequentially
- Adds a configurable delay between requests (default: 5s) to avoid rate limiting
- Prints a summary with counts: name matched, inconclusive
- Highlights mismatches (these are the actionable findings)

## How It Works

### Browserbase Config

- **Advanced Stealth**: Enabled — uses a modified Chromium binary that evades common bot detection
- **Proxies**: Residential proxy with US geolocation by default (configurable via `PROXY_COUNTRY`)
- **Session Recording**: Every validation is recorded for debugging and audit

### Extraction

Uses Stagehand's `extract()` with a Zod schema to pull structured data from the profile page. This is faster and cheaper than using an agent — we just need to read data that's already on the page.

### Company Matching

Fuzzy matching with normalization:
- Strips common suffixes (Inc., LLC, Ltd., Corp., etc.)
- Case-insensitive comparison
- Substring matching (handles "Sample Organization" vs "Sample Organization Inc.")

## LinkedIn Considerations

- **Auth Wall**: Public profiles show limited data without login. The script detects auth walls and returns `error: "auth_wall"` rather than crashing.
- **Rate Limiting**: LinkedIn throttles after ~50-100 profile views in quick succession. Use the batch delay to stay under the radar.
- **Logged-In Sessions**: For full profile access, you can load a LinkedIn session via a Browserbase persistent context, selected with `--context` or `BROWSERBASE_CONTEXT_ID`.

## Customization

### Change the test profiles

Edit the `input` (single mode) or `sampleBatch` (batch mode) in the `main()` function.

### Adjust batch delay

In the `validateBatch` call, change the `delayMs` parameter:

```typescript
const results = await validateBatch(sampleBatch, 10000); // 10s between profiles
```

### Add more extraction fields

Extend the `LinkedInProfileSchema` Zod object to extract additional fields (e.g., education, connections count, about section).

## Next Steps

- **CSV input/output**: Read profiles from CSV, write results to CSV
- **Logged-in session support**: Load LinkedIn cookies for full profile access
- **Functions deployment**: Deploy as a Browserbase Function for API access
- **Parallel execution**: Run multiple browser sessions concurrently for higher throughput

---

**Built with Browserbase + Stagehand for Sample Organization GTM Engineering**

## Company matching limits

A positive `match` requires agreement between the displayed full name and requested person name, the final profile URL and requested profile URL, and the extracted company name and supplied company name. Names use Unicode NFC, case and whitespace normalization. This is evidence agreement, not independent confirmation of employment, real-world person identity or legal-entity identity. Punctuation, word boundaries and legal suffixes are preserved. Empty inputs, substring overlaps, different suffixes and unrecognized aliases return `match: null` and an inconclusive result. A blank expected name is rejected before browser allocation.

This example has no canonical company identifiers or approved alias registry. Resolve inconclusive results against a trusted identifier or an explicitly reviewed alias before making an employment decision; do not infer aliases from substring overlap. Run `npm test` for local synthetic comparator and actual validation-path regressions. They do not access profiles or launch browsers.

## Person and profile evidence

Results expose `person_name_match`, `profile_url_match`, `company_name_match` and `observed_profile_url` separately. Overall `match` stays `null` unless both identity checks agree. A different person at the expected employer, missing name, initials-only name or redirected profile cannot produce a positive record match. Missing expected identity is rejected before browser allocation.

Profile URLs must use HTTPS on `linkedin.com` or `www.linkedin.com` and identify one `/in/` profile. The comparison ignores query tracking, fragments and an optional trailing slash; it preserves the profile slug and rejects credentials, other hosts and encoded path separators. Unrecognized regional hosts or changed profile slugs remain inconclusive until reviewed. The final URL is read again after extraction.

`tests/person-identity.test.cjs` executes the actual validator with synthetic profile data and async URL reads, including a different final URL after extraction. Alongside the company comparator tests, these checks make no profile requests or browser sessions. A matching name and supplied URL still cannot distinguish fraudulent or outdated profile information.

## Selecting a persistent context

The follow-up command printed by `login-session.ts` is supported:

```bash
./node_modules/.bin/tsx linkedin-validator.ts --context YOUR_CONTEXT_ID
```

`--context=YOUR_CONTEXT_ID` also works. An explicit flag takes precedence over `BROWSERBASE_CONTEXT_ID`; without either, the validator uses no persistent context. It prints the selected context before validating profiles. Missing flag values, duplicate flags, unknown arguments and malformed identifiers fail before validation and exit nonzero. Context selection does not prove that its login is still valid; the existing auth-wall check can still return an inconclusive result.

`tests/context-cli.test.cjs` executes the actual `main()` with synthetic arguments and environment values and a stubbed validator. It checks context forwarding and early failure without creating or authenticating a browser context.
