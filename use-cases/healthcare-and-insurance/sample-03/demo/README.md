# Sample Organization Provider Search Demo

AI-powered healthcare provider search automation with human-in-the-loop interaction, featuring live session viewing through an embedded Browserbase iframe.

## Overview

This demo showcases how Sample Organization can leverage AI automation to streamline provider search workflows while maintaining human oversight. The automation navigates to Anthem's provider search, waits for human input, then completes the search and extracts provider information to display on the webpage.

## Features

- **AI-Powered Navigation**: Uses Stagehand AI to intelligently navigate healthcare portals
- **Human-in-the-Loop**: Pauses for human input, automatically detects when user completes the form
- **Live Debug View**: Embedded Browserbase live debug iframe for optimal viewing experience
- **Real-Time Updates**: Server-Sent Events (SSE) stream workflow status to the web interface
- **Provider Extraction**: Automatically extracts and displays the first 5 providers found
- **Sample Organization Branding**: Professional UI with Sample Organization's brand colors and styling
- **Error Handling**: Robust error handling with screenshots and detailed logging

## Workflow

1. Navigate to https://www.anthem.com/ca/find-care/
2. Click "Continue as a guest" button
3. **Wait for human** to input required fields on the next page
4. **Detect** "Search by Care Provider" title appears (automation resumes automatically)
5. Input location as 94109
6. Click Continue button
7. Click the first care provider type listed
8. Extract the first 5 doctors and their information
9. Display extracted doctors on the webpage

## Prerequisites

- **Node.js** 22 or higher
- **Browserbase Account** with API credentials
- **Google Gemini API Key** (for AI-powered automation)
- **npm** or **pnpm** package manager

## Installation

1. **Navigate to the sample_org directory**:
   ```bash
   cd healthcare-and-insurance/sample-03/demo
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` file with your credentials**:
   ```bash
   # Browserbase Configuration
   BROWSERBASE_API_KEY=your_browserbase_api_key_here
   BROWSERBASE_PROJECT_ID=your_browserbase_project_id_here

   # AI Model Configuration
   # This demo uses Gemini (gemini-2.0-flash-exp)
   GEMINI_API_KEY=your_gemini_api_key_here

   # Server Configuration
   PORT=3000
   ```

## Usage

### Running the Demo

1. **Start the server**:
   ```bash
   npm run dev
   ```

2. **Open your browser**:
   Navigate to `http://localhost:3000`

3. **Start the automation**:
   - Click the "Start Automation" button
   - Watch the automation navigate to Anthem and click "Continue as guest"
   - The automation will pause and wait for you

4. **Fill in the form**:
   - In the live session iframe, fill out the provider search criteria
   - Continue through the form until you reach the "Search by Care Provider" page
   - The automation will automatically detect this and resume

5. **View results**:
   - The automation completes the search
   - First 5 doctors are extracted and displayed in the control panel
   - Results include name, specialty, location, phone, and address

### Demo Script for Presentations

**Introduction (30 seconds)**:
> "Today I'll show you how Sample Organization can automate provider search workflows with human oversight. This demo combines AI automation with live session viewing and automatic human input detection."

**Starting the Demo (1 minute)**:
> "Let me click 'Start Automation'. You can see the Browserbase session starting in the iframe on the left. The automation navigates to Anthem's provider search and clicks 'Continue as guest' for us."

**Human Input Phase (2 minutes)**:
> "Now the automation has paused. I'll fill in the search criteria - let me enter some information about what kind of provider we're looking for. Notice how the automation is watching and waiting for me to reach the search page."

**Automation Resumes (1-2 minutes)**:
> "As soon as I reach the 'Search by Care Provider' page, the automation detects this automatically and continues. Watch as it enters the location, clicks continue, selects the first provider type, and begins extracting results."

**Completion (30 seconds)**:
> "The automation has extracted the first 5 providers and displays them here in the control panel. We can see their names, specialties, locations, and contact information. The entire workflow balanced automation efficiency with human decision-making."

## Configuration

### AI Model

This demo uses **Google Gemini** (`google/gemini-2.0-flash-exp`) for AI-powered browser automation. The model is configured in [src/config.ts](src/config.ts) and requires a `GEMINI_API_KEY` environment variable.

### Adjusting Timeouts

Modify timeout values in `src/config.ts`:

- `humanInputTimeout`: How long to wait for human input (default: 5 minutes)
- `pageLoadTimeout`: Maximum time for page loads (default: 30 seconds)
- `actionTimeout`: Timeout for individual actions (default: 10 seconds)

## Project Structure

```
sample_org/
├── package.json                 # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── .env.example                # Environment variable template
├── .gitignore                  # Git ignore patterns
├── README.md                   # This file
│
├── src/
│   ├── server.ts              # Express server with SSE
│   ├── automation.ts          # Stagehand automation workflow
│   ├── config.ts              # Shared configuration
│   └── types.ts               # TypeScript types & Zod schemas
│
└── public/
    └── index.html             # Single-file web interface
```

