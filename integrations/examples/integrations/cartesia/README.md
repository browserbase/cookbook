# Voice Agent with Real-time Web Form Filling

This project demonstrates an advanced voice agent that conducts phone questionnaires while automatically filling out web forms in real-time using Stagehand browser automation.

Here's what the system architecture looks like:

![Workflow](workflow_diagram.png)

## Features

- **Voice Conversations**: Natural voice interactions using Cartesia Line
- **Real-time Form Filling**: Automatically fills web forms as answers are collected
- **Browser Automation**: Uses Stagehand AI to interact with any web form
- **Intelligent Mapping**: AI-powered mapping of voice answers to form fields
- **Async Processing**: Non-blocking form filling maintains conversation flow - form fields are filled in background tasks without delaying voice responses
- **Auto-submission**: Submits forms automatically when complete

## Architecture

```
Voice Call (Cartesia) → Form Filling Node → Records Answer
                              ↓
                     Stagehand Browser API
                              ↓
                     Fills Web Form Field
                              ↓
                     Continues Conversation
                              ↓
                     Submits Form on Completion
```

## Getting Started

First things first, here is what you will need:
- A [Cartesia](https://play.cartesia.ai/agents) account and API key
- A [Gemini API Key](https://aistudio.google.com/apikey)
- A [Browserbase API Key and Project ID](https://www.browserbase.com/overview) 

Make sure to add the API keys in your `.env` file or to the API keys section in your Cartesia account.

- Required packages:
  ```bash
  cartesia-line
  stagehand>=0.5.4
  google-genai>=1.26.0
  python-dotenv>=1.0.0
  PyYAML>=6.0.0
  loguru>=0.7.0
  aiohttp>=3.12.0
  pydantic>=2.0.0
  ```

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables - create a `.env` file:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
BROWSERBASE_API_KEY=your_browserbase_api_key_here
BROWSERBASE_PROJECT_ID=your_browserbase_project_id_here
```

3. Run the agent:
```bash
python main.py
```

## Project Structure

### `main.py`
Entry point for the voice agent. Handles call initialization with `VoiceAgentApp` class and orchestrates the conversation flow with form filling integration.

### `form_filling_node.py`
ReasoningNode subclass customized for voice-optimized form filling. Integrates Stagehand browser automation and manages async form filling during conversation without blocking the voice flow. Provides status updates and error handling.

### `stagehand_form_filler.py`
Browser automation manager that handles all web interactions. Opens and controls web forms, maps conversation data to form fields using AI, transforms voice answers to form-compatible formats, and handles form submission. Supports different field types (text, select, checkbox, etc.).

### `config.py`
System configuration file including system prompts, model IDs, and temperature

### `config.toml`
Your Cartesia Line agent id.

## Configuration

The system can be configured through multiple files:

- **`config.py`**: System prompts, model IDs (Gemini model selection), hyperparameters, and boolean flags for features
- **`config.toml`** / **YAML files**: Questionnaire structure and questions flow
- **`cartesia.toml`**: Deployment configuration for Cartesia platform (installs dependencies and runs the script)
- **Variables**:
  - `FORM_URL`: Target web form to fill

## Example Flow

1. User calls the voice agent
2. Agent asks: "What type of voice agent are you building?"
3. User responds: "A customer service agent"
4. System:
   - Records the answer
   - Opens browser to form (if not already open)
   - Fills "Customer Service" in the role selection field
   - Takes screenshot for debugging
5. Agent asks next question
6. Process continues until all questions answered
7. Form is automatically submitted

## Advanced Features

- **Background Processing**: Form filling happens asynchronously using background tasks - conversation remains smooth and responsive
- **Error Recovery**: Continues conversation even if form filling fails
- **Progress Tracking**: Monitor form completion status
- **Screenshot Debugging**: Captures screenshots after each field
- **Flexible Mapping**: AI interprets answers for different field types

## Deploying the Agent

The `cartesia.toml` file defines how your agent will be installed and run when deployed on the Cartesia platform. This file tells the platform to install dependencies from `requirements.txt` and execute `main.py`.

You can clone this repository and add it to your [agents dashboard](https://play.cartesia.ai/agents) along with your API Keys (set them in the Cartesia Platform's API keys section).

For detailed deployment instructions, see [how to deploy an agent from the Cartesia Docs](https://docs.cartesia.ai/line/start-building/talk-to-your-first-agent).

## Testing

Test with different scenarios:
- Complete questionnaire flow
- Interruptions and corrections
- Various answer formats
- Multi-page forms
- Form validation errors

## Production Considerations

- Configure proper error logging
- Add retry logic for form submission
- Implement form validation checks
- Consider rate limiting for API calls
### Field completion and call-end behavior

Answers are queued while the conversation continues. Browser updates run in order, and submission waits up to 60 seconds for pending field updates. The node requires every required answer and successful browser fill results for all collected answers. A failed fill keeps a retryable error; while the call is active, the agent returns to a failed or missing question. Re-answering it queues a replacement update.

On call end, the node stops accepting answers, waits for pending work, and submits only a complete form that has not already had a submission attempt. An incomplete form is left unsubmitted. Browser cleanup follows task settlement; cancellation cancels and awaits outstanding work. A failed or uncertain submission is not automatically repeated during cleanup. Submission confirmation itself is a separate browser-result requirement; field lifecycle tests do not establish that a real application was accepted.

Offline lifecycle checks (no credentials, voice calls, or form submissions):

```bash
python3 -B -m unittest discover -s tests
```

These tests execute the actual node class with external voice/browser imports stubbed, covering delayed final fills, ordered corrections, failed-fill retry, premature call end, repeated cleanup, initialization failure, cancellation, and uncertain submission cleanup. They do not run the live voice SDK or hosted form.

### Confirming submission

Set `FORM_SUCCESS_SELECTOR` to a unique CSS selector for your form's post-submission confirmation and `FORM_SUCCESS_TEXT` to its exact visible text. Verify these against a form you control before running the voice workflow. Both are required before the helper will click Submit. For example, a local test form might use `#submission-confirmation` and `Application received`; these are illustrative values, not verified selectors for the hosted example.

The helper rejects an already-visible confirmation before clicking, then waits up to ten seconds for a new visible exact-text match. Visible native-invalid or `aria-invalid` fields take precedence over confirmation. A failed click, malformed observation, timeout, or missing confirmation returns false. An uncertain attempt is not clicked again automatically, including during call-end cleanup; inspect the form before starting another attempt. An explicit validation failure can be retried after correcting the fields. A confirmed result is reused without another click.

This verifies the page's confirmation message, not a separate backend receipt. Custom forms must expose a reliable visible confirmation. The offline tests cover the helper and the node's final voice response using synthetic page observations; no hosted form submission has been performed.
