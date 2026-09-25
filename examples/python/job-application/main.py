"""Discover and submit test applications with Stagehand V4."""

import asyncio
import os
import random
import string
import time
from urllib.parse import urlsplit

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel, Field, HttpUrl

from stagehand import FilePayload, Stagehand, browserbase

load_dotenv()

JOB_BOARD_URL = "https://agent-job-board.vercel.app/"
RESUME_URL = f"{JOB_BOARD_URL}Agent%20Resume.pdf"


class JobInfo(BaseModel):
    url: HttpUrl = Field(description="Job URL")
    title: str = Field(min_length=1, description="Job title")


class JobsData(BaseModel):
    jobs: list[JobInfo]


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def generate_random_email() -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"agent-{suffix}@example.com"


def generate_agent_id() -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=7))
    return f"agent-{int(time.time() * 1000)}-{suffix}"


async def close_session(stagehand: Stagehand | None, browser: object) -> None:
    try:
        if stagehand is not None:
            await stagehand.close()
    finally:
        await browser.close()  # type: ignore[attr-defined]


async def checked_act(stagehand: Stagehand, instruction: str, **options) -> None:
    response = await stagehand.act(instruction, **options)
    if response.data.success is not True:
        raise RuntimeError("A required job-board action failed")


async def application_state(page) -> dict:
    return await page.evaluate("""(() => {
      const unique = selector => {
        const elements = document.querySelectorAll(selector);
        return elements.length === 1 ? elements[0] : null;
      };
      const visible = element => element && element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== 'hidden';
      const field = selector => {
        const element = unique(selector);
        return visible(element) ? element.value : null;
      };
      const upload = unique('#resume');
      const file = upload?.files?.length === 1 ? upload.files[0] : null;
      const yes = unique('#yes');
      return {
        name: field('#name'), email: field('#email'), region: field('#location'),
        resume: file ? {name: file.name, size: file.size, type: file.type} : null,
        multiRegion: visible(yes) && (yes.checked === true || yes.getAttribute('aria-checked') === 'true'),
        headings: [...document.querySelectorAll('h2')].filter(visible).map(e => e.innerText.trim()),
        paragraphs: [...document.querySelectorAll('p')].filter(visible).map(e => e.innerText.trim()),
        formCount: [...document.querySelectorAll('form')].filter(visible).length
      };
    })()""")


def validate_job_url(value: str) -> None:
    url = urlsplit(value)
    if (url.scheme != "https" or url.netloc != "agent-job-board.vercel.app"
            or not url.path.startswith("/jobs/") or not url.path[6:].isdigit()
            or url.query or url.fragment):
        raise RuntimeError("Expected a specific job URL on the demo board")


async def discover_jobs() -> list[JobInfo]:
    browser = await browserbase.launch(api_key=require_env("BROWSERBASE_API_KEY"))
    stagehand = None
    try:
        stagehand = await Stagehand.create(browser=browser)
        pages = await browser.context.pages()
        page = pages[0] if pages else await browser.context.new_page()
        await page.goto(JOB_BOARD_URL, wait_until="domcontentloaded", timeout=60_000)
        await checked_act(stagehand, "Click the View Jobs button", page=page)
        extracted = await stagehand.extract(
            "Extract every visible job listing with its title and absolute URL",
            JobsData,
            page=page,
        )
        jobs = extracted.data.jobs
        if not jobs:
            raise RuntimeError("The job board returned no job listings")
        return jobs
    finally:
        await close_session(stagehand, browser)


