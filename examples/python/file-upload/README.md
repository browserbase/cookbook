# Python file upload with Browserbase

This runnable Playwright example selects one reviewed local file in an operator-supplied upload control. It does not submit the surrounding form.

> Demo and reference code only. Confirm authorization, file contents, target, selector, and retention policy before enabling an upload. Use at your own risk.

```sh
cp .env.example .env
uv sync
uv run python main.py
```

The script validates an HTTPS target, requires `ALLOW_UPLOAD=true`, rejects files larger than 10 MiB, and requires the selector to match exactly one element before allocating the upload action.
