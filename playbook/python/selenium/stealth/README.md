# Observe CAPTCHA solving with Selenium

From `playbook/python`, create a virtual environment and install `requirements.txt`. Export `BROWSERBASE_API_KEY`, then run:

```sh
CAPTCHA_TIMEOUT_SECONDS=30 python selenium/stealth/captcha_listening.py
```

This opens the Google reCAPTCHA demonstration through Browserbase. The optional timeout defaults to 30 seconds and must be finite and positive. Browser console logging is enabled before connection. The runner uses Selenium's registered `getLog` command through `Remote.execute`; Selenium 4.48's generic `Remote` driver does not expose `get_log`.

Old logs are drained before navigation. The observation window begins after navigation, which has its own page-load timeout. Start and finish events are paired in order. The returned dictionary includes `status`, `started`, `completed`, and `pending`:

- `solved`: every observed start has a matching finish and at least one pair completed.
- `no_challenge_observed`: no start was observed throughout the window. This does not establish that the page has no challenge or that a later action will succeed.
- An unmatched start at the deadline raises `TimeoutError`. Invalid event sequences or timestamps also raise. The command exits nonzero on exceptions and always attempts to quit an allocated driver.

A log response arriving after the deadline is rejected. The observation deadline does not interrupt a blocking Selenium transport request; transport timeouts can extend wall-clock duration. These are console-event observations, not an independent check of a challenge widget or downstream workflow.

Local verification covers synthetic events, timing, cleanup, and the installed Selenium 4.48 command transport. No live Browserbase session or CAPTCHA service has been tested. See the [Browserbase identity documentation](https://docs.browserbase.com/platform/identity/overview) for the event markers.
