# Anthropic Claude browser agent with Stagehand V4

This public Python example uses a Anthropic Claude model through Vercel AI Gateway, LangChain Deep Agents for orchestration, and Stagehand V4 code mode for one persistent Browserbase session.

> Demo and reference code only. Model-authored browser code is not a security sandbox. Use authorized sites, isolate untrusted content, review costs and actions, and use at your own risk.

```sh
cp .env.example .env
uv sync
uv run python main.py
```

Set `BROWSERBASE_API_KEY` and `AI_GATEWAY_API_KEY`. Override `DEEPAGENTS_MODEL` only with a model supported by your gateway account. The sample asks the agent to open official Browserbase and Stagehand documentation and cite only pages it visited.
