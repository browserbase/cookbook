'''
Browserbase Python SDK Examples

This file demonstrates how to use Browserbase's Python SDK to:
- Create and manage browser sessions
- Configure Verified and anti-bot features
- Set up proxies and fingerprinting
- Handle contexts and metadata
- Monitor and debug sessions

Setup Instructions:
1. Set up environment variables in .env:
   BROWSERBASE_API_KEY=your_api_key

2. Install dependencies:
   pip install browserbase requests python-dotenv

3. Import functions in your scripts:
   from core_utils import *

See function documentation below for detailed configuration options.
'''
import os
import requests
from browserbase import Browserbase

bb = Browserbase(api_key=os.environ["BROWSERBASE_API_KEY"])

# CREATE A SESSION
def create_session():
    session = bb.sessions.create(
        # Add configuration options here
    )
    return session

# CREATE A CUSTOM-FINGERPRINT SESSION
def create_custom_fingerprint_session():
    session = bb.sessions.create(
        proxies=True,
        browser_settings={
            "verified": False,  # Disable Verified when supplying a custom fingerprint and viewport
            "fingerprint": {
                "browsers": ["chrome", "firefox", "edge", "safari"],
                "devices": ["desktop", "mobile"],
                "locales": ["en-US", "en-GB"],
                "operating_systems": ["android", "ios", "linux", "macos", "windows"],
                "screen": {
                    "max_width": 1920,
                    "max_height": 1080,
                    "min_width": 1024,
                    "min_height": 768,
                }
            },
            "viewport": {
                "width": 1920,
                "height": 1080,
            },
            "solve_captchas": True,
        }
    )
    return session

# CREATE HIGH SECURITY SESSION - No session recording and no logs
def create_high_security_session():
    session = bb.sessions.create(
        browser_settings={
            "record_session": False,
            "log_session": False,
        },
    )
    return session

# CREATE SESSION WITH METADATA
def create_session_with_metadata():
    session = bb.sessions.create(
        user_metadata={
            "key": "value",
            "key2": {
                "keyA": "valueA",
                "keyB": "valueB"
            }
        },
    )
    return session

# CREATE A CUSTOM CAPTCHA SESSION
def create_custom_captcha_session(image_selector, input_selector):
    # Create a new session
    session = bb.sessions.create(
        browser_settings={
            "captcha_image_selector": image_selector,  # should look like this: "#c_turingtestpage_ctl00_maincontent_captcha1_CaptchaImage"
            "captcha_input_selector": input_selector  # should look like this: "#ctl00_MainContent_txtTuringText"
        }
    )
    return session

# CREATE A SESSION WITHOUT CAPTCHA SOLVING
def create_session_without_captcha_solving():
    session = bb.sessions.create(
        browser_settings={"solveCaptchas": False},
    )
    return session

# CREATE A CONTEXT
def create_context():
    import requests
    import json
    
    headers = {
        'X-BB-API-Key': os.environ["BROWSERBASE_API_KEY"],
        'Content-Type': 'application/json'
    }
    payload = json.dumps({})
    
    response = requests.post("https://api.browserbase.com/v1/contexts", headers=headers, data=payload)
    return response.json()

# USE A CONTEXT
def use_context(context_id):
    session = bb.sessions.create(
        browser_settings={
            "context": {
                "id": context_id,
                "persist": True
            }
        }
    )
    return session

# CREATE SESSION - ALL PARAMS
def create_session_all_params():
    session = bb.sessions.create(
        browser_settings={
            # "verified": True,
            # "context": {
            #    "id": "<contextId>",
            #    "persist": True
            # },
            # "extension_id": "<extensionId>",
            "fingerprint": {
                "browsers": ["chrome", "firefox", "edge", "safari"],
                "devices": ["desktop", "mobile"],
                "locales": ["en-US", "en-GB"],
                "operating_systems": ["android", "ios", "linux", "macos", "windows"],
                "screen": {
                    "max_width": 1920,
                    "max_height": 1080,
                    "min_width": 1024,
                    "min_height": 768,
                }
            },
            "viewport": {
                "width": 1920,
                "height": 1080,
            },
            "block_ads": True,
            "solve_captchas": True,
            "record_session": True,
            "log_session": True,
            # "timeout": 10000,
            # "region": "us-east-1",
        },
        keep_alive=True,
        proxies=True,
        user_metadata={
            "key": "value"
        },
    )
    return session

# GET LIVE DEBUG URL
def get_live_debug_url(session_id):
    headers = {'X-BB-API-Key': os.environ["BROWSERBASE_API_KEY"]}
    response = requests.get(f"https://api.browserbase.com/v1/sessions/{session_id}/debug", headers=headers)
    json_response = response.json()
    return json_response["debuggerUrl"]


# GET PROJECT LIST
def get_project_list():
    headers = {'X-BB-API-Key': os.environ["BROWSERBASE_API_KEY"]}
    response = requests.get("https://api.browserbase.com/v1/projects", headers=headers)
    return response.json()

# GET PROJECT USAGE
def get_project_usage(project_id):
    headers = {'X-BB-API-Key': os.environ["BROWSERBASE_API_KEY"]}
    response = requests.get(f"https://api.browserbase.com/v1/projects/{project_id}/usage", headers=headers)
    return response.json()

# GET SESSION DETAILS
def get_session_details(session_id):
    headers = {'X-BB-API-Key': os.environ["BROWSERBASE_API_KEY"]}
    response = requests.get(f"https://api.browserbase.com/v1/sessions/{session_id}", headers=headers)
    return response.json()

# GET SESSION LOGS
def get_session_logs(session_id):
    headers = {'X-BB-API-Key': os.environ["BROWSERBASE_API_KEY"]}
    response = requests.get(f"https://api.browserbase.com/v1/sessions/{session_id}/logs", headers=headers)
    return response.json()

# GET SESSION RECORDING
def get_session_recording(session_id):
    headers = {'X-BB-API-Key': os.environ["BROWSERBASE_API_KEY"]}
    response = requests.get(f"https://api.browserbase.com/v1/sessions/{session_id}/recording", headers=headers)
    return response.json()
