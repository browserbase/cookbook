# Run your first example

Run a cloud browser first, or select Search and Fetch independently. Choose Python or TypeScript. Both examples use Browserbase directly and require no LLM credentials.

Create a Browserbase account at [browserbase.com](https://www.browserbase.com/) and create an API key in [Browserbase settings](https://www.browserbase.com/settings). A session is one cloud browser run; its session ID links to logs and replay. Search and Fetch are separate APIs and may have different account access and usage. Keep the key in the selected example's ignored `.env` file.

## Python

Install Python and [uv](https://docs.astral.sh/uv/getting-started/installation/). The example's [project manifest](../examples/python/getting-started-with-browserbase/pyproject.toml) declares Python 3.9 or newer. Use a current supported Python release for your environment.

From the cookbook root:

```sh
cd examples/python/getting-started-with-browserbase
cp .env.example .env
```

Edit `.env` and set `BROWSERBASE_API_KEY` using your Browserbase account. Do not commit that file.

```sh
uv run python main.py browser
```

`uv` resolves the dependencies from this example's `pyproject.toml`. You do not need a repository-wide Python environment.

## TypeScript

Install Node.js and npm. From the cookbook root:

```sh
cd examples/typescript/getting-started-with-browserbase
npm install
cp .env.example .env
```

Set `BROWSERBASE_API_KEY` in `.env`.

```sh
npm start -- browser
```

This example's [package.json](../examples/typescript/getting-started-with-browserbase/package.json) defines `start` as `tsx index.ts`. Other templates may require pnpm and a particular Node version. Follow their own recipe guide.

## Check the result

Browser mode creates a cloud browser session first, navigates Wikipedia, extracts the article content, prints the result, and closes the browser. Confirm the printed title and open the session replay URL.

Run one of the other modes independently:

```sh
uv run python main.py search
uv run python main.py fetch
uv run python main.py all
```

For TypeScript, use `npm start -- search`, `npm start -- fetch`, or `npm start -- all`. The `all` mode runs these operations in order:

1. Search for “Browser automation” and print result titles and URLs.
2. Fetch a Wikipedia page and print its status, content length, and title.
3. Create a cloud browser, navigate Wikipedia, and print the article title, summary, section headings, and session replay URL.

A failure in Search stops later operations only in `all` mode. The default `browser` mode never calls Search or Fetch.

A successful installation is not a successful browser run. Confirm the printed content and open the session replay before adapting the example.

## Troubleshoot

| Symptom | Check |
| --- | --- |
| Authentication error | Confirm the key is set in the example's `.env` and the command runs from that directory. |
| Search or Fetch rejects the request | Check your account's feature access and the live [Browserbase documentation](https://docs.browserbase.com/). |
| Import or package error | Use the manifest in the selected folder. Older upstream READMEs sometimes refer to absent requirements files. |
| Wikipedia selector fails | Inspect the page and adjust the selector in `main.py` or `index.ts`. External sites can change. |
| Stagehand method differs from another example | Compare dependency versions in each recipe's manifest; recipes still marked `legacy` require migration. |

## Choose the next recipe

Use [authentication](topics/authentication.md) for saved sessions, [extraction](topics/extraction-and-research.md) for structured data, or [integrations](topics/integrations-and-orchestration.md) for your existing framework. Each guide links its entrypoint, setup boundary, configuration names, and source revision.
