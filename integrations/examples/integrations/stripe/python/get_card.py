import os
import re

import dotenv
import stripe


def field(value, name, default=None):
    try:
        return value[name]
    except (KeyError, TypeError):
        return default


def verify_card(card, card_id, holder_id):
    holder = field(card, "cardholder")
    actual_holder_id = holder if isinstance(holder, str) else field(holder, "id")
    if (field(card, "id") != card_id or field(card, "livemode") is not False
            or field(card, "status") != "active" or actual_holder_id != holder_id):
        raise ValueError("Active test card state could not be verified.")


def verify_holder(holder, holder_id):
    requirements = field(holder, "requirements")
    if (field(holder, "id") != holder_id or field(holder, "livemode") is not False
            or field(holder, "status") != "active"
            or field(requirements, "disabled_reason", object()) is not None
            or field(requirements, "past_due") != []):
        raise ValueError("Test cardholder is not ready to use cards.")


def getCard(card_id):
    api_key = os.getenv("STRIPE_API_KEY", "")
    holder_id = os.getenv("STRIPE_CARDHOLDER_ID", "")
    if not api_key.startswith("sk_test_") or len(api_key) <= len("sk_test_"):
        raise ValueError("STRIPE_API_KEY must be a test secret key.")
    if not isinstance(card_id, str) or not re.fullmatch(r"ic_[A-Za-z0-9]+", card_id):
        raise ValueError("An explicit issuing card ID is required.")
    if not re.fullmatch(r"ich_[A-Za-z0-9]+", holder_id):
        raise ValueError("STRIPE_CARDHOLDER_ID must be an explicit cardholder ID.")
    metadata = stripe.issuing.Card.retrieve(card_id, api_key=api_key)
    verify_card(metadata, card_id, holder_id)
    holder = stripe.issuing.Cardholder.retrieve(holder_id, api_key=api_key)
    verify_holder(holder, holder_id)
    card = stripe.issuing.Card.retrieve(card_id, expand=['number', 'cvc'], api_key=api_key)
    verify_card(card, card_id, holder_id)
    holder = field(card, "cardholder")
    verify_holder(holder, holder_id)
    name = field(holder, "name", "")
    names = name.split() if isinstance(name, str) else []
    number = field(card, "number")
    cvc = field(card, "cvc")
    month = field(card, "exp_month")
    year = field(card, "exp_year")
    address = field(field(holder, "billing"), "address")
    last4 = field(card, "last4")
    if (not names or not field(holder, "email") or not field(holder, "phone_number")
            or address is None or not isinstance(number, str) or not re.fullmatch(r"[0-9]{12,19}", number)
            or not isinstance(cvc, str) or not re.fullmatch(r"[0-9]{3,4}", cvc)
            or type(month) is not int or not 1 <= month <= 12
            or type(year) is not int or year < 2000
            or not field(card, "brand") or not field(card, "currency")
            or not isinstance(last4, str) or not re.fullmatch(r"[0-9]{4}", last4)):
        raise ValueError("Required test payment fields are unavailable.")
    return {
        'id': card['id'],
        'status': card['status'],
        'livemode': card['livemode'],
        'last4': last4,
        'cardholder_firstName': names[0],
        'cardholder_lastName': ' '.join(names[1:]),
        'cardholder_email': holder['email'],
        'cardholder_phone': holder['phone_number'],
        'cardholder_address': address,
        'card_number': number,
        'expiration_month': month,
        'expiration_year': str(year)[-2:],
        'cvc': cvc,
        'brand': card['brand'],
        'currency': card['currency'],
    }


def main():
    dotenv.load_dotenv()
    card = getCard(os.getenv("STRIPE_CARD_ID", ""))
    print("Verified test card:", {key: card[key] for key in ('id', 'status', 'last4')})


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Test card retrieval failed.")
        raise SystemExit(1) from None
