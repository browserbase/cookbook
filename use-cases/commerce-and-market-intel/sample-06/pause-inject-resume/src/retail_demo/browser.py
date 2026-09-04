"""Browser + Stagehand client bootstrap.

Stagehand v4 splits browser acquisition from the client: you hand
``Stagehand.create`` a browser handle produced by one of the factories, and the
same call is otherwise identical for local Chrome and for Browserbase.
"""

from __future__ import annotations

import os

from stagehand import Stagehand, StagehandBrowser, browserbase, local_browser

from .config import Config, required_env
from . import log

VIEWPORT = {"width": 1365, "height": 900}


async def launch_browser(config: Config) -> StagehandBrowser:
    if config.browser_mode == "browserbase":
        browser = await browserbase.launch(
            api_key=required_env("BROWSERBASE_API_KEY", "for RETAILER_DEMO_BROWSER=browserbase"),
            browser_settings={"viewport": VIEWPORT},
            user_metadata={"demo": "retailer-pause-inject-resume", "stagehand": "v4"},
        )
        if browser.session_id:
            print(f"Browserbase session: https://browserbase.com/sessions/{browser.session_id}")
        return browser

    return await local_browser.launch(
        headless=config.headless,
        viewport_width=VIEWPORT["width"],
        viewport_height=VIEWPORT["height"],
    )


async def create_stagehand(browser: StagehandBrowser, config: Config) -> Stagehand:
    model_source = (
        "Browserbase Model Gateway (no provider key needed)"
        if config.uses_model_gateway
        else config.stagehand_model
    )
    log.step(
        "stagehand",
        f"Connecting Stagehand v4 to the {config.browser_mode} browser "
        f"(act/observe/extract model: {model_source}).",
    )

    options: dict[str, object] = {}
    if not config.uses_model_gateway:
        options["model"] = config.stagehand_model
        options["model_api_key"] = config.stagehand_model_api_key
    # Passing the Browserbase key enables the managed services -- the Model
    # Gateway and server-side caching. Omitting `model` entirely is what tells
    # Stagehand to let Browserbase choose one.
    browserbase_key = (os.environ.get("BROWSERBASE_API_KEY") or "").strip()
    if browserbase_key:
        options["api_key"] = browserbase_key

    stagehand = await Stagehand.create(
        browser=browser,
        # Caching makes repeat runs cheap and gives the run summary real
        # HIT/MISS data to show.
        cache=True,
        self_heal=True,
        **options,
    )
    print(f"Stagehand ready. provider={browser.provider} initialized={stagehand.initialized}")
    return stagehand
