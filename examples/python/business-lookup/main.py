"""Look up an official business record with Deep Agents and Stagehand V4 code mode."""

from __future__ import annotations

import asyncio

from agent_runtime import (
    BROWSER_INSTRUCTIONS,
    SERVER_NAME,
    create_gateway_model,
    create_stagehand_client,
)
from deepagents import create_deep_agent
from dotenv import load_dotenv
from langchain_mcp_adapters.tools import load_mcp_tools
from pydantic import BaseModel, ConfigDict, Field
from record_validation import business_query_url, validate_record

load_dotenv()

BUSINESS_NAME = "Jalebi Street"


class BusinessInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dba_name: str = Field(description="DBA name")
    ownership_name: str | None = Field(description="Ownership name")
    business_account_number: str = Field(description="Business account number (ttxid)")
    location_id: str | None = Field(description="Location ID (uniqueid)")
    street_address: str | None = None
    business_start_date: str | None = None
    business_end_date: str | None = None
    neighborhood: str | None = None
    naics_code: str | None = None
    naics_code_description: str | None = None
    source_url: str = Field(description="Official SF Open Data URL opened in the browser")


async def main() -> None:
    source_url = business_query_url(BUSINESS_NAME)
    print(f"Searching for business: {BUSINESS_NAME}")
    client = create_stagehand_client()

    async with client.session(SERVER_NAME) as session:
        tools = await load_mcp_tools(session)
        agent = create_deep_agent(
            model=create_gateway_model("anthropic/claude-sonnet-4.6"),
            tools=tools,
            system_prompt=BROWSER_INSTRUCTIONS,
            response_format=BusinessInfo,
        )
        result = await agent.ainvoke(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": (
                            f"Open {source_url} in the browser and find the exact DBA record for "
                            f"{BUSINESS_NAME!r}. Read the rendered JSON, map ttxid to "
                            "business_account_number and uniqueid to location_id, and return every "
                            "requested field. Use null when an optional field is absent."
                        ),
                    }
                ]
            },
            config={"recursion_limit": 30},
        )
        business = BusinessInfo.model_validate(result["structured_response"])
        validate_record(business.model_dump(), BUSINESS_NAME)

    print("Business research with matching DBA and official query reference (record contents require review):")
    print(business.model_dump_json(indent=2))
    print("Stagehand code-mode session closed successfully")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as error:
        print(f"Error in business lookup: {error}")
        print("Check BROWSERBASE_API_KEY and AI_GATEWAY_API_KEY in .env")
        raise SystemExit(1) from error
