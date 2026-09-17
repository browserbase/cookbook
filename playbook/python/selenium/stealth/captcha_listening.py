import math
import os
import time

import requests
from selenium import webdriver
from selenium.webdriver.remote.command import Command
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.remote_connection import RemoteConnection


def validate_timeout(value) -> float:
    if isinstance(value, bool):
        raise ValueError("CAPTCHA timeout must be a finite positive number")
    try:
        timeout = float(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError("CAPTCHA timeout must be a finite positive number") from exc
    if not math.isfinite(timeout) or timeout <= 0:
        raise ValueError("CAPTCHA timeout must be a finite positive number")
    return timeout


def create_session() -> str:
    """Create a Browserbase browser session with a bounded API request."""
    response = requests.post(
        "https://api.browserbase.com/v1/sessions",
        json={"proxies": True},
        headers={
            "Content-Type": "application/json",
            "x-bb-api-key": os.environ["BROWSERBASE_API_KEY"],
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["id"]


class BrowserbaseConnection(RemoteConnection):
    """Manage a single session with Browserbase."""

    def __init__(self, *args, **kwargs):
        self._api_key = os.environ["BROWSERBASE_API_KEY"]
        self._session_id = create_session()
        super().__init__(*args, **kwargs)

    def get_remote_connection_headers(self, parsed_url, keep_alive=False):
        headers = super().get_remote_connection_headers(parsed_url, keep_alive)
        headers["x-bb-api-key"] = self._api_key
        headers["session-id"] = self._session_id
        return headers


class SolveState:
    """Pair observed solve events in order; timestamps are milliseconds."""

    START_MSG = "browserbase-solving-started"
    END_MSG = "browserbase-solving-finished"

    def __init__(self):
        self.pending_starts = []
        self.started = 0
        self.completed = 0
        self.solution_times = []

    def handle_console(self, msg: dict) -> None:
        if msg.get("level") != "INFO":
            return
        message = msg.get("message")
        if not isinstance(message, str):
            return
        started = self.START_MSG in message
        finished = self.END_MSG in message
        if not started and not finished:
            return
        if started and finished:
            raise ValueError("Ambiguous CAPTCHA event contains both start and finish")
        timestamp = msg.get("timestamp")
        if (
            isinstance(timestamp, bool)
            or not isinstance(timestamp, (int, float))
            or not math.isfinite(timestamp)
            or timestamp < 0
        ):
            raise ValueError("CAPTCHA event requires a finite nonnegative timestamp")
        if started:
            self.pending_starts.append(timestamp)
            self.started += 1
        else:
            if not self.pending_starts:
                raise ValueError("CAPTCHA finish event has no observed start")
            if timestamp < self.pending_starts[0]:
                raise ValueError("CAPTCHA finish timestamp precedes its start")
            self.solution_times.append(timestamp - self.pending_starts.pop(0))
            self.completed += 1

    def result(self, status: str) -> dict:
        return {
            "status": status,
            "started": self.started,
            "completed": self.completed,
            "pending": len(self.pending_starts),
        }


def run(driver: WebDriver, timeout_seconds=30) -> dict:
    """Observe solve events for this navigation within a bounded polling window."""
    timeout = validate_timeout(timeout_seconds)
    state = SolveState()
    # Discard logs belonging to earlier navigation before starting this observation.
    driver.execute(Command.GET_LOG, {"type": "browser"})["value"]
    driver.set_page_load_timeout(min(30, timeout))
    driver.get("https://www.google.com/recaptcha/api2/demo")
    deadline = time.monotonic() + timeout

    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            if state.pending_starts:
                raise TimeoutError(
                    f"CAPTCHA observation timed out with {len(state.pending_starts)} pending solve(s)"
                )
            result = state.result("no_challenge_observed")
            print(result)
            return result
        entries = driver.execute(Command.GET_LOG, {"type": "browser"})["value"]
        # A delayed log request must not turn an expired observation into success.
        if time.monotonic() >= deadline:
            raise TimeoutError("Browser log request exceeded the CAPTCHA observation deadline")
        for entry in entries:
            state.handle_console(entry)
        if state.completed and not state.pending_starts:
            result = state.result("solved")
            print(result)
            return result
        time.sleep(min(0.5, max(0, deadline - time.monotonic())))


def main():
    timeout = validate_timeout(os.environ.get("CAPTCHA_TIMEOUT_SECONDS", "30"))
    connection = BrowserbaseConnection("https://connect.browserbase.com/webdriver")
    options = webdriver.ChromeOptions()
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    driver = webdriver.Remote(connection, options=options)
    try:
        print(
            "Connected to Browserbase",
            f"{driver.name} version {driver.caps['browserVersion']}",
        )
        return run(driver, timeout_seconds=timeout)
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
