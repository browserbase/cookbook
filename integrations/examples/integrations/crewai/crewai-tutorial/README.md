# Tutorial: build a Flight Booking Crew
### Build a Crew that finds the best roundtrip flights on the given dates.

This is based off the guide in the [Browserbase docs](https://docs.browserbase.com/integrations/crew-ai/build-a-flight-booker)

## Setup

Use Python 3.12 or 3.13 and [Poetry](https://python-poetry.org/) for dependency management. From the cookbook root:

```sh
cd integrations/examples/integrations/crewai/crewai-tutorial
poetry env use python3.13
poetry install
```

Use `python3.12` in the environment command if that is your installed supported interpreter. The manifest sets `package-mode = false`, so Poetry installs the dependencies without building or installing this directory as a package. A local pip package installation is unsupported for this project.

The setup contract has been checked against Poetry 2.1.1 and its build backend. Full dependency installation and the live flight-search workflow have not been verified.

You will also need to set up a `.env` file with the following variables:

```bash
BROWSERBASE_API_KEY=your-browserbase-api-key
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL_NAME=gpt-4-turbo
```

## Running the Crew

To run the Crew, run `poetry run python main.py "flights from SF to New York on November 5th"`


## Unresolved dependency advisories

CrewAI currently requires a ChromaDB version affected by four open security advisories. No patched ChromaDB release is available in the dependency range. See the [security remediation report](../../../../../docs/security-remediation.md) for affected alerts and validation limits. Do not expose the ChromaDB service to untrusted requests.
