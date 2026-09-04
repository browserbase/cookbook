"""Browser automation for filling web forms during voice conversations.

This module provides the StagehandFormFiller class which manages browser
automation for filling forms using Stagehand. It handles form field
mapping, field filling, and form submission.
"""

import asyncio
import json
import os
from dataclasses import dataclass
from enum import Enum

from loguru import logger

from stagehand import Page, Stagehand, StagehandBrowser, browserbase


class FieldType(Enum):
    TEXT = "text"
    EMAIL = "email"
    PHONE = "phone"
    SELECT = "select"
    RADIO = "radio"
    CHECKBOX = "checkbox"
    TEXTAREA = "textarea"


@dataclass
class FormField:
    """Represents a form field with its metadata"""

    field_id: str
    field_type: FieldType
    label: str
    required: bool = False
    options: list[str] | None = None


class FormFieldMapping:
    """Maps conversation questions to actual form fields"""

    def __init__(self):
        self.field_mappings = {
            "full_name": FormField(
                field_id="full_name",
                field_type=FieldType.TEXT,
                label="What is your full name?",
                required=True,
            ),
            "email": FormField(
                field_id="email",
                field_type=FieldType.EMAIL,
                label="What is your email address?",
                required=True,
            ),
            "phone": FormField(
                field_id="phone",
                field_type=FieldType.PHONE,
                label="What is your phone number?",
                required=False,
            ),
            "work_eligibility": FormField(
                field_id="work_eligibility",
                field_type=FieldType.RADIO,
                label="Are you legally eligible to work in this country?",
                options=["Yes", "No"],
                required=True,
            ),
            "availability_type": FormField(
                field_id="availability",
                field_type=FieldType.RADIO,
                label="What's your availability?",
                options=["Temporary", "Part-time", "Full-time"],
                required=True,
            ),
            "additional_info": FormField(
                field_id="additional_info",
                field_type=FieldType.TEXTAREA,
                label="Anything else you'd like to let us know about you?",
                required=False,
            ),
            "role_selection": FormField(
                field_id="role_selection",
                field_type=FieldType.CHECKBOX,
                label="Which of these roles are you applying for?",
                options=[
                    "Sales manager",
                    "IT Support",
                    "Recruiting",
                    "Software engineer",
                    "Marketing specialist",
                ],
                required=True,
            ),
            "previous_experience": FormField(
                field_id="previous_experience",
                field_type=FieldType.RADIO,
                label=("Have you worked in a role similar to this one in the past?"),
                options=["Yes", "No"],
                required=True,
            ),
            "skills_experience": FormField(
                field_id="skills_experience",
                field_type=FieldType.TEXTAREA,
                label=(
                    "What relevant skills and experience do you have "
                    "that make you a strong candidate for this position?"
                ),
                required=True,
            ),
        }

    def get_form_field(self, question_id: str) -> FormField | None:
        """Get the form field mapping for a question ID.

        Args:
            question_id: The question identifier.

        Returns:
            The FormField object or None if not found.
        """
        return self.field_mappings.get(question_id)


