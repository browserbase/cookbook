# Authenticated PG&E Bill Intake with Browserbase + Box AI

This example uses a Browserbase Context to save a real PG&E login, lets a
Browserbase managed Agent download the latest utility bill, and uploads the PDF
to Box for AI Q&A and structured metadata extraction.

This authenticated workflow processes private billing data. Its output validator limits fields and formats; it does not anonymize a real bill. Use synthetic documents and synthetic responses for public presentations.

## Flow

1. `pnpm setup-context` creates a Browserbase Context and a private login
   session with session recording and logging disabled.
2. You open Live View privately and authenticate to PG&E, including any MFA.
3. The setup script closes the session and saves its cookies and browser storage
   to the Context.
4. The managed Agent reuses that Context, opens Billing & Payment History, and
   downloads the latest bill using **View Bill PDF**.
5. The application independently waits for the newest PDF in the Agent session
   through the Browserbase Downloads API. It does not rely on the Agent to know
   the filename or confirm that the download completed.
6. The application uploads the PDF to a private Box folder.
7. Box AI answers a narrowly scoped billing question and extracts an allowlist
   of billing metadata.
8. The Q&A answer is stored privately in Box metadata. The terminal prints only
   its completion and the requested billing fields after validation. Unknown response keys, confidence data, and citations are discarded; malformed known values fail the run.

## Setup

```bash
cd integrations/examples/integrations/box/agent
pnpm install --ignore-workspace
cp .env.example .env
```

Fill in the Browserbase and Box credentials, then create and authenticate a
reusable Context:

```bash
pnpm setup-context
```

Open the Live View URL printed in the terminal, navigate to the displayed PG&E
portal, and log in. Once the account dashboard is accessible, return to the
terminal and press Enter. Copy the printed ID into `.env` as
`BROWSERBASE_CONTEXT_ID`.

Create the reusable managed Agent:

```bash
pnpm create-agent
```

Copy the printed ID into `.env` as `BROWSERBASE_AGENT_ID`, then run the complete
workflow:

```bash
pnpm start
```

The terminal shows Agent status, confirms that Box AI Q&A completed, and prints
these allowlisted fields when present:

- Statement date and billing period
- Due date and amount due
- Previous balance and payments received
- Electricity and gas charges
- Electricity and gas usage
- Rate plan

The bill, Q&A answer, session ID, and Box file ID remain private.

## Private data handling

- Use synthetic documents and responses for public demonstrations. Keep this real-account workflow private.
- Do not open the PG&E page, Agent Session Inspector, Box file, or PDF while
  screen sharing.
- The login session disables Browserbase recording and logging. Managed Agent
  sessions may still be inspectable by authorized Browserbase project members,
  so do not share the Agent session from the Dashboard.
- Extraction returns only validated requested billing values; extra response fields and confidence data are not returned. Q&A text remains private Box metadata and is not printed.
- Keep the Box destination folder private and restrict it to the demo operators.
- If PG&E redirects the Agent to login, run `pnpm setup-context` again and
  replace `BROWSERBASE_CONTEXT_ID`.
- Do not run simultaneous sessions using the same Context.

## Output validation

Dates use `YYYY-MM-DD` with calendar validation. Billing periods use `YYYY-MM-DD to YYYY-MM-DD` in chronological order. Money fields accept a decimal amount without grouping commas, optionally prefixed with `USD ` or `$`. Electricity usage uses a number followed by `kWh`; gas usage uses a number followed by `therm` or `therms`. Rate plans use a short uppercase tariff code containing letters, digits, or hyphens.

Absent, null, and empty values are omitted. Unsupported formats fail with a generic error rather than printing the rejected content. Only requested keys from `DOCUMENT_FIELDS` can be returned. These checks constrain shape, not the truth or sensitivity of the values; even dates, amounts, and tariff codes from a real bill remain private.

`pnpm test` runs synthetic response and complete-caller tests, including unexpected identifying fields and provider error bodies. No real Box, Browserbase, PG&E, or document requests are made by those tests.

## Download verification

The managed Agent only clicks **View Bill PDF**. After the run finishes, the
application polls the Browserbase Downloads API for up to 60 seconds and selects
the newest PDF from that run's session. This avoids false failures when the
browser completed the download but the Agent could not observe its filename or
filesystem state.

## Environment variables

| Variable                 | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `BROWSERBASE_API_KEY`    | Browserbase API key                                |
| `BROWSERBASE_CONTEXT_ID` | Authenticated Context from `pnpm setup-context`    |
| `BROWSERBASE_AGENT_ID`   | Managed Agent ID from `pnpm create-agent`          |
| `PGE_PORTAL_URL`         | PG&E account portal                                |
| `BOX_CLIENT_ID`          | Box Server App client ID                           |
| `BOX_CLIENT_SECRET`      | Box Server App client secret                       |
| `BOX_ENTERPRISE_ID`      | Enterprise that owns the app's service account     |
| `BOX_FOLDER_ID`          | Private destination folder for the service account |

## Documentation

- [PG&E: View past bills](https://www.pge.com/en/account/billing-and-assistance/view-past-bills.html)
- [Browserbase Contexts](https://docs.browserbase.com/platform/browser/core-features/contexts)
- [Browserbase session recording](https://docs.browserbase.com/platform/browser/observability/session-recording)
- [Integrating managed Agents](https://docs.browserbase.com/platform/agents/integrate-api-sdk)
- [Managing Agent files](https://docs.browserbase.com/platform/agents/managing-files)
- [Browserbase Downloads API](https://docs.browserbase.com/platform/browser/files/downloads)
- [Box AI structured extraction](https://developer.box.com/reference/post-ai-extract-structured)
