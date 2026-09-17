"""Run a Anthropic Claude browser-research agent with Deep Agents and Stagehand V4 code mode."""

from __future__ import annotations

import asyncio
from datetime import date

from agent_runtime import BROWSER_INSTRUCTIONS, SERVER_NAME, create_gateway_model, create_stagehand_client
from deepagents import create_deep_agent
from dotenv import load_dotenv
from langchain_mcp_adapters.tools import load_mcp_tools

load_dotenv()


def message_text(message: object) -> str:
    content = getattr(message, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(block.get("text", "") for block in content if isinstance(block, dict) and isinstance(block.get("text"), str))
    return str(content)


async def main() -> None:
    instruction = f"As of {date.today().isoformat()}, open the official Browserbase and Stagehand documentation, summarize when to use each product, and cite only pages you opened."
    client = create_stagehand_client()
    async with client.session(SERVER_NAME) as session:
        tools = await load_mcp_tools(session)
        agent = create_deep_agent(
            model=create_gateway_model("anthropic/claude-sonnet-4.6"),
            tools=tools,
            system_prompt=BROWSER_INSTRUCTIONS + "\nUse at most six browser calls and return a concise answer with opened source URLs.",
        )
        result = await agent.ainvoke({"messages": [{"role": "user", "content": instruction}]}, config={"recursion_limit": 25})
        print(message_text(result["messages"][-1]).strip())


if __name__ == "__main__":
    asyncio.run(main())
