# Supply-chain portal login

Open an operator-configured portal in a Browserbase session, enter credentials, and leave the authenticated page available in Live View.

## Setup

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Set these values in an ignored local `.env`:

```dotenv
BROWSERBASE_API_KEY=
TMS_LOGIN_URL=https://portal.example.invalid/login
TMS_USERNAME=
TMS_PASSWORD=
```

Run:

```sh
python tms_portal.py
```

`test_tms_portal.py` verifies that missing configuration fails before allocating a browser session:

```sh
python -m unittest test_tms_portal.py
```

The script uses target-specific selectors and fixed waits. It does not verify successful authentication or perform any workflow after login.
