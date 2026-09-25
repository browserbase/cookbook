# Browserbase Proxy Testing Script

Stagehand is the SDK for browser agents.

## AT A GLANCE

- Goal: demonstrate different proxy configurations with Browserbase sessions.

## GLOSSARY

- Proxies: Browserbase's default proxy rotation for enhanced privacy
  Docs → https://docs.browserbase.com/features/proxies

## QUICKSTART

From the cookbook root, enter this recipe and install its declared dependencies:

```bash
cd examples/python/proxies
uv sync --python 3.11
cp .env.example .env
```

`uv sync` creates this recipe's `.venv` and installs dependencies from
`pyproject.toml`. No activation or separate `pip` command is needed. Install
[uv](https://docs.astral.sh/uv/getting-started/installation/) first if it is unavailable.
Configure the required values in `.env` using `.env.example` as the reference.

Run from this same recipe directory:

```bash
uv run python main.py
```

## EXPECTED OUTPUT

- Tests built-in proxy rotation
- Tests geolocation-specific proxies (New York)
- Tests custom external proxies (commented out by default)
- Displays IP information and geolocation data for each test
- Shows how different proxy configurations affect your apparent location

## COMMON PITFALLS

- Browserbase Developer plan or higher is required to use proxies
- "ModuleNotFoundError": run `uv sync --python 3.11` in this recipe directory
- Missing credentials: verify .env contains BROWSERBASE_API_KEY
- Custom proxy errors: verify external proxy server credentials and availability
- Import errors: use `uv run python main.py` from this recipe directory

## USE CASES

• Geo-testing: Verify location-specific content, pricing, or compliance banners.
• Scraping at scale: Rotate IPs to reduce blocks and increase CAPTCHA success rates.
• Custom routing: Mix built-in and external proxies, or apply domain-based rules for compliance.

## NEXT STEPS

• Add routing rules: Configure domainPattern to direct specific sites through targeted proxies.
• Test multiple geos: Compare responses from different cities/countries and log differences.
• Improve reliability: Add retries and fallbacks to handle proxy errors like ERR_TUNNEL_CONNECTION_FAILED.

## HELPFUL RESOURCES

📚 Stagehand Docs: https://docs.stagehand.dev/v4/first-steps/introduction
🎮 Browserbase: https://www.browserbase.com
💡 Try it out: https://www.browserbase.com/playground
🔧 Templates: https://www.browserbase.com/templates
📧 Need help? support@browserbase.com
💬 Discord: http://stagehand.dev/discord
