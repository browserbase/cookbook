# Stagehand & Mastra Integration

A powerful integration that combines [Browserbase Stagehand](https://stagehand.dev) with [Mastra](https://mastra.ai/) for browser automation, scraping, and AI-powered web interactions.

## Overview

This project enables AI agents to interact with web pages through the Mastra framework using Stagehand's browser automation capabilities. It provides tools for web navigation, element observation, data extraction, and action execution, all orchestrated through Mastra's agent system.

## Features

- **Web Navigation**: Navigate to websites programmatically
- **Element Observation**: Identify and locate elements on web pages
- **Action Execution**: Perform actions like clicking buttons or filling forms
- **Data Extraction**: Extract structured data from web pages
- **Session Management**: A separate browser for each agent run, shared across that run’s tools and closed when the run finishes
- **AI-Powered Interactions**: Leverage OpenAI models for intelligent web interactions

## Installation

### Prerequisites

- Node.js 24.19.0 (run `nvm install && nvm use` here; see `.nvmrc`)
- npm or yarn
- Browserbase account 
- OpenAI API access

### Setup

1. Clone the repository:
   ```
   npx degit browserbase/integrations/examples/integrations/mastra browserbase-mastra
   cd browserbase-mastra
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with your API keys:
   ```
   BROWSERBASE_API_KEY=your_api_key
   OPENAI_API_KEY=your_openai_key
   ```

## Usage

### Running the development server

```
npm run dev
```

This will start the Mastra development server, giving you access to the integrated web agent.

## Architecture

### Core Components

1. **Browser ownership**
   - The registered agent gives every `generate` and `stream` invocation a fresh request context and browser owner.
   - Tools in one run reuse its browser. Each navigation and operation completes before the next queued tool starts.
   - Independent runs use separate browsers, even when callers reuse their input request context.
   - Completion, error, and abort callbacks close the owner. Returning a streaming response keeps it open until a terminal callback.
   - Direct tool calls require an owner registered by server code. They cannot choose an owner through tool arguments.

2. **Mastra Tools**
   - `stagehandActTool`: Performs actions on web pages
   - `stagehandObserveTool`: Identifies elements on web pages
   - `stagehandExtractTool`: Extracts data from web pages
   - `stagehandNavigateTool` : Navigates to given URLs

3. **Web Agent**
   - AI-powered agent using OpenAI's GPT-4o
   - Provides natural language interface to web automation
   - Integrates all tools into a unified experience

### Flow Diagram

```
User Query → Mastra Agent → Stagehand Tools → Browser Interaction → Web Page → Data/Results → Agent Response
```

## Configuration

The project can be configured through the `.env` file and by modifying the agent instructions in `src/mastra/agents/index.ts`.

## Credits

This project is built with:
- [Mastra](https://mastra.ai) - AI Agent framework
- [Stagehand by Browserbase](https://stagehand.dev) - Browser automation
- [OpenAI](https://openai.com/) - AI models
## Local lifecycle checks

Run `node --test tests/browser-owner.test.cjs` with the Node 24.19.0 version pinned in `.nvmrc`. The tests use synthetic browsers and agent callbacks. They cover ownership isolation, queue recovery, cleanup, and the registered agent wrapper. They do not call Browserbase or a model and do not prove a live Studio session works.

Browser state lasts for one agent run. A later conversation turn starts a new browser; this example does not persist authenticated sessions between runs.

After `npm ci --ignore-scripts`, run `npm run typecheck` and `node --import tsx --test tests/framework-lifecycle.test.mjs`. The framework test uses the real registered Mastra agent and tools with synthetic model and browser implementations. It checks overlapping generation calls, streaming completion, provider errors, cancellation, and a throwing completion callback without contacting model providers or Browserbase. Expected synthetic failures may print error logs while the test passes.
