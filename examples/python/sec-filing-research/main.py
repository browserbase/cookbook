"""Extract recent SEC filings for one configured company with Stagehand V4."""

import asyncio
import json
import os

from dotenv import load_dotenv
from pydantic import BaseModel
from stagehand import Stagehand, browserbase
from company_identity import CompanyTarget, validate_company_identity, validate_company_page

load_dotenv()

TARGET_COMPANY = CompanyTarget(name="Apple Inc", cik="0000320193")
NUM_FILINGS = 5


class CompanyInfo(BaseModel):
    company_name: str
    cik: str


class Filing(BaseModel):
    type: str
    date: str
    description: str | None
    accession_number: str | None
    file_number: str | None


class Filings(BaseModel):
    filings: list[Filing]


async def main() -> None:
    target = TARGET_COMPANY
    if not isinstance(NUM_FILINGS, int) or isinstance(NUM_FILINGS, bool) or NUM_FILINGS < 1:
        raise ValueError("NUM_FILINGS must be a positive integer")
    api_key = os.environ.get("BROWSERBASE_API_KEY")
    if not api_key:
        raise RuntimeError("BROWSERBASE_API_KEY is required")

    browser = await browserbase.launch(api_key=api_key)
    try:
        stagehand = await Stagehand.create(
            browser=browser,
        )
        try:
            pages = await browser.context.pages()
            page = pages[0] if pages else await browser.context.new_page()
            await page.goto(
                "https://www.sec.gov/edgar/searchedgar/companysearch.html",
                wait_until="domcontentloaded",
                timeout=60_000,
            )
            try:
                await stagehand.act(
                    "Click the Company and Person Lookup search textbox",
                    page=page,
                )
                await stagehand.act(
                    "Fill the company search field with %query%",
                    page=page,
                    variables={"query": target.query},
                )
                await stagehand.act("Click the search submit button", page=page)
                await stagehand.act(
                    f"Click the company result for {target.name!r} with CIK {target.cik} to view its filings",
                    page=page,
                )
            except Exception as error:
                print(
                    f"Semantic SEC navigation did not complete; checking its postcondition: {error}"
                )
            page = await browser.context.active_page() or page
            if "/edgar/browse" not in await page.url():
                print(f"Opening the configured company directly by CIK {target.cik}")
                await page.goto(
                    target.browse_url,
                    wait_until="domcontentloaded",
                    timeout=60_000,
                )
            validate_company_page(await page.url(), target)
            company_result = await stagehand.extract(
                "Extract the official company name and numeric CIK from the page header",
                CompanyInfo,
                page=page,
            )
            verified_cik = validate_company_identity(company_result.data.company_name, company_result.data.cik, target)
            filings_result = await stagehand.extract(
                (
                    f"Extract the {NUM_FILINGS} most recent SEC filings from the filings table. "
                    "For each return its type, filing date, description, accession number, and "
                    "file or film number when shown."
                ),
                Filings,
                page=page,
            )
            filings = filings_result.data.filings[:NUM_FILINGS]

            result = {
                "company": company_result.data.company_name,
                "cik": verified_cik,
                "requested_company": {"name": target.name, "cik": target.cik},
                "search_query": target.query,
                "filings": [
                    {
                        **filing.model_dump(),
                        "description": filing.description or "",
                        "accession_number": filing.accession_number or "",
                        "file_number": filing.file_number or "",
                    }
                    for filing in filings
                ],
            }
            print(json.dumps(result, indent=2))
        finally:
            await stagehand.close()
    finally:
        await browser.close()
        print("Session closed successfully")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as error:
        print(f"SEC filing extraction failed: {error}")
        print("Docs: https://docs.stagehand.dev/v4/first-steps/introduction")
        raise
