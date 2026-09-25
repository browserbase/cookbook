"""Validate the returned identity and source reference, not the underlying record's truth."""

from collections.abc import Mapping
from urllib.parse import parse_qsl, urlencode, urlsplit


def business_query_url(name: str) -> str:
    if not isinstance(name, str) or not name.strip():
        raise ValueError("BUSINESS_NAME must be nonempty")
    return "https://data.sfgov.org/resource/g8m3-pdis.json?" + urlencode({"$q": name, "$limit": "5"})


def validate_record(record: Mapping[str, object], requested_name: str) -> None:
    expected_url = business_query_url(requested_name)
    name = record.get("dba_name")
    if not isinstance(name, str) or " ".join(name.split()).casefold() != " ".join(requested_name.split()).casefold():
        raise ValueError("Returned DBA does not match the requested business")
    account = record.get("business_account_number")
    if not isinstance(account, str) or not account.strip():
        raise ValueError("Returned business account number is missing")
    source = record.get("source_url")
    if not isinstance(source, str):
        raise ValueError("Returned source URL is missing")
    url = urlsplit(source)
    if (url.scheme != "https" or url.hostname != "data.sfgov.org"
            or url.username or url.password or url.port not in {None, 443}
            or url.path != "/resource/g8m3-pdis.json" or url.fragment
            or sorted(parse_qsl(url.query, keep_blank_values=True)) !=
               sorted(parse_qsl(urlsplit(expected_url).query, keep_blank_values=True))):
        raise ValueError("Returned source does not match the official requested query")
