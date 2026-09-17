const fs = require("fs");
const path = require("path");
const { name, systemPrompt, resultSchema } = require("../agent-definition");

const apiKey = process.env.BROWSERBASE_API_KEY;
if (!apiKey) throw new Error("BROWSERBASE_API_KEY is required");

const configPath = path.join(__dirname, "..", ".browserbase-agent.json");
let existing;
try {
  existing = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch {}

async function request(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: { "x-bb-api-key": apiKey, "Content-Type": "application/json" },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok)
    throw new Error(
      body.message ||
        body.error ||
        `Browserbase request failed (${response.status})`,
    );
  return body;
}

async function main() {
  const payload = JSON.stringify({ name, systemPrompt, resultSchema });
  const agent = existing?.agentId
    ? await request(
        `https://api.browserbase.com/v1/agents/${existing.agentId}`,
        { method: "PATCH", body: payload },
      )
    : await request("https://api.browserbase.com/v1/agents", {
        method: "POST",
        body: payload,
      });
  fs.writeFileSync(
    configPath,
    `${JSON.stringify({ agentId: agent.agentId, name: agent.name, updatedAt: agent.updatedAt }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    `${existing?.agentId ? "Updated" : "Created"} Browserbase Agent: ${agent.name}`,
  );
  console.log(`Agent ID: ${agent.agentId}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
