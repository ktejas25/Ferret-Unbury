import os
import sys
import tempfile
from pathlib import Path
import pytest
from fastapi import HTTPException

from app.core.security import (
    validate_safe_folder_path,
    validate_path_within_roots,
    verify_api_authorization,
    is_root_or_system_path
)
from app.config import settings


def test_is_root_or_system_path():
    if sys.platform == "win32":
        assert is_root_or_system_path(Path("C:\\"))
        assert is_root_or_system_path(Path("C:/Windows"))
        assert is_root_or_system_path(Path("C:/Windows/System32"))
        assert is_root_or_system_path(Path("C:/Program Files"))
    else:
        assert is_root_or_system_path(Path("/"))
        assert is_root_or_system_path(Path("/etc"))
        assert is_root_or_system_path(Path("/var"))


def test_validate_safe_folder_path():
    # Empty path
    valid, msg, p = validate_safe_folder_path("")
    assert not valid
    assert "cannot be empty" in msg

    # Non-existent path
    valid, msg, p = validate_safe_folder_path("D:/non_existent_folder_abc_123_xyz")
    assert not valid
    assert "does not exist" in msg

    # Valid temporary directory
    with tempfile.TemporaryDirectory() as tmp_dir:
        valid, msg, p = validate_safe_folder_path(tmp_dir)
        assert valid
        assert p is not None
        assert p.exists()


def test_validate_path_within_roots():
    with tempfile.TemporaryDirectory() as monitored_dir:
        with tempfile.TemporaryDirectory() as outside_dir:
            file_inside = Path(monitored_dir) / "sub" / "valid_doc.txt"
            file_inside.parent.mkdir(parents=True, exist_ok=True)
            file_inside.write_text("safe content", encoding="utf-8")

            file_outside = Path(outside_dir) / "secret.txt"
            file_outside.write_text("secret content", encoding="utf-8")

            active_roots = [monitored_dir]

            # 1. Valid file inside root
            valid, msg, p = validate_path_within_roots(str(file_inside), active_roots)
            assert valid
            assert p == file_inside.resolve()

            # 2. File outside root
            valid, msg, p = validate_path_within_roots(str(file_outside), active_roots)
            assert not valid
            assert "outside actively monitored" in msg

            # 3. Path traversal attempt using ../
            traversal_path = str(file_inside.parent / ".." / ".." / outside_dir / "secret.txt")
            valid, msg, p = validate_path_within_roots(traversal_path, active_roots)
            assert not valid
            assert "outside actively monitored" in msg


def test_verify_api_authorization():
    import asyncio

    async def _run_tests():
        # When REQUIRE_AUTH is False (default)
        settings.REQUIRE_AUTH = False
        result = await verify_api_authorization(auth_header=None, x_api_key=None)
        assert result is True

        # When REQUIRE_AUTH is True
        settings.REQUIRE_AUTH = True
        settings.API_KEY = "super-secret-key-1234"

        try:
            # 1. No credentials provided
            with pytest.raises(HTTPException) as exc_info:
                await verify_api_authorization(auth_header=None, x_api_key=None)
            assert exc_info.value.status_code == 401

            # 2. Wrong API Key
            with pytest.raises(HTTPException) as exc_info:
                await verify_api_authorization(auth_header=None, x_api_key="wrong-key")
            assert exc_info.value.status_code == 401

            # 3. Correct API Key via X-API-Key header
            result = await verify_api_authorization(auth_header=None, x_api_key="super-secret-key-1234")
            assert result is True
        finally:
            # Reset back to False
            settings.REQUIRE_AUTH = False
            settings.API_KEY = None

    asyncio.run(_run_tests())

