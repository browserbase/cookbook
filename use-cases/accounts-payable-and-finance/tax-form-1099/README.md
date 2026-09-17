# 1099-MISC field extraction

Extract a structured inventory of fields from 1099-MISC documentation with Stagehand and Zod.

## Setup

```sh
npm install
export BROWSERBASE_API_KEY="<set-locally>"
export ANTHROPIC_API_KEY="<set-locally>"
npm start
```

## Behavior

`index.ts` opens the configured documentation target, locates the 1099-MISC field reference, extracts payer, recipient, income, state, and miscellaneous fields, then prints the validated JSON and a compact summary.

The current target URL and navigation instructions are placeholders. Replace them with documentation you are authorized to access before running the workflow. It reads documentation and does not prepare, submit, or modify a tax filing.
