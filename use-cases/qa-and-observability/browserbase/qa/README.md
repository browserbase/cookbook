# a synthetic application - Stagehand QA Testing Demo

## The Problem with Static QA Scripts

Traditional E2E test scripts are **brittle by design**. They rely on:

- Hardcoded CSS selectors that break when designers refactor a class name
- XPath expressions that shatter when a `<div>` wrapper is added
- Exact text matching that fails when copy changes from "Submit" to "Submit Application"
- Fixed wait times that either slow down CI or cause flaky timeouts

When Synthetic App ships a new UI update, how many Playwright/Cypress tests break — not because of real bugs, but because selectors changed?

## The Stagehand Approach

Stagehand uses **natural language instructions** instead of brittle selectors. The AI understands the _intent_ of each test step and adapts automatically when the UI changes.

| Traditional Script | Stagehand |
|-|-|
| `page.locator('#login-btn-v2').click()` | `stagehand.act("click the login button")` |
| `page.locator('input[name="email"]').fill(...)` | `stagehand.act("fill the email field with %email%")` |
| `expect(page.locator('.price-tag')).toHaveText('$99')` | `stagehand.extract("extract the displayed price")` |
| Breaks when UI changes | Self-heals automatically |

## Demos Included

### 1. `qa-agent-demo.ts` — Agent-Based QA Testing
Demonstrates the **Stagehand Agent** running autonomous multi-step QA flows. The agent:
- Navigates a web app like a real user
- Tests form validation (empty fields, invalid inputs, edge cases)
- Verifies navigation flows work end-to-end
- Extracts and validates page content against expected values
- Reports structured test results with pass/fail status

### 2. `self-healing-demo.ts` — Self-Healing Tests
Shows how Stagehand tests **don't break** when the UI changes:
- Same test instructions work across UI redesigns
- No selector maintenance required
- Caching makes repeat runs instant (zero LLM calls)

### 3. `dynamic-form-validation.ts` — Dynamic Form Testing
Demonstrates intelligent form testing that:
- Discovers form fields automatically via `observe()`
- Tests each field with valid/invalid inputs
- Validates error messages and success states
- Works on any form without hardcoding field names

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Add your API keys to .env

# Run the agent QA demo
npx tsx qa-agent-demo.ts

# Run the self-healing demo
npx tsx self-healing-demo.ts

# Run the dynamic form validation demo
npx tsx dynamic-form-validation.ts
```

## Environment Variables

```
BROWSERBASE_API_KEY=     # From https://browserbase.com/overview
OPENAI_API_KEY=          # For LLM-powered test intelligence
```

## Why This Matters for Synthetic App

1. **Ship faster** — UI changes don't break your test suite
2. **Less maintenance** — No selector updates when the frontend evolves
3. **Better coverage** — Agent explores flows a human tester would, not just the happy path
4. **Real user simulation** — Tests behave like actual users, catching UX issues static scripts miss
5. **Structured validation** — Extract and assert on structured data, not fragile DOM queries
