# Python cloud download example

Run `python playwright/download/download_save.py` from `playbook/python` after installing that directory's requirements and configuring `BROWSERBASE_API_KEY`. The script loads dotenv configuration inside `main()`.

The download listener is registered before the click. The script allows 30 seconds for the download event, then waits up to 30 seconds for [Playwright's completion result](https://playwright.dev/python/docs/api/class-download#download-failure). A failed or timed-out download raises before archive retrieval. Page and browser cleanup are attempted independently.

After browser cleanup, the script polls the session download endpoint for up to 30 seconds of readiness, retrying empty responses or empty ZIPs once per second. HTTP errors, malformed ZIPs and failed CRC checks raise. A successful archive must contain at least one regular file. The original archive bytes are saved without extraction, using exclusive creation of `downloads.zip` in the working directory. Existing output is preserved. A filesystem write failure may leave a partial new file.

Requests timeouts bound connection/read inactivity rather than total transfer duration. The readiness deadline is checked after each response and after ZIP validation, so late responses are not accepted, but a slow transfer can delay returning the timeout error. This example imposes no archive size limit and does not prove that the archive contains every expected file. It reports success only after the validated bytes have been written.

Run `python -B -m unittest discover -s tests -p test_download_save.py` from `playbook/python`. Set `COOKBOOK_CHROME` to an installed Chrome executable to include a real browser test that downloads synthetic bytes from a local HTTP server. The tests cover delayed completion, failure, archive readiness/integrity and cleanup ordering. No Browserbase session, external download or customer data is used in those checks.
