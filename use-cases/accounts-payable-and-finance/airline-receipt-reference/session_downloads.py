"""Bounded download transport shared by the receipt examples."""
from pathlib import Path
import re
import tempfile
import time

import requests

from safe_downloads import extract_download_archive

MAX_ARCHIVE_BYTES = 25 * 1024 * 1024
DOWNLOAD_SECONDS = 60


def download_session_files(session_id: str, download_dir: str, api_key: str) -> list[str]:
    if not isinstance(session_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", session_id):
        raise ValueError("Invalid session identifier")
    started = time.monotonic()
    with requests.get(
        f"https://api.browserbase.com/v1/sessions/{session_id}/downloads",
        headers={"X-BB-API-Key": api_key},
        stream=True,
        timeout=(5, 30),
        allow_redirects=False,
    ) as response:
        response.raise_for_status()
        if response.status_code != 200:
            raise ValueError("Unexpected download response")
        if response.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/zip":
            return []
        declared = response.headers.get("content-length")
        if declared is not None and (not declared.isdecimal() or int(declared) > MAX_ARCHIVE_BYTES):
            raise ValueError("Archive exceeds the download limit")
        with tempfile.TemporaryDirectory(prefix="cookbook-session-download-") as scratch:
            archive = Path(scratch) / "download.zip"
            size = 0
            with archive.open("xb") as destination:
                archive.chmod(0o600)
                for chunk in response.iter_content(chunk_size=64 * 1024):
                    size += len(chunk)
                    if size > MAX_ARCHIVE_BYTES or time.monotonic() - started > DOWNLOAD_SECONDS:
                        raise ValueError("Download exceeded its size or time limit")
                    destination.write(chunk)
            if time.monotonic() - started > DOWNLOAD_SECONDS:
                raise ValueError("Download exceeded its time limit")
            return extract_download_archive(archive, download_dir)
