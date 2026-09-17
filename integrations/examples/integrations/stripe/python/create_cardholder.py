import os
import re

import dotenv
import stripe
from get_card import field, verify_holder


def read_config(env=None):
    env = os.environ if env is None else env
    api_key = env.get("STRIPE_API_KEY", "")
    idempotency_key = env.get("STRIPE_TEST_CARDHOLDER_KEY", "")
    if (not isinstance(api_key, str) or not re.fullmatch(r"sk_test_[A-Za-z0-9]+", api_key)
            or not isinstance(idempotency_key, str)
            or not re.fullmatch(r"[A-Za-z0-9-]{1,255}", idempotency_key)):
        raise ValueError("A test secret key and stable STRIPE_TEST_CARDHOLDER_KEY are required.")
    return api_key, idempotency_key


def verify_created_holder(holder, expected_id=None):
    holder_id = field(holder, "id")
    if (not isinstance(holder_id, str) or not re.fullmatch(r"ich_[A-Za-z0-9]+", holder_id)
            or (expected_id is not None and holder_id != expected_id)
            or field(holder, "type") != "individual"):
        raise ValueError("Test cardholder identity could not be verified.")
    verify_holder(holder, holder_id)
    return holder_id


def create_cardholder(env=None, stripe_factory=stripe.StripeClient):
    api_key, idempotency_key = read_config(env)
    client = stripe_factory(api_key, max_network_retries=0,
                            http_client=stripe.RequestsClient(timeout=30))
    created = client.v1.issuing.cardholders.create({
        "name": "Cookbook Example",
        "email": "cookbook@example.com",
        "phone_number": "+12025550123",
        "status": "active",
        "type": "individual",
        "individual": {
            "first_name": "Cookbook", "last_name": "Example",
            "dob": {"day": 1, "month": 1, "year": 1990},
        },
        "billing": {"address": {
            "line1": "123 Example Street", "city": "San Francisco", "state": "CA",
            "country": "US", "postal_code": "94111",
        }},
    }, {"idempotency_key": idempotency_key})
    holder_id = verify_created_holder(created)
    holder = client.v1.issuing.cardholders.retrieve(holder_id)
    verify_created_holder(holder, holder_id)
    return holder


def main():
    dotenv.load_dotenv()
    holder = create_cardholder()
    print(holder["id"])


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Test cardholder setup failed; inspect its requirements before retrying.")
        raise SystemExit(1) from None
