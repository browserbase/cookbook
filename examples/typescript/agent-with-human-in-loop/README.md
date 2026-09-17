# Stagehand Code Mode + Vercel AI SDK: Human-in-the-Loop Agent

## AT A GLANCE

- Goal: showcase a bring-your-own browser agent that pauses for human input while filling a form.
- Agent framework: Vercel AI SDK `ToolLoopAgent` owns the reasoning loop and exposes a custom `askHuman` tool.
- Browser tool: Stagehand code mode exposes one stateful MCP tool, `code_execute`.
- Interactive loop: the agent calls `askHuman` for missing facts and resumes when the user responds.
- SSE Streaming: real-time activity log and status updates streamed to the frontend.
  Docs → https://docs.browserbase.com/features/sessions

## GLOSSARY

- askHuman: an application-defined AI SDK tool that pauses execution and sends a question to the user, resuming once a response is provided
- session store: an in-memory map coordinating state between the SSE stream and the human response endpoint
- code_execute: Stagehand code mode's MCP tool for stateful browser JavaScript, including V4 page APIs and AI primitives
- ToolLoopAgent: the Vercel AI SDK agent loop that decides when to call `code_execute` or `askHuman`

## QUICKSTART

1.  From the cookbook root: `cd examples/typescript/agent-with-human-in-loop`
2.  pnpm install
3.  Create a .env file and add your Browserbase and Vercel AI Gateway credentials:
    BROWSERBASE_API_KEY=your-api-key
    AI_GATEWAY_API_KEY=your-ai-gateway-key
4.  pnpm dev
5.  Open http://localhost:3000 in your browser

## Production build

Use pnpm **10.24.0** from this recipe directory. Next.js **16.2.1** needs the JavaScript TypeScript compiler API for its build checks, so this package pins TypeScript **6.0.3**. TypeScript 7.0.2 lacks the `typescript/lib/typescript.js` module this Next version probes; passing `tsc --noEmit` alone does not verify the production build.

After installation, run both checks:

```sh
pnpm typecheck
pnpm build
```

A successful build does not verify the live agent, Browserbase session, or human-response flow. The current fresh-install verification is blocked by the seven-day dependency release-age policy for Browserbase SDK 2.19.1; the repaired checkout's production build has not yet been reverified.

## EXPECTED OUTPUT

- A form appears to enter an applicant's name and upload a resume
- On submit, an agent session starts and streams status to the activity panel
- The agent uses `code_execute` to navigate to a job application and fill known fields
- When an unknown field is encountered, it pauses and displays a question in the UI
- You type a response and the workflow continues with that value
- Closing the MCP client closes Stagehand and its Browserbase browser

The app deliberately does not infer a browser ID by comparing account-wide session lists. The
current code-mode transport does not return its owned Browserbase session identity to this app, so
embedding a guessed Live View or replay URL could expose another concurrent run.

Resume validation is enforced by the server as well as the browser UI: PDF, DOC, and DOCX uploads
must have a matching filename/type and decode to at most 10 MiB. Disconnects cancel pending human
questions, terminal sessions reject late answers, and an exhausted agent loop is reported as an
error unless the agent records a visible submission confirmation.

## SAFETY

Code mode executes model-authored JavaScript and is not itself a security sandbox. Run it inside an isolation boundary when prompts or pages are untrusted.

## USE CASES

• Assisted form filling: automate job applications, account signups, or onboarding flows where some fields require human judgment.
• Approval workflows: let an agent prepare actions (purchases, submissions) but pause for human confirmation before committing.
• Supervised data entry: automate repetitive browser data entry while letting a human handle edge cases or ambiguous inputs.

## HELPFUL RESOURCES

📚 Stagehand Docs: https://docs.stagehand.dev
📚 Vercel AI SDK Agents: https://ai-sdk.dev/docs/agents/building-agents
📚 Vercel AI SDK MCP Tools: https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools
🎮 Browserbase: https://www.browserbase.com
💡 Try it out: https://www.browserbase.com/playground
🔧 Templates: https://www.browserbase.com/templates
📧 Need help? support@browserbase.com
💬 Discord: http://stagehand.dev/discord
