# Repeated browser actions and cache inspection

This package compares repeated actions and agent tasks using the migrated Stagehand runner. Elapsed time alone does not establish cache reuse. The agent runner executes tasks anew and does not implement cached-plan replay or expose a cache-hit signal.

## Setup

Use Node.js 22 or newer. From this directory:

```sh
npm install
```

Configure model credentials locally before running. Read the selected source for its browser settings and target URL. These demos launch a local browser and can call a model service; the checks below do neither.

## Experiments

```sh
npm run demo:act-cache
npm run demo:agent-cache
```

The act experiment repeats a form action with several test usernames. It reports measured timing bands, then inspects JSON files if its configured cache directory exists. Missing or empty cache evidence is unverified. Finding a test username in an inspected file fails the privacy check and sets a nonzero exit code. An absence of those test values proves only that limited scan, not general privacy or SDK cache behavior.

The agent experiment runs the same task twice and reports success, steps, and elapsed time. Cache status is unverified. Differences in duration may have other causes; this script does not report hits, replay savings, or cache-file creation.

The act experiment accepts `--fresh` to remove its configured local cache directory before running. The agent experiment has no cache to reset. Keep cache files local and review their contents before sharing any output.

## Local regression checks

Using a Node version with `node:module.stripTypeScriptTypes` (Node 22.13+ or Node 24):

```sh
node --test tests/*.test.cjs
```

Tests execute source functions with synthetic browser, clock, and filesystem inputs. They do not read real cache files or contact a model/browser service. These checks verify reporting behavior; live cache support remains unverified.