class StagehandFormFiller:
    """Manages browser automation for filling forms using Stagehand"""

    def __init__(self, form_url: str, *, success_selector: str | None = None,
                 success_text: str | None = None):
        self.form_url = form_url
        self.success_selector = success_selector if success_selector is not None else os.environ.get("FORM_SUCCESS_SELECTOR", "")
        self.success_text = success_text if success_text is not None else os.environ.get("FORM_SUCCESS_TEXT", "")
        self.submission_state = "not_attempted"
        self.browser: StagehandBrowser | None = None
        self.stagehand: Stagehand | None = None
        self.page: Page | None = None
        self.is_initialized = False
        self.field_mapper = FormFieldMapping()
        self.collected_data: dict[str, str] = {}

    async def initialize(self) -> None:
        """Initialize Stagehand and open the form.

        Returns:
            None.
        """
        if self.is_initialized:
            return

        try:
            logger.info("Initializing Stagehand browser automation")

            api_key = os.environ.get("BROWSERBASE_API_KEY")
            if not api_key:
                raise RuntimeError("BROWSERBASE_API_KEY is required")
            self.browser = await browserbase.launch(api_key=api_key)
            self.stagehand = await Stagehand.create(
                browser=self.browser,
            )
            pages = await self.browser.context.pages()
            self.page = pages[0] if pages else await self.browser.context.new_page()

            # Navigate to form
            logger.info(f"Opening form: {self.form_url}")
            await self.page.goto(
                self.form_url,
                wait_until="domcontentloaded",
                timeout=60_000,
            )

            # Wait for form to load
            await asyncio.sleep(2)

            self.is_initialized = True
            logger.info("Browser automation initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Stagehand: {e}")
            raise

    async def fill_field(self, question_id: str, answer: str) -> bool:
        """Fill a specific form field based on the question ID and answer.

        Args:
            question_id: The question identifier.
            answer: The answer value to fill.

        Returns:
            True if field was filled successfully, False otherwise.
        """
        if not self.is_initialized:
            # Initialize asynchronously without blocking
            init_task = asyncio.create_task(self.initialize())
            await init_task

        try:
            if self.stagehand is None or self.page is None:
                raise RuntimeError("Stagehand form filler is not initialized")

            # Get field mapping
            field = self.field_mapper.get_form_field(question_id)
            if not field:
                logger.warning(f"No field mapping found for question: {question_id}")
                return False

            # Store and use the answer directly
            answer = answer.strip()
            self.collected_data[question_id] = answer

            logger.info(f"Async filling field '{field.label}' with: {answer}")

            # Use Stagehand's natural language API to fill the field
            act_variables = {"answer": answer}
            if field.field_type == FieldType.RADIO:
                act_variables = None
                instruction = (
                    f"Within the question '{field.label}', select the one option that best "
                    f"matches the user's spoken answer {answer!r}. Available options: "
                    f"{', '.join(field.options or [])}."
                )
            if field.field_type in [FieldType.TEXT, FieldType.EMAIL, FieldType.PHONE]:
                instruction = f"Fill the '{field.label}' field with %answer%"

            elif field.field_type == FieldType.TEXTAREA:
                instruction = f"Fill the '{field.label}' text area with %answer%"

            elif field.field_type == FieldType.SELECT:
                instruction = (
                    f"Within the question '{field.label}', click the option labeled %answer%"
                )

            elif field.field_type == FieldType.CHECKBOX:
                # For role selection, check the specific role checkbox
                if question_id == "role_selection":
                    instruction = "Check the %answer% checkbox"
                else:
                    # For other checkboxes, check/uncheck based on answer
                    if answer.lower() in ["yes", "true"]:
                        instruction = f"Check the '{field.label}' checkbox"
                    else:
                        instruction = f"Uncheck the '{field.label}' checkbox"

            result = None
            for attempt in range(2):
                try:
                    result = await self.stagehand.act(
                        instruction,
                        page=self.page,
                        variables=act_variables,
                    )
                    if result.data.success:
                        break
                except Exception:
                    result = None
                if attempt == 0:
                    await self.page.wait_for_timeout(750)

            if field.field_type == FieldType.RADIO and (result is None or not result.data.success):
                observed = await self.stagehand.observe(
                    f"Within the question {field.label!r}, find the one option that best "
                    f"matches the user's spoken answer {answer!r}. Available options: "
                    f"{', '.join(field.options or [])}.",
                    page=self.page,
                )
                if observed.data:
                    result = await self.stagehand.act(observed.data[0], page=self.page)

            if result is None:
                raise RuntimeError(f"Could not fill {field.label}")
            if not result.data.success:
                raise RuntimeError(result.data.message or f"Could not fill {field.label}")

            return True

        except Exception as e:
            logger.error(f"Error filling field {question_id}: {e}")
            return False

    async def _submission_page_state(self) -> dict:
        selector = json.dumps(self.success_selector)
        expected = json.dumps(" ".join(self.success_text.split()))
        state = await self.page.evaluate(r"""(() => {
          const visible = element => element.checkVisibility({checkVisibilityCSS: true, checkOpacity: true});
          const normalize = text => text.replace(/\s+/g, ' ').trim();
          const confirmations = [...document.querySelectorAll(""" + selector + """ )];
          const confirmed = confirmations.some(element => visible(element) && normalize(element.innerText || '') === """ + expected + """);
          const invalid = [...document.querySelectorAll('[aria-invalid="true"], input:invalid, select:invalid, textarea:invalid')].some(visible);
          return {confirmed, invalid};
        })()""")
        if not isinstance(state, dict) or type(state.get("confirmed")) is not bool or type(state.get("invalid")) is not bool:
            raise RuntimeError("Invalid page confirmation response")
        return state

    async def submit_form(self) -> bool:
        """Return true only after a new visible, exact page confirmation."""
        if self.submission_state == "confirmed":
            return True
        if self.submission_state == "unconfirmed":
            return False
        try:
            if self.stagehand is None or self.page is None:
                raise RuntimeError("Stagehand form filler is not initialized")
            if not self.success_selector.strip() or not self.success_text.strip():
                self.submission_state = "configuration_error"
                return False
            before = await asyncio.wait_for(self._submission_page_state(), timeout=2)
            if before["confirmed"]:
                self.submission_state = "unconfirmed"
                return False

            # An interrupted request may already have clicked; do not retry blindly.
            self.submission_state = "unconfirmed"
            result = await asyncio.wait_for(self.stagehand.act(
                "Click the form's submit button", page=self.page,
            ), timeout=30)
            if result.data.success is not True:
                return False

            async def confirm():
                while True:
                    state = await self._submission_page_state()
                    if state["invalid"]:
                        self.submission_state = "validation_failed"
                        return False
                    if state["confirmed"]:
                        self.submission_state = "confirmed"
                        return True
                    await asyncio.sleep(0.25)

            return await asyncio.wait_for(confirm(), timeout=10)
        except Exception:
            logger.warning("Form submission was not confirmed")
            return False

    async def cleanup(self) -> None:
        """Clean up browser resources.

        Returns:
            None.
        """
        if self.stagehand:
            try:
                await self.stagehand.close()
            except Exception as error:
                logger.error(f"Error closing Stagehand: {error}")
        if self.browser:
            try:
                await self.browser.close()
            except Exception as error:
                logger.error(f"Error closing browser: {error}")
        logger.info("Session ended")
