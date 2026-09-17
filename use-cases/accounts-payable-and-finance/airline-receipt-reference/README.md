# Receipt retrieval examples

These examples retrieve airline receipt PDFs using traveler inputs. The Airline A variants share a bounded download transport and ZIP extractor. Treat traveler data, credentials, runtime caches, and downloaded receipts as sensitive.

## Setup and entrypoints

Use Python 3.11 or later on macOS or Linux. Install dependencies within this recipe:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Configure Browserbase and model credentials locally. The Airline A entrypoints use `BROWSERBASE_API_KEY`, `TRAVEL_FIRST_NAME`, `TRAVEL_LAST_NAME`, and `TRAVEL_TICKET_NUMBER`. Supply your own authorized traveler inputs; do not commit them.

```sh
python airline_a.py
# Alternative strategies:
python airline_a_cache.py
python airline_a_with_selectors.py
```

The other United and pre-browsing scripts have separate input and workflow requirements. Local ZIP checks do not verify those scripts or live airline receipt retrieval.

## Download behavior

`download_files_from_session` runs blocking HTTP and archive work in a worker thread. It returns file paths only after the complete batch passes validation, or an empty list when there are no downloads or a download fails. It logs a generic failure without printing archive contents or credentials.

Each successful batch is stored in a fresh `downloads/download-<random>/` directory. Callers must use the returned paths. Existing files are not overwritten. Directories use mode `0700` and files use mode `0600`.

The transport streams ZIP bytes with a 25 MiB limit, a 5-second connection timeout, a 30-second read timeout, and a 60-second elapsed-time check. The elapsed check runs between chunks; a pending read can extend that deadline by up to its read timeout. Redirects are rejected, and responses and temporary archives are closed on failure.

Before extraction, the helper checks every archive member. It rejects absolute or traversing paths, backslashes and drive paths, NUL names, symlinks, special files, encrypted entries, duplicate or case/Unicode-colliding names, and file/directory conflicts. Limits include:

- 100 members, including directory entries.
- 20 MiB per member and 100 MiB total extracted bytes.
- A maximum 100:1 compression ratio per member.

Extraction verifies CRCs and actual byte counts. A failed extraction removes its owned batch directory and returns no partial success. File operations use directory descriptors and `O_NOFOLLOW` to reject symlink redirection, including destination ancestors. Standard macOS `/var` and `/tmp` aliases are supported; other symlinked output paths are rejected. This is not isolation from another process running as the same user and renaming directories during extraction.

## Local verification

```sh
python -B -m unittest discover -s tests
```

Tests use synthetic ZIPs, temporary directories, and mocked HTTP responses. They exercise all three actual downloader functions, traversal and symlink rejection, collisions, size and time limits, CRC failure, owner-only file permissions, and successful nested extraction. No real environment files, traveler records, network requests, or Browserbase sessions are used. Live receipt retrieval remains unverified.
