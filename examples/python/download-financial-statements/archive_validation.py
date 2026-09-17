"""Verify the four pinned FY2025 Apple PDFs without extracting archive paths."""

import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import stat
from urllib.parse import urlsplit, unquote
import zipfile

STATEMENTS = json.loads(Path(__file__).with_name("statements.json").read_text())
MAX_ARCHIVE_BYTES = 32 * 1024 * 1024


def inspect_archive(payload: bytes, statements: dict | None = None) -> set[str]:
    expected = STATEMENTS if statements is None else statements
    if set(expected) != {"1", "2", "3", "4"}:
        raise ValueError("Expected a reference PDF for each of four quarters")
    by_digest = {item["sha256"]: quarter for quarter, item in expected.items()}
    if len(by_digest) != 4:
        raise ValueError("Quarter reference PDFs must be distinct")
    if len(payload) > MAX_ARCHIVE_BYTES:
        raise ValueError("Download archive exceeds 32 MiB")
    found = set()
    if not payload:
        return found
    try:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            entries = archive.infolist()
            if len(entries) > 32 or sum(entry.file_size for entry in entries) > MAX_ARCHIVE_BYTES:
                raise ValueError("Archive has too many entries or expanded bytes")
            names = set()
            for entry in entries:
                path = PurePosixPath(entry.filename)
                if (path.is_absolute() or ".." in path.parts or "\\" in entry.filename
                        or ":" in entry.filename or entry.filename in names
                        or stat.S_ISLNK(entry.external_attr >> 16)):
                    raise ValueError("Archive member path is unsafe or duplicated")
                names.add(entry.filename)
                if entry.is_dir():
                    continue
                data = archive.read(entry)
                if not data.startswith(b"%PDF-"):
                    raise ValueError("Archive contains a non-PDF member")
                quarter = by_digest.get(hashlib.sha256(data).hexdigest())
                if quarter is None:
                    raise ValueError("Archive contains an unrecognized or changed statement PDF")
                if quarter in found:
                    raise ValueError("Archive repeats a quarter instead of providing four distinct statements")
                found.add(quarter)
    except (zipfile.BadZipFile, RuntimeError, NotImplementedError) as error:
        raise ValueError("Download archive is corrupt or unsupported") from error
    return found


def validate_statement_urls(urls: list[str]) -> list[str]:
    if len(urls) != 4:
        raise ValueError("Expected four FY2025 statement URLs")
    quarters = {}
    for value in urls:
        url = urlsplit(value)
        allowed = url.hostname in {"www.apple.com", "images.apple.com", "investor.apple.com"}
        allowed = allowed or (url.hostname == "s2.q4cdn.com" and url.path.startswith("/470004039/"))
        if url.scheme != "https" or not allowed or url.username or url.password or url.port not in {None, 443}:
            raise ValueError("Expected an Apple statement URL")
        filename = unquote(url.path.rsplit("/", 1)[-1])
        matches = [q for q, item in STATEMENTS.items()
                   if filename == urlsplit(item["url"]).path.rsplit("/", 1)[-1]]
        if len(matches) != 1 or matches[0] in quarters:
            raise ValueError("Expected one identified FY2025 PDF link per quarter")
        quarters[matches[0]] = value
    return [quarters[str(q)] for q in range(4, 0, -1)]
