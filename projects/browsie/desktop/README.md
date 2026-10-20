# Browsie Desktop

Browsie Desktop packages the existing Browsie web application, Eve agent, Stagehand runtime, and
Browserbase Workbench as one desktop application. The app does not add a second browser-control
service. Its optional MCP mode sends tasks to the same durable Eve sessions as the web and Linq
channels.

The installed app supervises three loopback-only services: the Next.js Workbench on port `4318`,
the Eve runtime on port `4274`, and the authenticated HTTP MCP bridge on port `4320`. The desktop
window loads the Workbench. Next.js proxies Eve routes to the internal runtime, so the web UI and
MCP clients use the same durable sessions.

## Local development

Start the existing Browsie server, then open it in Electron:

```bash
pnpm --filter browsie dev
BROWSIE_DESKTOP_SERVER_URL=http://127.0.0.1:4318 pnpm --filter browsie-desktop dev
```

To let the desktop app start a production Browsie bundle itself:

```bash
pnpm --filter browsie build
pnpm --filter browsie-desktop dev
```

## Build the macOS installer

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --filter browsie-desktop dist:mac
```

The unsigned local-test DMG is written to `release/`. On first start, Browsie creates
`browsie.env.example` in the application data directory. Copy it to `browsie.env`, add your own
Browserbase and model credentials, and restart the app. The app never copies repository `.env`
files into an installer.

## MCP mode

The installed Electron binary can run without a window as a command MCP server:

```bash
/Applications/Browsie.app/Contents/MacOS/Browsie --mcp
```

It exposes three high-level tools:

- `browse` creates or continues a durable Browsie task.
- `stop_browsing` cancels the active turn and browser operation.
- `browsie_session` returns the Workbench URL and durable event count.

The MCP server does not expose Stagehand directly. Browsie remains the inner browser-agent harness,
including Contexts, Vault access, CAPTCHA state, Live View, and recovery.

## Local remote-MCP bridge

The desktop app also starts an authenticated Streamable HTTP MCP endpoint on
`http://127.0.0.1:4320/mcp`. It creates a random bearer token on first start and stores it with the
rest of the local Browsie data. The endpoint stays on loopback and is not public by default.

For a short private hosted-agent test, start a temporary HTTPS tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:4320
```

Add the resulting `https://.../mcp` URL as a custom Remote HTTPS MCP server. Configure its
`Authorization` header as `Bearer <token>`. The token is stored at:

```text
~/Library/Application Support/Browsie/mcp-token
```

Do not put the token in source control or a chat message. A temporary tunnel URL changes when the
tunnel restarts. Use a named tunnel and managed secret for a longer test.

## Hosted-agent command mode

A hosted agent can run on a Linux computer that cannot open the macOS application. Build the
headless MCP command on that computer instead:

```bash
pnpm install
pnpm --filter browsie build
pnpm --filter browsie-desktop build
node desktop/dist/mcp/launcher.mjs
```

Add the last command as a custom MCP Command plugin. The launcher starts the same loopback-only
Browsie server and then exposes the three MCP tools. Set `BROWSIE_SERVER_ROOT` only when the two
workspaces are not next to each other. Never put credentials in the command or its arguments.

For a private first test, configure credentials through the plugin's protected environment. A
Command plugin that needs environment variables is suitable only for the owner's chat. For a
shared Team Bot, deploy Browsie as an authenticated Remote HTTPS MCP service so credentials remain
on server infrastructure.
