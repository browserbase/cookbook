"""Keep EDGAR navigation and extracted identity tied to one configured company."""

from dataclasses import dataclass
import re
from urllib.parse import parse_qsl, urlencode, urlsplit


def normalize_cik(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{1,10}", value.strip()) or int(value) == 0:
        raise ValueError("CIK must contain 1–10 digits and identify a nonzero company")
    return value.strip().zfill(10)


@dataclass(frozen=True)
class CompanyTarget:
    name: str
    cik: str
    search_query: str | None = None

    def __post_init__(self):
        if not isinstance(self.name, str) or not self.name.strip():
            raise ValueError("Company name must be nonempty")
        if self.search_query is not None and (not isinstance(self.search_query, str) or not self.search_query.strip()):
            raise ValueError("Search query must be nonempty when supplied")
        object.__setattr__(self, "cik", normalize_cik(self.cik))

    @property
    def query(self) -> str:
        return self.search_query if self.search_query is not None else self.name

    @property
    def browse_url(self) -> str:
        return "https://www.sec.gov/edgar/browse/?" + urlencode({"CIK": self.cik, "owner": "exclude"})


def validate_company_identity(company_name: str, cik: str, target: CompanyTarget) -> str:
    actual = normalize_cik(cik)
    if actual != target.cik:
        raise ValueError("Extracted CIK does not match the configured company")
    if not isinstance(company_name, str) or not company_name.strip():
        raise ValueError("The company header did not supply a name")
    return actual


def validate_company_page(value: str, target: CompanyTarget) -> None:
    url = urlsplit(value)
    ciks = [v for k, v in parse_qsl(url.query, keep_blank_values=True) if k.lower() == 'cik']
    if (url.scheme != 'https' or url.hostname != 'www.sec.gov' or url.username or url.password
            or url.port not in {None, 443} or url.path.rstrip('/') != '/edgar/browse'
            or len(ciks) != 1 or normalize_cik(ciks[0]) != target.cik):
        raise ValueError("The EDGAR page does not identify the configured company")
