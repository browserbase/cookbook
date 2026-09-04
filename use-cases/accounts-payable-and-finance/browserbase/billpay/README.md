# Bill Pay & Payment Automation

Demonstrates automated payment flows using Stagehand and Browserbase, including payment page payments and online food ordering checkout.

## Scripts

| Script | Description |
|--------|-------------|
| `payment_flow.ts` | Automates payment page payment — navigates to an invoice URL, finds the card payment accordion, and interacts with payment fields |
| `souvla_order_stagehand.ts` | End-to-end food ordering on Souvla — adds items, proceeds to checkout, and fills card details using Stagehand's `act()` API |
| `souvla_order_v2.ts` | Alternate Souvla ordering flow |
| `payment_flow.py` | Python implementation of payment flow automation |
| `payment_flow_stagehand.py` | Python Stagehand-based payment flow automation |
| `payment_flow_playwright.py` | Python Playwright-based payment flow automation |

## Setup

```bash
npm install
cp .env.example .env
# Fill in your API keys in .env
```

## Usage

```bash
npx tsx payment_flow.ts
```

## Key Patterns Demonstrated

- **Iframe handling**: The provider embeds payment fields in iframes — uses `iframes: true` with `observe()` and `act()`
- **Advanced stealth**: Configures `advancedStealth` and `blockAds` for checkout flows
- **Cross-language examples**: Same automation in both TypeScript (Stagehand) and Python (Playwright / Stagehand)
