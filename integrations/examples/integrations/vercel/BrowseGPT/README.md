# BrowseGPT

[BrowseGPT](https://browsegpt.dev) is a chat interface that allows you to search the web and get answers to your questions. It is built with [Vercel AI SDK](https://www.npmjs.com/package/ai) and [Browserbase](https://www.browserbase.com/).

![BrowseGPT Demo](./app/browsegpt.gif)

## Node runtime

Use Node **24.19.0** (`nvm install && nvm use` in this directory). The `.nvmrc` and `engines.node` select that Node 24 baseline. It satisfies the pinned jsdom 30 requirement of `^22.22.2 || ^24.15.0 || >=26.0.0`, as well as Next's `>=20.9.0` requirement. This package supports the selected Node 24 line; a generic Node 22 installation is insufficient. Installing the exact dependency graph and validating the full UI remain separate requirements.

## Getting Started

1. Clone the repository
2. Copy `.env.template` to `.env.local` and fill in the provider keys and project ID. Generate `BROWSEGPT_SESSION_SECRET` with `openssl rand -hex 32` and put the result in `.env.local`. Use the same secret on every deployed instance; keep it server-only.
3. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Vercel AI SDK and Browserbase, take a look at the following resources:

- [Vercel AI SDK](https://www.npmjs.com/package/ai) - learn about Vercel AI SDK features and API.
- [Browserbase](https://www.browserbase.com/) - offers a reliable, high performance serverless developer platform to run, manage, and monitor headless browsers at scale.

## Browser session lifecycle

The first submitted message creates a browser session through `/api/session`. The server returns a signed, expiring credential and a debugger URL. The client keeps them in memory for this tab. The credential travels in a request header on chat requests, including confirmation continuations; it is not included in model messages. Browser tools use the verified session identity and cannot choose a different session ID through their arguments.

Use **End session** to stop generation and request Browserbase release. A failed release keeps the credential and displays a retry error. Successful release clears the conversation. If the server rejects an expired or invalid credential, **Clear conversation** resets local state without claiming remote release. Browserbase sessions have a 15-minute hard timeout, which bounds abandoned tabs and lost creation responses. Operation credentials expire after 15 minutes; release requests have an additional five-minute grace period. Reloading the page loses the tab's credential and relies on the provider timeout for cleanup.

This sample uses a bearer credential, not user-account authentication. A copied credential can access its session until expiry. Stateless signing works across server instances but does not provide immediate revocation, global operation locking, or idempotent creation after ambiguous network failures. Tools within one request run sequentially and recheck credential expiry and request cancellation before beginning work. Coordination across requests or workers requires a shared durable ownership store. Add application authentication and appropriate usage controls before exposing a deployment to untrusted users.

## Local verification

Run `node --test tests/*.test.cjs` from this package after installing its dependencies. The fixtures execute the actual credential, API and tool code using synthetic Browserbase responses and model output. They do not make live provider calls. Full Next.js and AI SDK React integration also require this package's pinned dependencies; the cookbook review currently tracks an installation release-age restriction separately.

## Messages and request recovery

Assistant text and tool parts render in their original order. Tool output, generic tool failures, and confirmation controls remain visible alongside the answer. An interrupted response keeps any text already received.

A request failure displays a generic alert and preserves the conversation and draft. **Edit and resubmit** restores the last request to the input and clears the chat error; it does not submit anything. Review and edit the request, then explicitly send it. The original request and partial response remain in history, so avoid repeating an external action solely to recover its answer. Recovery is disabled while another request or session operation is busy.

The draft is cleared only after an observed request completes successfully, rather than assuming `sendMessage` throws on every SDK failure. Session creation errors also retain the draft. Missing model configuration is rejected by the server before model execution; raw provider errors are not shown in the request alert.

`tests/messages.test.cjs` executes the actual component using synthetic React hooks and JSX constructors, including recovery callbacks. It covers ordered mixed messages, failed tools, confirmation states, request rejection, partial answers, and an SDK error that resolves the send promise. This is component-tree verification, not a real browser stream or a complete Next.js build. Existing API/session tests use installed AI SDK helpers with synthetic providers.
