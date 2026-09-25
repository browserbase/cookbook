# Simple Search Agent with AgentKit and Stagehand

This Web Search Agent uses [Stagehand](https://www.stagehand.dev/) as AgentKit tools to navigate the web autonomously.
For any question, the network with combine reasoning and web search to answer the question.

## Overview

### Tools

The Web Search Agent provides four main tools:

- `navigate`: Go to specific URLs
- `extract`: Extract structured data from web pages
- `act`: Perform actions like clicking buttons
- `observe`: Make observations about page content

### Utils

The `getStagehand()` function is used to retrieve the persisted Stagehand instance for the network execution. This function is using the `browserbaseSessionID` from the network state to retrieve the [kept alive Browserbase session](https://docs.browserbase.com/guides/long-running-sessions#keeping-sessions-alive-across-disconnects).

## Prerequisites

- Node.js 24.19.0
- An Inngest account
- A Browserbase account and API key
- OpenAI API access

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file with the following variables:

```env
BROWSERBASE_API_KEY=your_browserbase_api_key
OPENAI_API_KEY=your_openai_api_key
```

3. Start the server:

```bash
npm start
```

The server will start on port 3010.

4. Start the Inngest Dev Server

```bash
npx inngest-cli@latest dev
```

The Inngest Dev Server will start at [http://127.0.0.1:8288/](http://127.0.0.1:8288/).

## Usage

Navigate to the Inngest Dev Server runs view: [http://127.0.0.1:8288/functions](http://127.0.0.1:8288/functions).

From there, trigger the `simple-search-agent-workflow` function with your query:

```json
{
  "data": {
    "input": "When Inngest was founded?"
  }
}
```

The agent will:

1. Create a new Browserbase session
2. Process your query through the agent network
3. Return structured data based on the search results
4. Automatically clean up the browser session

## Configuration

You can customize the agent's behavior by modifying:

- `maxIter` in the search network (default: 15)
- The OpenAI model used (default: gpt-4o)
- The system prompts for both agents
- The tools available to the web search agent

## Error Handling

The extract tool accepts a nonempty flat schema such as `{ name: string, age: number, joined: date, tags: string[] }`. Supported types are `string`, `number`, `boolean`, `date`, and arrays of those types. Dates are ISO `YYYY-MM-DD` strings, validated as calendar dates. Nested objects, duplicate or reserved field names, and unknown types are rejected before acquiring a browser handle. The tool returns an explanation so the agent can correct its request.

Tools reconnect to the workflow's existing session. Both Stagehand and browser disconnects are attempted independently; an initialization failure also disconnects the acquired browser. The workflow requests session release after either a network result or an error, without reconnecting merely to release it. A failed initial disconnect also attempts release. When work and cleanup both fail, both errors are retained. A release request that fails is surfaced; it does not prove the remote session has ended.

Run the local parser and lifecycle checks after installing dependencies:

```sh
npm test
```

These checks use actual module and tool callbacks with synthetic SDK, workflow, and transport boundaries. They do not verify a live Inngest retry sequence, model response, or Browserbase session release.

## License

MIT