async def apply_to_job(job: JobInfo, resume: bytes, semaphore: asyncio.Semaphore) -> str:
    validate_job_url(str(job.url))
    if not resume.startswith(b"%PDF") or len(resume) > 5 * 1024 * 1024:
        raise RuntimeError("Expected a PDF resume of at most 5 MiB")
    async with semaphore:
        browser = await browserbase.launch(api_key=require_env("BROWSERBASE_API_KEY"))
        stagehand = None
        try:
            stagehand = await Stagehand.create(browser=browser)
            pages = await browser.context.pages()
            page = pages[0] if pages else await browser.context.new_page()
            await page.goto(str(job.url), wait_until="domcontentloaded", timeout=60_000)

            agent_id = generate_agent_id()
            email = generate_random_email()
            await checked_act(stagehand,
                "Fill the agent identifier field with %agent_id%",
                page=page,
                variables={"agent_id": agent_id},
            )
            await checked_act(stagehand,
                "Fill the contact endpoint field with %email%",
                page=page,
                variables={"email": email},
            )
            await checked_act(stagehand, "Fill the deployment region field with us-west-2", page=page)

            observed = await stagehand.observe(
                "Find the file input for the agent profile or resume",
                page=page,
            )
            if len(observed.data) != 1 or not observed.data[0].selector:
                raise RuntimeError(f"[{job.title}] Could not locate the resume upload input")
            upload = page.locator(observed.data[0].selector)
            if await upload.count() != 1:
                raise RuntimeError("Resume upload input is not unique")
            await upload.set_input_files(
                FilePayload(
                    name="Agent Resume.pdf",
                    buffer=resume,
                    mime_type="application/pdf",
                )
            )

            await checked_act(stagehand, "Select Yes for multi-region deployment", page=page)
            before = await application_state(page)
            if (await page.url() != str(job.url) or before.get("name") != agent_id
                    or before.get("email") != email or before.get("region") != "us-west-2"
                    or before.get("resume") != {"name": "Agent Resume.pdf", "size": len(resume), "type": "application/pdf"}
                    or before.get("multiRegion") is not True or before.get("formCount") != 1
                    or "Deployment Request Submitted!" in before.get("headings", [])):
                raise RuntimeError("Application fields or resume were not confirmed before submission")
            await checked_act(stagehand, "Click the Deploy Agent button", page=page)
            confirmed = False
            for _ in range(20):
                after = await application_state(page)
                messages = [text for text in after.get("paragraphs", [])
                            if text.startswith(f"Your application for {job.title} at ")
                            and text.endswith(" has been received. Deployment protocols will be initiated soon.")]
                if (await page.url() == str(job.url) and after.get("formCount") == 0
                        and after.get("headings") == ["Deployment Request Submitted!"]
                        and len(messages) == 1):
                    confirmed = True
                    break
                await page.wait_for_timeout(250)
            if not confirmed:
                raise RuntimeError("Demo submission confirmation was not observed; do not retry blindly")
        finally:
            await close_session(stagehand, browser)
        print(f"[{job.title}] Demo submission confirmed locally; no hiring-service delivery")
        return job.title


async def main() -> None:
    max_concurrency = max(1, int(os.environ.get("MAX_CONCURRENCY", "2")))
    max_jobs = int(os.environ.get("MAX_JOBS", "0"))
    jobs = await discover_jobs()
    if max_jobs > 0:
        jobs = jobs[:max_jobs]
    print(f"Discovered {len(jobs)} jobs; applying with concurrency {max_concurrency}")

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        response = await client.get(RESUME_URL)
        response.raise_for_status()
        resume = response.content
    if not resume.startswith(b"%PDF"):
        raise RuntimeError("The resume download was not a PDF")

    semaphore = asyncio.Semaphore(max_concurrency)
    results = await asyncio.gather(
        *(apply_to_job(job, resume, semaphore) for job in jobs),
        return_exceptions=True,
    )
    failures = [result for result in results if isinstance(result, BaseException)]
    print(f"Confirmed {len(results) - len(failures)} of {len(jobs)} demo submissions")
    if failures:
        raise RuntimeError(f"{len(failures)} of {len(jobs)} applications failed: {failures}")
    print("All demo confirmations checked; no hiring-service delivery was performed")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as error:
        print(f"Job application automation failed: {error}")
        print("Docs: https://docs.stagehand.dev/v4/first-steps/introduction")
        raise
