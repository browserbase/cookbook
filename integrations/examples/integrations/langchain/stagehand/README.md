# Langchain JS

## Integrate Stagehand with Langchain JS

Stagehand can be integrated into LangChain JS by wrapping Stagehand's browser automation methods as LangChain tools.

This example exposes navigate, act, and observe tools using LangChain 1.2 and Stagehand 4's `{ data }` result contract.

For more details on this integration and how to work with Langchain, see the official Langchain documentation.

## Use the tools

- **stagehand_navigate**: Navigate to a specific URL.
- **stagehand_act**: Perform browser automation tasks like clicking buttons and typing in fields.
- **stagehand_observe**: Investigate the DOM for possible actions or relevant elements.

## Run it

```bash
npm install
npm start
```

The default example launches a local browser. Configure the model credentials required by Stagehand before starting it. Run the contract tests without opening a browser or calling a model:

```bash
npm test
```

## Remote Browsers (Browserbase)

Replace `localBrowser.launch()` with `browserbase.launch()` and provide these environment variables to run on Browserbase:
- `BROWSERBASE_API_KEY`
- `BROWSERBASE_PROJECT_ID`

## Using LangGraph Agents

The StagehandToolkit can also be plugged into LangGraph's existing agent system. This lets you orchestrate more complex flows by combining Stagehand's tools with other Langchain tools.

With the StagehandToolkit, you can quickly integrate natural-language-driven browser automation into workflows supported by Langchain. This enables use cases such as:

- Searching, extracting, and summarizing data from websites
- Automating login flows
- Navigating or clicking through forms based on instructions from a larger chain of agents

Consult Stagehand's and Langchain's official references for troubleshooting and advanced integrations or reach out to us on [Slack](https://stagehand.dev/slack).