## API Endpoints

### POST /api/start
Starts a new automation workflow.

**Response**:
```json
{
  "success": true,
  "message": "Automation started successfully"
}
```

### GET /api/status
Server-Sent Events stream for real-time workflow updates.

**Event Format**:
```json
{
  "sessionId": "abc123...",
  "sessionUrl": "https://browserbase.com/sessions/abc123...",
  "stage": "entering_location",
  "message": "Entering location: 94109",
  "timestamp": "2025-01-21T10:30:00.000Z",
  "approvalRequired": false,
  "approved": false
}
```

### GET /api/health
Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "isRunning": false,
  "timestamp": "2025-01-21T10:30:00.000Z"
}
```

## Workflow Stages

The automation progresses through these stages:

1. **idle**: Initial state, waiting to start
2. **initializing**: Creating Browserbase session
3. **navigating**: Loading Anthem find-care page
4. **clicking_guest**: Clicking "Continue as guest"
5. **awaiting_human_input**: ⏸️ Waiting for human to fill form
6. **waiting_for_search_page**: Detected "Search by Care Provider" page
7. **entering_location**: Entering zip code 94109
8. **clicking_continue**: Clicking continue button
9. **selecting_provider_type**: Selecting first provider category
10. **extracting_doctors**: Extracting provider information
11. **completed**: ✓ Workflow finished successfully
12. **error**: ✗ An error occurred

## Troubleshooting

### Server won't start
- Verify all environment variables are set in `.env`
- Check that port 3000 is available
- Run `npm install` to ensure dependencies are installed

### Automation fails immediately
- Check Browserbase API credentials
- Verify AI model API key is correct
- Check console logs for detailed error messages

### Automation doesn't resume after human input
- Ensure you reach a page with "Search by Care Provider" title
- Check that the text appears exactly as expected
- Look for errors in the browser console

### No doctors extracted
- Verify the provider search returned results
- Check Browserbase session replay to see the results page
- The extraction may need adjustment if Anthem's UI changed

## Technical Details

### Technologies Used
- **Stagehand**: AI-powered browser automation (v2.5+)
- **Browserbase**: Cloud browser infrastructure with live debug view
- **Express.js**: Web server framework
- **TypeScript**: Type-safe JavaScript
- **Zod**: Schema validation
- **Server-Sent Events**: Real-time status updates
- **Vanilla JavaScript**: No frontend framework needed

### Browser Settings
The Browserbase session uses:
- `keepAlive: true` - Keeps session alive during human input wait
- `verbose: 2` - Detailed logging for debugging
- Live debug view (`debuggerFullscreenUrl`) - Optimized for iframe embedding

### Human-in-the-Loop Pattern
This demo uses automatic detection instead of explicit approval:
1. Automation clicks "Continue as guest"
2. Automation pauses and polls for "Search by Care Provider" text on page
3. When detected, automation knows human completed the form
4. Automation continues automatically - no button click needed

This pattern is ideal for workflows where the completion state is deterministic (a specific page title or element appears).

## Security Considerations

- **Environment Variables**: Never commit `.env` file to version control
- **API Keys**: Keep all API keys secure and rotate regularly
- **Session Data**: Browserbase sessions may contain sensitive information
- **HTTPS**: Use HTTPS in production deployments

## Support

For issues or questions:
- Check the troubleshooting section above
- Review Browserbase documentation: https://docs.browserbase.com
- Review Stagehand documentation: https://docs.stagehand.dev

## License

MIT License

---

**Built for Sample Organization by the Browserbase team**

## Production build

```bash
npm run build
npm start
```

The build cleans this package's `dist/`, compiles TypeScript into `dist/src/`, and copies the public interface to `dist/public/index.html`. The start command runs `dist/src/server.js`. Relative source imports retain their `.js` extensions so emitted files resolve under Node ESM. No runtime datasets are required by the server, and none are copied. Static copying uses an explicit file list; `public/index.html.backup` is excluded. Add any new required static assets to `scripts/build.mjs` deliberately.

Deploy `dist/` alongside this package's `package.json` and production dependencies. Provide the required environment variables in the process environment; `.env` is not included in the artifact. The page and health endpoint can be served without starting a browser, but startup still checks that the configured key variables are present. A local HTTP check verifies packaging only; it does not verify credentials or the provider-search workflow.

Local packaging verification used Node 24 and the declared dependency versions from existing isolated runtimes. A clean build and a second build with a stale output file both passed. A separate production-only artifact served `/`, `/index.html`, and `/api/health` successfully with synthetic configuration; the backup HTML and source TypeScript paths returned 404. This did not exercise a fresh dependency installation, Browserbase, Gemini, or the external healthcare site.
