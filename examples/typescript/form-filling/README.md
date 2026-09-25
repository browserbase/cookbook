# Stagehand + Browserbase: Form Filling Automation

## AT A GLANCE

- Goal: showcase how to automate form filling with Stagehand and Browserbase.
- Smart Form Automation: dynamically fill contact forms with variable-driven data.
- Observe → Act: discovers the live form controls once, then fills the observed actions with the matching values.
- Variable-driven actions: pair observed form controls with the supplied sample values.
  Docs → https://docs.browserbase.com/fundamentals/create-browser-session

## GLOSSARY

- observe / act: discover interactive elements, then execute the observed actions
  Docs → https://docs.stagehand.dev/v4/basics/observe

## QUICKSTART

1. cd form-filling
2. npm install
3. cp .env.example .env
4. Add your Browserbase API key to .env
5. npm start

## EXPECTED OUTPUT

- Initializes Stagehand session with Browserbase
- Navigates to contact form page
- Requires exactly one observed mapping and one DOM control for each of six fields
- Checks every fill and dropdown action result, then reads back all six values and the selected demo option
- Reports completion only after those checks and both handles close; never submits the form
- Closes both the Stagehand instance and browser handle after the workflow
- Missing, ambiguous, failed, or unconfirmed fields cause a nonzero exit

## COMMON PITFALLS

- "Cannot find module": ensure all dependencies are installed
- Missing credentials: verify .env contains all required API keys
- Field mismatch: adjust the semantic field descriptions if the contact form changes
- Network issues: check internet connection and website accessibility

## USE CASES

• Lead & intake automation: Auto-fill contact/quote/request forms from CRM or CSV to speed up inbound/outbound workflows.
• QA & regression testing: Validate form fields, required rules, and error states across releases/environments.
• Bulk registrations & surveys: Programmatically complete repeatable sign-ups or survey passes for pilots and internal ops.

## NEXT STEPS

• Wire in data sources: Load variables from CSV/JSON/CRM and add per-site field mappings.
• Submit & verify: If you adapt this to submit, add explicit authorization and an application-specific confirmation check before reporting submission. The sample only fills the form.
• Handle complex widgets: Add file uploads, multi-step flows, dropdown/radio/datepickers, and basic anti-bot tactics (delays/proxies).

## HELPFUL RESOURCES

📚 Stagehand Docs: https://docs.stagehand.dev/v4/first-steps/introduction
🎮 Browserbase: https://www.browserbase.com
💡 Try it out: https://www.browserbase.com/playground
🔧 Templates: https://www.browserbase.com/templates
📧 Need help? support@browserbase.com
💬 Discord: http://stagehand.dev/discord

## LOCAL VERIFICATION

Run `npm test` from this recipe directory with Node.js 24. The actual runner executes against synthetic Stagehand and page boundaries; the fixtures cover missing or ambiguous mappings, unsuccessful actions, values that did not persist, an unconfirmed dropdown, and initialization or cleanup failures. The positive fixture confirms all six values without calling submit. No live contact form, model, or Browserbase session is exercised.

The selected help control must expose `demo`, `book a demo`, `request a demo`, or `schedule a demo` as its value or displayed text. Update this explicit check if the target changes. A successful model action alone does not prove the form contents.
