import os
import re

import dotenv
import stripe


def field(value, name, default=None):
    try:
        return value[name]
    except (KeyError, TypeError):
        return default


def verify_card(card, cardholder_id, status, expected_id=None):
    holder = field(card, "cardholder")
    holder_id = holder if isinstance(holder, str) else field(holder, "id")
    card_id = field(card, "id")
    if (not isinstance(card_id, str) or not re.fullmatch(r"ic_[A-Za-z0-9]+", card_id)
            or (expected_id is not None and card_id != expected_id)
            or field(card, "livemode") is not False or holder_id != cardholder_id
            or field(card, "status") != status):
        raise ValueError("Test card state could not be verified.")


def create_card(cardholder_id=None):
    api_key = os.getenv("STRIPE_API_KEY", "")
    if cardholder_id is None:
        cardholder_id = os.getenv("STRIPE_CARDHOLDER_ID", "")
    if not api_key.startswith("sk_test_") or len(api_key) <= len("sk_test_"):
        raise ValueError("STRIPE_API_KEY must be a test secret key.")
    if not isinstance(cardholder_id, str) or not re.fullmatch(r"ich_[A-Za-z0-9]+", cardholder_id):
        raise ValueError("STRIPE_CARDHOLDER_ID must be an explicit cardholder ID.")
    stripe.api_key = api_key
    cardholder = stripe.issuing.Cardholder.retrieve(cardholder_id)
    requirements = field(cardholder, "requirements")
    if (field(cardholder, "id") != cardholder_id or field(cardholder, "livemode") is not False
            or field(cardholder, "status") != "active"
            or field(requirements, "disabled_reason", object()) is not None
            or field(requirements, "past_due") != []):
        raise ValueError("Test cardholder is not ready to issue cards.")
    card = stripe.issuing.Card.create(
        cardholder=cardholder_id,
        currency="usd",
        type="virtual",
        status="inactive",
        spending_controls={
            "allowed_categories": ["charitable_and_social_service_organizations_fundraising"],
            "spending_limits": [{"amount": 7500, "interval": "daily"}],
        },
    )
    verify_card(card, cardholder_id, "inactive")
    if os.getenv("STRIPE_ACTIVATE_TEST_CARD") != "true":
        print("Test card created inactive:", card["id"])
        return card
    stripe.issuing.Card.modify(card["id"], status="active")
    active_card = stripe.issuing.Card.retrieve(card["id"])
    verify_card(active_card, cardholder_id, "active", card["id"])
    print("Test card verified active:", active_card["id"])
    return active_card


def main():
    dotenv.load_dotenv()
    return create_card()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Test card setup failed; inspect its state before retrying.")
        raise SystemExit(1) from None
