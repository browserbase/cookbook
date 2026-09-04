# Stagehand + Browserbase: AI-Powered Court Booking Automation

Stagehand is the SDK for browser agents.

## AT A GLANCE

- Goal: automate tennis and pickleball court bookings in San Francisco Recreation & Parks system.
- AI Integration: Stagehand for UI interaction and data extraction.
- Browser Automation: automates login, filtering, court selection, and booking confirmation.
- User Interaction: prompts for activity type, date, and time preferences with validation.
  Docs → https://docs.browserbase.com/fundamentals/create-browser-session

## GLOSSARY

- act: perform UI actions from a prompt (click, type, select)
  Docs → https://docs.stagehand.dev/v4/basics/act
- extract: pull structured data from pages using schemas
  Docs → https://docs.stagehand.dev/v4/basics/extract
- observe: plan actions and get selectors before executing
  Docs → https://docs.stagehand.dev/v4/basics/observe
- browser automation: automated interaction with web applications for booking systems
  Docs → https://docs.browserbase.com/fundamentals/create-browser-session
- form validation: ensure user input meets booking system requirements

## QUICKSTART

From the cookbook root, enter this recipe and install its declared dependencies:

```bash
cd examples/python/pickleball
uv sync --python 3.11
cp .env.example .env
```

`uv sync` creates this recipe's `.venv` and installs dependencies from
`pyproject.toml`. No activation or separate `pip` command is needed. Install
[uv](https://docs.astral.sh/uv/getting-started/installation/) first if it is unavailable.
Configure the required values in `.env` using `.env.example` as the reference.

You also need an account for the [SF Recreation & Parks booking site](https://www.rec.us/organizations/san-francisco-rec-park).

Run from this same recipe directory:

```bash
uv run python main.py
```

## EXPECTED OUTPUT

- Prompts user for activity type (Tennis/Pickleball), date, and time
- Automates login to SF Recreation & Parks booking system
- Filters courts by activity, date, and time preferences
- Extracts available court information and displays options
- Automates court booking with verification code handling
- Confirms successful booking with details

## COMMON PITFALLS

- "ModuleNotFoundError": run `uv sync --python 3.11` in this recipe directory
- Missing credentials: verify .env contains all required API keys and SF Rec Park login
- Login failures: check SF Rec Park credentials and account status
- Booking errors: verify court availability and booking system accessibility
- Verification codes: ensure you can receive SMS/email codes for booking confirmation
- Import errors: use `uv run python main.py` from this recipe directory

## FURTHER USE CASES

• Court Booking: Automate tennis and pickleball court reservations in San Francisco
• Recreation & ticketing: courts, parks, events, museum passes, campsite reservations
• Appointments & scheduling: DMV, healthcare visits, test centers, field service dispatch
• Permits & licensing: business licenses, parking permits, construction approvals, hunting/fishing tags
• Procurement portals: reserve inventory, request quotes, confirm orders
• Travel & logistics: dock door scheduling, freight pickups, crew shifts, equipment rentals
• Education & training: lab reservations, proctored exam slots, workshop sign-ups
• Internal admin portals: hardware checkout, conference-room overflow, cafeteria or shift scheduling

## NEXT STEPS

• Swap the target site: point the script at a different booking or reservation portal (e.g., gyms, coworking, campsites)
• Generalize filters: extend date/time/activity prompts to handle more categories or custom filters
• Automate recurring bookings: wrap the script in a scheduler (cron/queue) to secure slots automatically
• Add notifications: send booking confirmations to Slack, email, or SMS once a reservation succeeds
• Handle multi-user accounts: support multiple credentials so a team can share automation
• Export structured results: save court/slot data as JSON, CSV, or push to a database for reporting
• Integrate with APIs: connect confirmed reservations to a calendar system (Google Calendar, Outlook)
• Enhance verification flow: add support for automatically fetching OTP codes from email/SMS inboxes
• Improve resilience: add retries, backoff, and selector caching to handle UI changes gracefully
• Template it: strip out "pickleball" wording and reuse as a boilerplate for any authenticate → filter → extract → book workflow

## HELPFUL RESOURCES

📚 Stagehand Docs: https://docs.stagehand.dev/v4/first-steps/introduction
🎮 Browserbase: https://www.browserbase.com
💡 Try it out: https://www.browserbase.com/playground
🔧 Templates: https://www.browserbase.com/templates
📧 Need help? support@browserbase.com
💬 Discord: http://stagehand.dev/discord

## Date selection and verification

Dates use San Francisco's `America/Los_Angeles` calendar. The default is tomorrow there; an explicit `SELECTED_DATE` must be a valid `YYYY-MM-DD` date that is not in the past.

`calendar_selection.py` reads the public site's DayPicker `data-day` and `aria-selected` attributes. It navigates to the full requested month, clicks the unique enabled full-date cell, reopens the picker if it closed, and requires the selected date to match exactly. Missing, ambiguous, unavailable, stale, or unconfirmed dates fail. Navigation is bounded to 120 month transitions. The date is checked after other filters and again before the optional booking flow.

Run `python3 -B -m unittest discover -s tests -v`. Four synthetic suites exercise the actual selection helper with month/year changes, previous-month navigation, picker reopening, malformed dates, missing or ambiguous controls, wrong selected dates, and stuck navigation. The selectors were grounded in the public site's deployed calendar code, and the identical DOM expression plus TypeScript selection helper separately passed six local Chrome scenarios through the actual Stagehand 4.0.2 Page/Locator classes. Python SDK transport and authenticated bookings were not exercised. Other activity/time filters and final reservation confirmation have separate verification requirements.

After a navigation click, the helper waits for the visible month to change before another click. If it stays unchanged for 20 checks spaced 100 ms apart, selection fails.
