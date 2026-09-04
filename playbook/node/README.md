# Browserbase Node Playbook

This repository contains a collection of browser automation scripts and tools using various frameworks including Stagehand, Playwright, and Puppeteer.

## Project Structure
```
playbook/node/
├── stagehand/
│ ├── _tools/ 
│ ├── research/ 
│ ├── complete_task/ 
│ └── authenticate/ 
├── playwright/ 
│ ├── _tools/ 
│ ├── research/ 
│ ├── complete_task/ 
│ └── authenticate/ 
└── useful_browserbase_functions.ts # Shared utility
```

## Prerequisites

- Node.js (Latest LTS version recommended)
- npm (comes with Node.js)
- [Browserbase API Key / Project ID](https://www.browserbase.com/sign-up)

## Installation

1. Clone the repository
2. Navigate to the project directory:
   ```bash
   cd playbook/node
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## Dependencies

The project uses several key dependencies:

- `@browserbasehq/stagehand` - For browser automation with Stagehand
- `@playwright-core` - For Playwright-based automation
- `zod` - For runtime type checking
- `dotenv` - For environment variable management
- `chalk` - For terminal styling
- `boxen` - For terminal box drawing

## Environment Setup

1. Create a `.env` file in the root directory
2. Add your Browserbase credentials:
   ```
    BROWSERBASE_PROJECT_ID=
    BROWSERBASE_API_KEY=
   ```

## Usage Examples

### Running Scripts

```bash
npx tsx script.ts
```

## Support

For issues and feedback, please create reach out to support@browserbase.com

## Cloud download polling

From `playbook/node`, run `npx tsx playwright/_tools/download/cloud-download-save.ts` after configuring the two Browserbase environment variables. The retrieval helper takes a timeout in milliseconds; this example uses 20,000 ms. It polls immediately, then waits two seconds after an empty response or an archive with no files. Requests never overlap.

The deadline rejects and aborts pending retrieval. HTTP failures and malformed or CRC-corrupt ZIPs fail the command with a nonzero exit status. A valid ZIP containing at least one file is saved as `downloads.zip` in the working directory. Exclusive creation preserves any existing file; use a fresh output directory or deliberately move your previous download before running again. Late responses cannot write after timeout. Files are not extracted, and the helper does not prove that an archive contains every expected download or impose an archive size limit. A failed filesystem write may leave a partial new file.

Run `node --test tests/cloud-download.test.mjs` after installing dependencies to exercise actual polling and CLI logic with synthetic responses, timers and temporary files plus the real JSZip parser. These local checks do not execute the Browserbase session or remote download flow.

## Contact form inputs

`stagehand/complete_task/contactForm.ts` requires `CONTACT_NAME`, `CONTACT_EMAIL`, `CONTACT_PHONE`, and `CONTACT_MESSAGE` in the process environment. Values must be nonblank and the email must pass format validation. Set these explicitly before running `npx tsx stagehand/complete_task/contactForm.ts` from `playbook/node`; the script does not load an `.env` file itself.

The script binds placeholders using Stagehand's variables option and asks it to prepare the form without submitting. It rejects unsuccessful actions and closes both owned handles. The final message reports Stagehand's action result, not independently verified field contents or a delivered message. The browser closes at the end; this is not a persistent draft or manual handoff. Input values are sent to the browser automation service, so use synthetic contact details for local development.

Run `node --test tests/contact-form.test.mjs` after dependency installation for synthetic input-binding, failure and cleanup checks. These do not contact the site or prove model accuracy.

## Explicit job application inputs

`stagehand/complete_task/jobAppExplicit.ts` requires `JOB_URL`, `JOB_FIRST_NAME`, `JOB_LAST_NAME`, `JOB_EMAIL`, `JOB_HEADLINE`, `JOB_PHONE`, `JOB_ADDRESS`, `JOB_RESUME_PATH`, and `JOB_SALARY_EXPECTATIONS` in the process environment. Set these before running `npx tsx stagehand/complete_task/jobAppExplicit.ts` from `playbook/node`; this script does not load `.env` itself. Use an HTTP(S) application URL compatible with the example's Apply now and named-field flow. Salary expectations should include the currency and pay period you intend.

The resume path is relative to the current working directory or absolute. Before opening a browser, the script checks that the file is regular, nonempty, at most 5 MiB and begins with a PDF header. This is a format preflight, not a complete PDF parser. It sends the selected bytes through `setInputFiles`, requires exactly one file input, and reads its file name, size and MIME type back from the DOM before proceeding. Multiple upload fields require an explicit selector adaptation. Uploading may transmit the document to the application service before final submission. Use synthetic profiles and resumes for development.

Every model action binds the supplied values and requires a successful result. The example no longer supplies a guessed yes answer. Additional questions require human review; this flow does not establish that an application is complete. It requests no final submission and closes the browser after preparation. It does not retain a browser draft or provide a manual handoff.

Run `node --test tests/job-explicit.test.mjs` for synthetic input/action/failure checks with real temporary-file reads. To include the isolated local browser upload check, set `COOKBOOK_CHROME` to your Chrome executable. That check intercepts all browser requests with a synthetic form and replaces Stagehand actions with fixtures; it verifies file upload and the actual DOM metadata reader, not a real job application or model behavior.

## SF citation review and payment handoff

`stagehand/complete_task/sfTicketAgent.ts` requires `SF_PLATE` and an interactive terminal. Supply your own plate using letters, digits, spaces or hyphens, up to ten characters. This is an input-format check, not a plate ownership or registration check. The script loads dotenv configuration and uses the existing Browserbase credentials. Run it from `playbook/node` with `npx tsx stagehand/complete_task/sfTicketAgent.ts`.

Only citation lookup is automated. A successful Stagehand lookup action opens a handoff using the owned session's [Session Inspector](https://docs.browserbase.com/welcome/getting-started). Open that link while the script waits and use [Live View](https://docs.browserbase.com/platform/browser/observability/session-live-view) to check the plate, citations, amounts and any intended payment yourself. The script does not select all tickets, fill payment fields or click a final payment button. It does not read card details from environment variables or send them through model instructions or variable maps. Any manual information still goes through the browser session and destination website; this is not a guarantee about their logging or recording.

Press Enter in the terminal when you want to close the session. Enter means only that the handoff should end. It does not establish whether you paid, cancelled or completed a workflow. The script waits at most five minutes, then fails and closes the owned handles. EOF, interruption and input errors also fail with cleanup. No model operations run after the handoff starts.

Run `node --test tests/ticket-handoff.test.mjs` for actual readline lifecycle tests with synthetic streams, timer control and mocked browser/Stagehand boundaries. These checks do not execute a plate lookup, interact with the live payment site or verify a payment.

## Workday account verification

Before running `npx tsx stagehand/complete_task/workday.ts` from `playbook/node`, configure `WORKDAY_LOGIN_URL`, `WORKDAY_AUTHENTICATED_URL`, `WORKDAY_ACCOUNT_SELECTOR`, and `WORKDAY_USERNAME`. Without `BROWSERBASE_CONTEXT_ID`, also configure `WORKDAY_PASSWORD`. Dotenv configuration is loaded. Both URLs must be HTTP(S), share an origin and have distinct paths; the protected destination cannot be a login route. No tenant URL is supplied by default.

Choose a protected account destination and a selector for the visible signed-in account identity. Its trimmed text must exactly equal `WORKDAY_USERNAME`, and exactly one element must match. Use an account identity label rather than unrelated page text or a login input. The script requires a successful HTTP response at the exact configured URL, waits up to 30 seconds for the label and verifies its visibility and text. A saved context still undergoes the same account check. The configured destination and selector determine what this check proves; the cookbook has not verified a real tenant's identity UI.

Native-login XPath selectors come from the original example and need adapting to your tenant's layout. Username and password are entered through locator controls rather than model instructions. Both click results must succeed. This does not bypass MFA or other challenges. Failures in actions, account checks or cleanup return a nonzero exit status; both owned handles are independently closed.

Run `node --test tests/workday-outcome.test.mjs` for synthetic command and cleanup checks. Set `COOKBOOK_CHROME` to a Chrome executable to include isolated browser fixtures for matching, mismatched and delayed account labels. All browser requests in those fixtures are intercepted; no actual Workday authentication or credential transfer is tested.

## Polymarket research results

`stagehand/research/polymarket.ts` requires `POLYMARKET_QUERY`, `POLYMARKET_MARKET_TITLE`, and `POLYMARKET_MARKET_URL` in the process environment. Supply an exact HTTPS Polymarket event URL and expected market title. Run `npx tsx stagehand/research/polymarket.ts` from `playbook/node` after setting the inputs and provider credentials. The script does not load dotenv itself.

Search, query entry and result selection must each return a successful action. Selection uses the expected title and destination together, and the landed URL must match before and after extraction. Required title/status and nullable displayed quote fields replace the previous all-optional schema. Empty output, a mismatched title or absence of every odds/price value fails. A successful result retains extracted data, source URL and observation time. These are model-extracted display values, not verified executable prices; closed, resolved and unknown status must not be interpreted as an open market. The script never places trades.

The [original example market](https://polymarket.com/event/will-elon-musk-unfollow-donald-trump-before-july) ended in June 2025 and shows a final outcome. It is not a default source of current odds. Similar titles can identify different markets, so choose the URL deliberately.

Run `node --test tests/polymarket-outcome.test.mjs` to check actual command logic with real Zod validation and synthetic browser/model responses. These checks do not execute live search or independently validate quote accuracy.

## Retrieve one file from a session archive

Set `BROWSERBASE_SESSION_ID` and `BROWSERBASE_API_KEY`, then run `npx tsx playwright/_tools/download/cloud-download-retrieve.ts` from `playbook/node`. The script retrieves that session's downloads with a 30-second request timeout and validates the HTTP response and ZIP CRCs. It fails for empty archives or archives containing no regular files.

The example saves only the first regular file reported by JSZip, skipping directory and symlink entries. Nested archive paths are flattened to their basename under `downloads/files`; the destination directories are created when absent. Unsafe paths and preexisting symlink destinations are rejected. Exclusive creation preserves an existing output file. This is a single-file example, not complete archive extraction. It does not wait for downloads to finish; use the cloud download save recipe for completion and readiness polling. It imposes no archive-size limit or protection against another process swapping directories during a write.

Run `node --test tests/zip-retrieval.test.mjs` for real ZIP parsing and temporary-filesystem checks with synthetic responses.

## Local screenshot output

`npx tsx playwright/_tools/download/local-screenshot.ts` creates `downloads/files` and writes explicitly encoded JPEG bytes to `downloads/files/screenshot.jpeg`. An existing screenshot at that path is replaced. Navigation and screenshot capture each have a 30-second timeout; page and browser closure are attempted independently. A failed capture, write or cleanup produces a nonzero exit status.

Run `node --test tests/screenshot-output.test.mjs`. Set `COOKBOOK_CHROME` to your Chrome executable to include a real browser JPEG check with all network requests replaced by a synthetic page. These local tests do not create Browserbase sessions.
