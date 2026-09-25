"""Normalize observed links without inventing navigation targets."""
from urllib.parse import urljoin, urlsplit, urlunsplit


def normalize_product_url(value: object, source_url: str) -> str | None:
    if not isinstance(value, str) or not value or value != value.strip():
        return None
    if any(character.isspace() or ord(character) < 32 for character in value) or "\\" in value:
        return None
    if value.startswith("#"):
        return None
    try:
        raw = urlsplit(value)
        if not raw.scheme and not (value.startswith(("/", "./", "../", "?")) or "/" in raw.path):
            return None  # A bare product name is not evidence of a link.
        parsed = urlsplit(urljoin(source_url, value))
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username is not None or parsed.password is not None:
            return None
        port = parsed.port
        host = parsed.hostname.lower()
        if ":" in host:
            host = f"[{host}]"
        if port is not None and (parsed.scheme, port) not in (("http", 80), ("https", 443)):
            host += f":{port}"
        return urlunsplit((parsed.scheme, host, parsed.path or "/", parsed.query, ""))
    except ValueError:
        return None
