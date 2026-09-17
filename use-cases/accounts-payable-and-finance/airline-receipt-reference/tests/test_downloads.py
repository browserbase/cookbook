import ast
import asyncio
import io
import os
from pathlib import Path
import stat
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import safe_downloads
import session_downloads


def archive_bytes(entries, compression=zipfile.ZIP_STORED):
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w', compression=compression) as archive:
        for name, content in entries:
            archive.writestr(name, content)
    return data.getvalue()


class Response:
    def __init__(self, content, status=200, headers=None):
        self.content = content
        self.status_code = status
        self.headers = headers or {'content-type': 'application/zip; charset=binary'}
        self.closed = False
    def __enter__(self):
        return self
    def __exit__(self, *args):
        self.closed = True
    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError('Synthetic HTTP error')
    def iter_content(self, chunk_size):
        for i in range(0, len(self.content), chunk_size):
            yield self.content[i:i + chunk_size]


class DownloadTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix='cookbook-r172-test-')
        self.addCleanup(self.scratch.cleanup)
        self.base = Path(self.scratch.name).resolve()
        self.destination = self.base / 'downloads'
        self.archive = self.base / 'fixture.zip'
    def extract(self, entries):
        self.archive.write_bytes(archive_bytes(entries))
        return safe_downloads.extract_download_archive(self.archive, str(self.destination))
    def test_valid_nested_files_are_private_and_existing_files_stay_untouched(self):
        self.destination.mkdir()
        (self.destination / 'receipt.pdf').write_text('Existing fixture')
        saved = self.extract([('nested/receipt.pdf', b'%PDF-SYNTHETIC'), ('other.txt', b'SYNTHETIC')])
        self.assertEqual(len(saved), 2)
        for file in map(Path, saved):
            self.assertTrue(file.resolve().is_relative_to(self.destination.resolve()))
            self.assertEqual(stat.S_IMODE(file.stat().st_mode), 0o600)
        self.assertEqual((self.destination / 'receipt.pdf').read_text(), 'Existing fixture')
    def test_bad_paths_reject_whole_archive_without_partial_files(self):
        for name in ['../outside.txt', '/absolute.txt', 'nested/../../outside.txt', 'a\\..\\outside.txt', 'C:/outside.txt', './dot.txt', 'a//empty.txt']:
            with self.subTest(name=name):
                with self.assertRaises(Exception):
                    self.extract([('good.txt', b'SYNTHETIC'), (name, b'SYNTHETIC')])
                self.assertFalse((self.base / 'outside.txt').exists())
                self.assertEqual(list(self.destination.rglob('*')) if self.destination.exists() else [], [])
    def test_archive_symlinks_and_special_members_are_rejected(self):
        for mode in [stat.S_IFLNK | 0o777, stat.S_IFIFO | 0o600]:
            info = zipfile.ZipInfo('link')
            info.create_system = 3
            info.external_attr = mode << 16
            with self.assertRaises(Exception):
                self.extract([(info, b'../outside')])
    def test_duplicate_case_and_file_directory_collisions_rejected(self):
        for names in [('a.txt', 'a.txt'), ('a.txt', 'A.txt'), ('a', 'a/b.txt'), ('a/b.txt', 'a')]:
            with self.subTest(names=names):
                with self.assertRaises(Exception):
                    self.extract([(name, b'SYNTHETIC') for name in names])
    def test_symlink_destination_is_rejected(self):
        outside = self.base / 'outside'
        outside.mkdir()
        self.destination.symlink_to(outside, target_is_directory=True)
        with self.assertRaises(Exception):
            self.extract([('marker', b'SYNTHETIC')])
        self.assertEqual(list(outside.iterdir()), [])
    def test_member_size_limit(self):
        with patch.object(safe_downloads, 'MAX_MEMBER_BYTES', 4):
            with self.assertRaises(Exception):
                self.extract([('large', b'SYNTHETIC')])
    def test_total_size_limit(self):
        with patch.object(safe_downloads, 'MAX_TOTAL_BYTES', 10):
            with self.assertRaises(Exception):
                self.extract([('one', b'123456'), ('two', b'123456')])
    def test_member_count_limit(self):
        with patch.object(safe_downloads, 'MAX_MEMBERS', 1):
            with self.assertRaises(Exception):
                self.extract([('one', b'1'), ('two', b'2')])
    def test_compression_ratio_limit(self):
        self.archive.write_bytes(archive_bytes([('bomb', b'0' * 65536)], zipfile.ZIP_DEFLATED))
        with self.assertRaises(Exception):
            safe_downloads.extract_download_archive(self.archive, str(self.destination))
    def test_corrupt_crc_cleans_whole_batch(self):
        data = archive_bytes([('first', b'FIRST-SYNTHETIC'), ('last', b'LAST-SYNTHETIC')])
        self.archive.write_bytes(data.replace(b'LAST-SYNTHETIC', b'FAIL-SYNTHETIC'))
        with self.assertRaises(Exception):
            safe_downloads.extract_download_archive(self.archive, str(self.destination))
        self.assertEqual(list(self.destination.rglob('*')) if self.destination.exists() else [], [])
    def test_ancestor_symlink_is_rejected(self):
        outside = self.base / 'outside'
        outside.mkdir()
        link = self.base / 'alias'
        link.symlink_to(outside, target_is_directory=True)
        self.destination = link / 'downloads'
        with self.assertRaises(Exception):
            self.extract([('marker', b'SYNTHETIC')])
        self.assertEqual(list(outside.iterdir()), [])
    def test_nul_in_original_member_name_is_rejected(self):
        self.archive.write_bytes(archive_bytes([('badXname', b'SYNTHETIC')]).replace(b'badXname', b'bad\x00name'))
        with self.assertRaises(Exception):
            safe_downloads.extract_download_archive(self.archive, str(self.destination))
        self.assertFalse(self.destination.exists())
    def test_unicode_aliases_and_implicit_directory_collisions(self):
        for names in [('caf\u00e9.txt', 'cafe\u0301.txt'), ('Folder/a', 'folder/b')]:
            with self.subTest(names=names):
                with self.assertRaises(Exception):
                    self.extract([(name, b'SYNTHETIC') for name in names])
    def test_explicit_directories_and_empty_files_are_supported(self):
        saved = self.extract([('folder/', b''), ('folder/empty.txt', b'')])
        self.assertEqual(len(saved), 1)
        self.assertEqual(Path(saved[0]).read_bytes(), b'')
    def test_transport_deadline_closes_response_and_does_not_extract(self):
        response = Response(b'SYNTHETIC')
        with patch.object(session_downloads.requests, 'get', return_value=response), patch.object(session_downloads.time, 'monotonic', side_effect=[0, 61]):
            with self.assertRaises(ValueError):
                session_downloads.download_session_files('synthetic', str(self.destination), 'synthetic')
        self.assertTrue(response.closed)
        self.assertFalse(self.destination.exists())
    def test_transport_streams_with_limits_and_closes_response(self):
        response = Response(archive_bytes([('receipt', b'SYNTHETIC')]))
        with patch.object(session_downloads.requests, 'get', return_value=response) as get:
            saved = session_downloads.download_session_files('synthetic-session', str(self.destination), 'synthetic-key')
        self.assertEqual(len(saved), 1)
        self.assertTrue(response.closed)
        self.assertEqual(get.call_args.kwargs['timeout'], (5, 30))
        self.assertFalse(get.call_args.kwargs['allow_redirects'])
        self.assertTrue(get.call_args.kwargs['stream'])
    def test_transport_declared_and_streaming_size_limits(self):
        for headers in [{'content-type': 'application/zip', 'content-length': '1000'}, {'content-type': 'application/zip'}]:
            response = Response(b'123456', headers=headers)
            with patch.object(session_downloads, 'MAX_ARCHIVE_BYTES', 4), patch.object(session_downloads.requests, 'get', return_value=response):
                with self.assertRaises(ValueError):
                    session_downloads.download_session_files('synthetic', str(self.destination), 'synthetic')
            self.assertTrue(response.closed)
            self.assertFalse(self.destination.exists())
    def test_non_zip_and_redirect_responses_do_not_extract(self):
        for response in [Response(b'none', headers={'content-type': 'application/json'}), Response(b'', status=302)]:
            with patch.object(session_downloads.requests, 'get', return_value=response):
                if response.status_code == 302:
                    with self.assertRaises(ValueError):
                        session_downloads.download_session_files('synthetic', str(self.destination), 'synthetic')
                else:
                    self.assertEqual(session_downloads.download_session_files('synthetic', str(self.destination), 'synthetic'), [])
            self.assertFalse(self.destination.exists())
    def test_three_actual_wrappers_reject_traversal_and_accept_valid_archive(self):
        for filename in ['airline_a.py', 'airline_a_cache.py', 'airline_a_with_selectors.py']:
            source = (Path(os.environ['COOKBOOK_R172_BASELINE']) / ('cookbook-r172-before-' + filename) if os.environ.get('COOKBOOK_R172_BASELINE') else ROOT / filename).read_text()
            function = next(n for n in ast.parse(source).body if isinstance(n, ast.AsyncFunctionDef) and n.name == 'download_files_from_session')
            scope = {'asyncio': asyncio, 'download_session_files': session_downloads.download_session_files, 'os': SimpleNamespace(getenv=lambda _: 'synthetic'), 'logger': SimpleNamespace(**{name: lambda *a, **kw: None for name in ['error', 'info', 'exception']}), 'Path': Path, 'requests': session_downloads.requests, 'zipfile': zipfile, 'io': io}
            exec(compile(ast.Module(body=[function], type_ignores=[]), filename, 'exec'), scope)
            with self.subTest(filename=filename):
                response = Response(archive_bytes([('../outside.txt', b'SYNTHETIC')]), headers={'content-type': 'application/zip'})
                with patch.object(session_downloads.requests, 'get', return_value=response):
                    self.assertEqual(asyncio.run(scope['download_files_from_session']('synthetic', str(self.destination))), [])
                self.assertFalse((self.base / 'outside.txt').exists())
                response = Response(archive_bytes([('receipt.pdf', b'%PDF-SYNTHETIC')]))
                with patch.object(session_downloads.requests, 'get', return_value=response):
                    self.assertEqual(len(asyncio.run(scope['download_files_from_session']('synthetic', str(self.destination)))), 1)


if __name__ == '__main__':
    unittest.main()
