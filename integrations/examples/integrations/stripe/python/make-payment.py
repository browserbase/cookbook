import os
import re
import uuid

import dotenv
import stripe
from browserbase import Browserbase
from playwright.sync_api import sync_playwright
from get_card import field, verify_card, verify_holder


def read_config(env=None):
    env = os.environ if env is None else env
    patterns = {
        "STRIPE_API_KEY": r"sk_test_[A-Za-z0-9]+",
        "STRIPE_CARD_ID": r"ic_[A-Za-z0-9]+",
        "STRIPE_CARDHOLDER_ID": r"ich_[A-Za-z0-9]+",
        "STRIPE_TEST_AUTHORIZATION_KEY": r"[A-Za-z0-9-]{1,255}",
    }
    if (any(not isinstance(env.get(key), str) or not re.fullmatch(pattern, env[key])
            for key, pattern in patterns.items())
            or any(not isinstance(env.get(key), str) or not env[key].strip()
                   for key in ("BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID"))):
        raise ValueError("Explicit test card, cardholder, browser, and authorization configuration is required.")
    return {key: env[key] for key in (*patterns, "BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID")}


def checkout_html(nonce):
    if not isinstance(nonce, str) or not re.fullmatch(r"[A-Za-z0-9-]+", nonce):
        raise ValueError("Invalid checkout nonce.")
    return '''<!doctype html><html lang="en"><meta charset="utf-8"><title>Cookbook sandbox checkout</title>
<body><h1>Cookbook sandbox checkout</h1><p>Test order: USD 10.00. No purchase or donation is made.</p>
<button id="confirm" type="button">Confirm test order</button><output id="receipt"></output>
<script>document.getElementById('confirm').addEventListener('click', () => {
const receipt = document.getElementById('receipt');
receipt.dataset.amount = '1000'; receipt.dataset.currency = 'usd'; receipt.dataset.nonce = '%s';
receipt.textContent = 'Test order confirmed';
});</script></body></html>''' % nonce


def verify_authorization(authorization, card_id, holder_id):
    card = field(authorization, "card")
    holder = field(authorization, "cardholder")
    actual_card = card if isinstance(card, str) else field(card, "id")
    actual_holder = holder if isinstance(holder, str) else field(holder, "id")
    authorization_id = field(authorization, "id")
    if (not isinstance(authorization_id, str) or not re.fullmatch(r"iauth_[A-Za-z0-9]+", authorization_id)
            or field(authorization, "livemode") is not False
            or actual_card != card_id or actual_holder != holder_id
            or type(field(authorization, "amount")) is not int or field(authorization, "amount") != 1000
            or field(authorization, "currency") != "usd"
            or field(authorization, "approved") is not True
            or field(authorization, "status") != "pending"):
        raise ValueError("Test authorization was declined or could not be verified.")


def run(playwright, env=None, stripe_factory=stripe.StripeClient, browserbase_factory=Browserbase):
    config = read_config(env)
    client = stripe_factory(config["STRIPE_API_KEY"], max_network_retries=0,
                            http_client=stripe.RequestsClient(timeout=30))
    card_id, holder_id = config["STRIPE_CARD_ID"], config["STRIPE_CARDHOLDER_ID"]
    verify_card(client.v1.issuing.cards.retrieve(card_id), card_id, holder_id)
    verify_holder(client.v1.issuing.cardholders.retrieve(holder_id), holder_id)
    bb = browserbase_factory(api_key=config["BROWSERBASE_API_KEY"], timeout=30, max_retries=0)
    session = bb.sessions.create(project_id=config["BROWSERBASE_PROJECT_ID"], api_timeout=300)
    browser = None
    failures = []
    try:
        browser = playwright.chromium.connect_over_cdp(session.connect_url, timeout=30_000)
        if not browser.contexts:
            raise ValueError("Browser context is unavailable.")
        page = browser.contexts[0].new_page()
        nonce = str(uuid.uuid4())
        page.set_content(checkout_html(nonce), timeout=30_000)
        page.locator("#confirm").click(timeout=30_000)
        receipt = page.locator("#receipt").evaluate('''element => ({
            amount: element.getAttribute('data-amount'), currency: element.getAttribute('data-currency'),
            nonce: element.getAttribute('data-nonce'), text: element.textContent,
        })''')
        if receipt != {"amount": "1000", "currency": "usd", "nonce": nonce, "text": "Test order confirmed"}:
            raise ValueError("The sandbox order receipt could not be verified.")
        authorization = client.v1.test_helpers.issuing.authorizations.create({
            "card": card_id, "amount": 1000, "currency": "usd", "authorization_method": "online",
            "merchant_data": {"category": "charitable_and_social_service_organizations_fundraising",
                              "name": "Cookbook Sandbox", "country": "US"},
        }, {"idempotency_key": config["STRIPE_TEST_AUTHORIZATION_KEY"]})
        verify_authorization(authorization, card_id, holder_id)
    except Exception as error:
        failures.append(error)
    finally:
        if browser is not None:
            try:
                browser.close()
            except Exception as error:
                failures.append(error)
        try:
            bb.sessions.update(session.id, project_id=config["BROWSERBASE_PROJECT_ID"], status="REQUEST_RELEASE")
        except Exception as error:
            failures.append(error)
    if failures:
        raise ExceptionGroup("Sandbox authorization workflow failed.", failures)
    print("Test authorization approved and pending. No purchase or donation was made.")


def main():
    dotenv.load_dotenv()
    read_config()
    with sync_playwright() as playwright:
        run(playwright)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Sandbox authorization failed.")
        raise SystemExit(1) from None
