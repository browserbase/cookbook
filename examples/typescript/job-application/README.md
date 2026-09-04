# Stagehand V4 + Browserbase: Automated Job Application Workflow

## AT A GLANCE

- Goal: Discover test job listings, fill applications, and verify the demo board's local confirmation. The demo does not send applications to a hiring service.
- Concurrent Processing: applies to multiple jobs in parallel with configurable concurrency limits based on Browserbase project settings.
- Dynamic Data Generation: generates unique agent IDs and email addresses for each application.
- File Upload Support: automatically uploads resume PDF from a remote URL during the application process.
- Docs → https://docs.stagehand.dev/v4/basics/act

## GLOSSARY

- act: perform UI actions from a prompt (click, type, fill forms)
  Docs → https://docs.stagehand.dev/v4/basics/act
- extract: extract structured data from web pages using natural language instructions
  Docs → https://docs.stagehand.dev/v4/basics/extract
- observe: analyze a page and return selectors or action plans before executing
  Docs → https://docs.stagehand.dev/v4/basics/observe
- semaphore: concurrency control mechanism to limit parallel job applications based on project limits

## QUICKSTART

Use pnpm **10.24.0**, as declared in `package.json`. Run these steps from the cookbook root.

1. `cd examples/typescript/job-application`
2. pnpm install
3. cp .env.example .env
4. Add your Browserbase API key and Project ID to .env (BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID)
5. pnpm start

## EXPECTED OUTPUT

- Fetches project concurrency limit from Browserbase (maxed at 5)
- Initializes main Stagehand session with Browserbase
- Navigates to agent job board
- Clicks "View Jobs" button
- Extracts all job listings with titles and URLs using structured schema
- Closes main session
- Creates semaphore for concurrency control
- Applies to all jobs in parallel (respecting concurrency limit)
- For each job application:
  - Generates unique agent ID and email
  - Navigates to job page
  - Fills agent identifier field
  - Fills contact endpoint (email) field
  - Fills deployment region field
  - Uploads resume PDF from remote URL
  - Selects multi-region deployment option
  - Checks every action result and reads back the generated fields, selected option, and uploaded PDF metadata
  - Clicks Deploy Agent and requires a new confirmation naming the current job
- Counts only confirmed demo attempts; any failed or unconfirmed attempt causes a nonzero exit
- Prints final success after both owned handles close, and releases the concurrency permit on initialization and workflow failures

## COMMON PITFALLS

- Dependency install errors: ensure pnpm install completed
- Missing credentials: verify .env contains BROWSERBASE_PROJECT_ID and BROWSERBASE_API_KEY
- Concurrency limits: script automatically respects Browserbase project concurrency (capped at 5)
- Resume URL: ensure the resume URL (https://agent-job-board.vercel.app/Agent%20Resume.pdf) is accessible
- Job detection: verify that job listings are visible on the page and match expected structure
- Network issues: check internet connection and website accessibility
- Find more information on your Browserbase dashboard -> https://www.browserbase.com/sign-in

## USE CASES

Use this test board to learn bounded concurrent sessions, file uploads, checked actions, and page-result verification. Adapting it to a real application requires authorized target-specific inputs and a server-backed receipt or equivalent confirmation.

## NEXT STEPS

• Add filtering: Implement job filtering by title keywords, location, or other criteria before applying.
• Error handling: Investigate unconfirmed attempts before retrying. A failed observation does not establish that a submit click had no effect.
• Resume customization: Support multiple resume versions or dynamic resume generation based on job requirements.
• Application tracking: Store application status, timestamps, and results in a database for tracking and follow-up.
• Rate limiting: Add delays between applications to avoid overwhelming the target system.
• Multi-site support: Extend to support multiple job boards with site-specific form field mappings.

## HELPFUL RESOURCES

📚 Stagehand Docs: https://docs.stagehand.dev/v4/first-steps/introduction
🎮 Browserbase: https://www.browserbase.com
💡 Try it out: https://www.browserbase.com/playground
🔧 Templates: https://www.browserbase.com/templates
📧 Need help? support@browserbase.com
💬 Discord: http://stagehand.dev/discord

## COMPLETION CHECKS AND LOCAL VERIFICATION

The runner permits only specific `/jobs/<number>` pages on the demo origin. A single observed upload control must exist, and the downloaded PDF must be at most 5 MiB. Before clicking Deploy Agent, the current URL, agent identifier, email, region, file metadata, and multi-region choice must match the current attempt. An already-visible confirmation is rejected.

After the click, up to 20 checks spaced 250 ms apart require the same URL, no visible form, exactly one visible `Deployment Request Submitted!` heading, and the confirmation paragraph naming the current job. The public demo implements this as client-side state after validation; the result proves local demo completion only.

Run `pnpm test` with Node.js 24 in this recipe directory. The 29 tests execute the actual TypeScript runner with real Zod validation and synthetic SDK/page responses. They cover failed actions, missing uploads, incorrect fields, absent confirmations, initialization/cleanup, concurrency validation, and aggregate success/failure counts. The identical Python/TypeScript DOM expression also passed eight synthetic cases in isolated local Chrome through the installed Stagehand 4.0.2 `Page.evaluate` normalization, with network requests blocked. Full package installation, model accuracy, and live Browserbase workflows remain unverified.
