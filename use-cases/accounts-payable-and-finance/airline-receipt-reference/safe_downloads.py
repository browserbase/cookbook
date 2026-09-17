"""Extract one bounded ZIP into a new private directory without replacing files."""

import ntpath
import os
from pathlib import Path
import secrets
import shutil
import stat
import unicodedata
import zipfile

MAX_MEMBERS = 100
MAX_MEMBER_BYTES = 20 * 1024 * 1024
MAX_TOTAL_BYTES = 100 * 1024 * 1024
MAX_COMPRESSION_RATIO = 100


def _members(archive):
    entries = archive.infolist()
    if not entries or len(entries) > MAX_MEMBERS:
        raise ValueError("Archive must contain between 1 and 100 members.")
    targets = {}
    members = []
    total = 0
    for info in entries:
        original = info.orig_filename
        if not original or "\x00" in original or "\\" in original or original.startswith("/") or ntpath.splitdrive(original)[0]:
            raise ValueError("Unsafe archive path.")
        name = original[:-1] if info.is_dir() else original
        parts = name.split("/")
        if any(not part or part in (".", "..") for part in parts):
            raise ValueError("Unsafe archive path component.")
        mode = info.external_attr >> 16
        kind = stat.S_IFMT(mode)
        if kind not in (0, stat.S_IFDIR if info.is_dir() else stat.S_IFREG):
            raise ValueError("Archive links and special files are not supported.")
        if info.flag_bits & 1:
            raise ValueError("Encrypted archive members are not supported.")
        key = tuple(unicodedata.normalize("NFKC", part).casefold() for part in parts)
        if key in targets:
            raise ValueError("Duplicate or colliding archive paths.")
        targets[key] = info.is_dir()
        if info.file_size < 0 or info.compress_size < 0 or info.file_size > MAX_MEMBER_BYTES:
            raise ValueError("Archive member exceeds the size limit.")
        if info.is_dir() and info.file_size:
            raise ValueError("Archive directories must be empty.")
        if info.file_size > MAX_COMPRESSION_RATIO * info.compress_size:
            raise ValueError("Archive member exceeds the compression ratio limit.")
        total += info.file_size
        if total > MAX_TOTAL_BYTES:
            raise ValueError("Archive exceeds the total size limit.")
        members.append((info, parts))
    for key in targets:
        for length in range(1, len(key)):
            if targets.get(key[:length]) is False:
                raise ValueError("An archive file conflicts with a directory path.")
    if not any(not info.is_dir() for info, _ in members):
        raise ValueError("Archive contains no regular files.")
    # Check aliases in implicit directories as well as complete member paths.
    prefixes = {}
    for _, parts in members:
        for length in range(1, len(parts) + 1):
            actual = tuple(parts[:length])
            normalized = tuple(unicodedata.normalize("NFKC", part).casefold() for part in actual)
            if normalized in prefixes and prefixes[normalized] != actual:
                raise ValueError("Archive directory names collide.")
            prefixes[normalized] = actual
    return members


def _open_directory(parent_fd, name, create=False):
    if create:
        try:
            os.mkdir(name, mode=0o700, dir_fd=parent_fd)
        except FileExistsError:
            pass
    return os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent_fd)


def _open_root(download_dir):
    selected = os.path.abspath(os.fspath(download_dir))
    # macOS exposes these system aliases; arbitrary user symlinks remain rejected.
    for alias, canonical in (("/var", "/private/var"), ("/tmp", "/private/tmp")):
        if (selected == alias or selected.startswith(alias + "/")) and os.path.islink(alias) and os.path.realpath(alias) == canonical:
            selected = canonical + selected[len(alias):]
            break
    descriptor = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in Path(selected).parts[1:]:
            child = _open_directory(descriptor, part, create=True)
            os.close(descriptor)
            descriptor = child
        return descriptor, Path(selected)
    except BaseException:
        os.close(descriptor)
        raise


def _parent_directory(root_fd, parts):
    descriptor = os.dup(root_fd)
    try:
        for part in parts:
            child = _open_directory(descriptor, part, create=True)
            os.close(descriptor)
            descriptor = child
        return descriptor
    except BaseException:
        os.close(descriptor)
        raise


def extract_download_archive(archive_path: Path, download_dir: str) -> list[str]:
    """Return regular-file paths only after CRC and size checks pass for all members.

    Each call owns a fresh directory inside download_dir. Existing content is never
    overwritten. Directory descriptors and O_NOFOLLOW prevent symlink redirection.
    This helper requires Python 3.11+ on POSIX with directory-descriptor support.
    """
    archive_fd = os.open(archive_path, os.O_RDONLY | os.O_NOFOLLOW)
    if not stat.S_ISREG(os.fstat(archive_fd).st_mode):
        os.close(archive_fd)
        raise ValueError("Archive must be a regular file.")
    with os.fdopen(archive_fd, "rb") as source, zipfile.ZipFile(source) as archive:
        members = _members(archive)
        root_fd, root_path = _open_root(download_dir)
        staging_name = "download-" + secrets.token_hex(16)
        staging_fd = None
        created = False
        committed = False
        try:
            os.mkdir(staging_name, mode=0o700, dir_fd=root_fd)
            created = True
            staging_fd = _open_directory(root_fd, staging_name)
            paths = []
            total = 0
            for info, parts in members:
                parent_fd = _parent_directory(staging_fd, parts if info.is_dir() else parts[:-1])
                try:
                    if info.is_dir():
                        with archive.open(info, "r") as content:
                            if content.read(1):
                                raise ValueError("Archive directories must be empty.")
                        continue
                    output_fd = os.open(parts[-1], os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                                        0o600, dir_fd=parent_fd)
                    written = 0
                    with os.fdopen(output_fd, "wb") as output, archive.open(info, "r") as content:
                        while True:
                            chunk = content.read(64 * 1024)
                            if not chunk:
                                break
                            written += len(chunk)
                            total += len(chunk)
                            if written > info.file_size or written > MAX_MEMBER_BYTES or total > MAX_TOTAL_BYTES:
                                raise ValueError("Extracted data exceeds archive size limits.")
                            output.write(chunk)
                    if written != info.file_size:
                        raise ValueError("Extracted file size does not match archive metadata.")
                    paths.append(str(root_path.joinpath(staging_name, *parts)))
                finally:
                    os.close(parent_fd)
            committed = True
            return paths
        finally:
            if staging_fd is not None:
                os.close(staging_fd)
            try:
                if created and not committed:
                    # rmtree's dir_fd form uses fd-relative, symlink-resistant removal.
                    shutil.rmtree(staging_name, dir_fd=root_fd)
            finally:
                os.close(root_fd)
