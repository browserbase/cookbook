"""Give a CrewAI agent one persistent Stagehand v4 code-mode browser."""
import os
import sys

from crewai import Agent, Crew, Task
from crewai_tools import MCPServerAdapter
from dotenv import load_dotenv
from mcp import StdioServerParameters

load_dotenv()


def main():
    browser_key = os.environ["BROWSERBASE_API_KEY"]
    task = " ".join(sys.argv[1:]) or "Open https://example.com and report its title and main heading."
    server = StdioServerParameters(
        command="uvx",
        args=["--from", "git+https://github.com/browserbase/stagehand.git@d4f16a98a5061279bed997b98fd3f0c17334eedb#subdirectory=packages/integrations/deepagents",
              "--with", "stagehand==4.0.2", "stagehand-deepagents-mcp"],
        env={"PATH": os.environ.get("PATH", ""), "BROWSERBASE_API_KEY": browser_key,
             "STAGEHAND_BROWSER": "browserbase"},
    )
    with MCPServerAdapter(server, connect_timeout=120) as tools:
        researcher = Agent(
            role="Browser researcher", goal="Complete the requested browser task from observed evidence",
            backstory="Use snapshot before unfamiliar interactions, run for browser code, and screenshot for visual checks.",
            tools=list(tools), llm=os.getenv("CREWAI_MODEL", "openai/gpt-5"), verbose=True,
        )
        result = Crew(agents=[researcher], tasks=[Task(
            description=task, expected_output="Observed result, source URLs, and any unresolved steps.", agent=researcher,
        )]).kickoff()
        print(result)


if __name__ == "__main__":
    main()
