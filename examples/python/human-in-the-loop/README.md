# Python human-in-the-loop browser handoff

This runnable example opens an operator-supplied HTTPS page in Browserbase, prints the session dashboard URL, and pauses for explicit terminal approval before an optional configured click.

> Demo and reference code only. It does not determine whether an action is authorized or safe. Review the page and selector yourself; use at your own risk.

```sh
cp .env.example .env
uv sync
uv run python main.py
```

Set `BROWSERBASE_API_KEY` and `TARGET_URL`. Leave `APPROVAL_SELECTOR` unset to exercise the handoff without mutating the page. The script performs no action unless the operator types `approve`; even then it clicks only when the selector resolves to exactly one element.
