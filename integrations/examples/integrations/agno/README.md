# Agno + Browserbase Integration

**Intelligent web scraping with AI agents powered by Browserbase's cloud browser infrastructure.**

Agno provides AI agents that can understand natural language instructions for web scraping, while Browserbase delivers the reliable browser infrastructure needed to handle modern JavaScript-heavy websites and bypass anti-bot protection.

## 🚀 Why This Integration?

### Traditional Scraping Challenges
- **JavaScript-Heavy Sites**: Content loads dynamically after page load
- **Anti-Bot Protection**: Advanced detection systems block traditional scrapers  
- **Infrastructure Complexity**: Managing browsers and scaling is difficult

### Agno + Browserbase Solution
- **🤖 AI-Powered**: Natural language scraping instructions
- **🚀 Real Browser**: Full Chrome with JavaScript execution
- **🛡️ Stealth Capabilities**: Bypasses anti-bot systems
- **⚡ Zero Infrastructure**: Cloud-managed browsers with automatic scaling

## 📦 Key Features

**Intelligent Automation**: AI agents adapt to page changes and handle complex workflows  
**Visual Analysis**: Screenshots, layout detection, visual regression testing  
**Multi-Step Navigation**: Handle pagination, forms, and complex user journeys  
**Structured Data**: Extract data in JSON, CSV, or custom formats  
**Error Recovery**: Automatic retries and intelligent error handling  

## 🔧 Setup

Use Python 3.10 or later. From the cookbook root, create an isolated environment and install the complete package manifest:

```bash
cd integrations/examples/integrations/agno
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

This installs Agno, the Browserbase/Playwright tooling, `python-dotenv`, and the OpenAI model dependency. Browser automation connects to Browserbase's remote browser; this recipe does not require a local Playwright browser installation.

Configure all three required values in your shell, or copy `.env.example` to a new `.env` file and fill it in locally:

```bash
export BROWSERBASE_API_KEY=your_browserbase_api_key
export BROWSERBASE_PROJECT_ID=your_browserbase_project_id
export OPENAI_API_KEY=your_openai_api_key
python main.py
```

Get Browserbase credentials from the [Browserbase dashboard](https://browserbase.com). The pinned Agno 3.0.6 implementation selects `OpenAIResponses` with `gpt-5.4` when `Agent` has no explicit model, as in this example. `OPENAI_API_KEY` and access to that model are required in addition to Browserbase credentials. To use another model/provider, set `Agent(model=...)` explicitly and install/configure that provider's dependency and key.

Running `main.py` makes model and browser requests to extract quotes from two pages of `quotes.toscrape.com`. The setup checks below do not make those requests:

```bash
python -m pip check
python -c "from agno.agent import Agent; from agno.tools.browserbase import BrowserbaseTools; from agno.models.openai import OpenAIResponses; from dotenv import load_dotenv; print('Imports OK')"
```

These checks establish dependency/import readiness only. They do not verify account permissions, model access, or the live scraping result.

## 🤝 Support & Resources

- **📧 Support**: [support@browserbase.com](mailto:support@browserbase.com)
- **📚 Documentation**: [docs.browserbase.com](https://docs.browserbase.com)
- **🔧 Agno Docs**: [agno documentation](https://agno.dev)
- **💬 Community**: [GitHub Issues](https://github.com/browserbase/integrations/issues)