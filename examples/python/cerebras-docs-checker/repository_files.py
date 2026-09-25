"""Read regular repository files without following model-selected symlinks."""
from contextlib import ExitStack
import os
from pathlib import Path, PureWindowsPath
import stat


def read_repository_file(root: Path, requested: object) -> str:
    if not isinstance(requested, str) or not requested or '\0' in requested:
        return 'Invalid repository-relative file path.'
    parts = requested.split('/')
    if requested.startswith('/') or PureWindowsPath(requested).drive or '..' in parts:
        return 'Only repository-relative paths without parent traversal are allowed.'
    parts = [part for part in parts if part and part != '.']
    if not parts:
        return 'A regular repository file is required.'
    if any(part.startswith('.') for part in parts) or parts[-1].lower() in {'credentials', 'credentials.json', 'secrets', 'secrets.json'} or Path(parts[-1]).suffix.lower() in {'.pem', '.key', '.p12', '.pfx', '.keystore'}:
        return 'Hidden files and credential files are not available to the verification agent.'
    if os.open not in os.supports_dir_fd or not all(hasattr(os, name) for name in ('O_NOFOLLOW', 'O_DIRECTORY', 'O_NONBLOCK')):
        return 'This platform does not support confined repository file reads.'
    try:
        with ExitStack() as stack:
            directory = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            stack.callback(os.close, directory)
            for part in parts[:-1]:
                directory = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
                stack.callback(os.close, directory)
            descriptor = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
            stack.callback(os.close, descriptor)
            if not stat.S_ISREG(os.fstat(descriptor).st_mode):
                return 'A regular repository file is required.'
            with os.fdopen(descriptor, 'r', encoding='utf-8', closefd=False) as content:
                return content.read(8000)
    except (OSError, ValueError, UnicodeError):
        return 'Unable to read a regular UTF-8 file inside the repository; symlinks are not followed.'
