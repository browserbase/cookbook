# ERP platform ad hoc payment form

Fill a ERP platform ad hoc payment using Playwright: company, bank account, payee, amounts, accounting fields, and an attachment. The final interaction clicks **Submit**. Run against an account and payment you are authorized to submit; this is not a draft-only script.

The example uses `page.keyboard.press('Enter')` to confirm company/payee inputs and explicitly clicks the Lines tab before filling its fields. Selectors remain specific to the source ERP platform layout and need review for a different tenant.

## Setup

```bash
npm install
npm run typecheck
cp .env.example .env
```

Fill the blank environment template:

| Variable | Purpose |
|---|---|
| `BROWSERBASE_API_KEY` | Create the browser session |
| `ERP_USERNAME`, `ERP_PASSWORD` | Login credentials |
| `ERP_LOGIN_URL` | Authorized tenant's HTTPS login URL |
| `ERP_PAYMENT_URL` | HTTPS ad hoc payment page after login |
| `PAYMENT_DATA_PATH` | Path to a local JSON payment record |

Copy [payment-data.example.json](payment-data.example.json) to a secure location outside this repository and replace every synthetic field with reviewed inputs. Use the exact visible bank, payee and accounting labels. `lineOfBusiness` is the search text and `lineOfBusinessOption` is the full option label. Set `attachment` to a reviewed local file. Text validation and file readability do not establish payment correctness or authority.

No proxy password or persisted context ID is embedded in the entrypoint. The session uses the configured Browserbase project and its default connection settings. Adapt proxy/context configuration explicitly if your authorized environment needs it.

## Run

```bash
npm start
```

The script reads configuration, checks required payment fields and attachment readability, creates a browser session, logs in, fills the form, and clicks Submit. It then closes the connection and requests session release. A successful click does not establish that ERP platform accepted, approved or paid the transaction. Inspect the resulting account status before retrying an uncertain run; the script does not provide idempotency or independently validate a receipt.

## Local verification

With Node 24, installed recipe dependencies and local Chrome:

```bash
npm test
```

On macOS the test defaults to `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; set `CHROME_PATH` for another installation. The test creates a synthetic form in a local headless browser, aborts network requests, and exercises the real `fillPayment` function. It verifies company/payee Enter events, the Lines click, accounting values, file attachment and the synthetic Submit event. Fixed sleeps are skipped in the fixture; remote loading behavior is not tested.

The local browser tests and isolated SDK type check pass. They do not load `.env`, contact ERP platform or Browserbase, validate login, or submit a real payment. Dependency installation and live tenant compatibility remain separate verification steps.
