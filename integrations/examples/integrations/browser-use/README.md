# Browser Use with Browserbase

Run a Browser Use agent against a bundled, synthetic workshop schedule in a Browserbase browser. The default task reads three rows and returns their names, times, and rooms.

The fixture loads as a data URL. It has no forms, links, scripts, or external resources, and its content security policy disables resource loading and form submission. Browser Use navigation is restricted to its built-in data/about handling and the reserved `cookbook.invalid` domain. This navigation setting is not a general network firewall. The example does not include a contact-form submission task.

## Setup

Use Python 3.11 or later. From the cookbook root:

```bash
cd integrations/examples/integrations/browser-use
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Set all three variables in your shell or a local `.env` based on `.env.example`:

```bash
export BROWSERBASE_API_KEY=your_browserbase_key
export ANTHROPIC_API_KEY=your_anthropic_key
python main.py
```

Running the example allocates a Browserbase session and makes Anthropic model requests using `claude-sonnet-4-6`. All three keys and model construction are checked before allocation. Imports do not load `.env` or start the task. No local browser installation is required for the remote CDP connection.

The agent has a five-step, two-minute limit. The remote session has a five-minute maximum lifetime. Cleanup attempts Browser Use disconnect and explicit Browserbase release independently; combined failures are raised together. An incomplete agent result raises an error rather than printing a success result. The printed content is model output, so compare it with `fixture.html` when assessing extraction quality.

## Adapting the recipe

Use a target you control when changing the task. A submission workflow needs an explicit target, supplied field values, permission to submit, and a reliable confirmation check. This read-only recipe does not provide a submission mode.

## Local checks

```bash
python -B -m unittest discover -s tests
```

The synthetic tests execute the actual module with browser/model/API boundaries stubbed. They check preflight order, owned fixture navigation, initialization/run failures, cancellation and independent cleanup. They do not prove a live Browser Use model run, account access, or remote release.
