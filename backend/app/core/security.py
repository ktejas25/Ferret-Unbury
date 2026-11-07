import os
import sys
import logging
from pathlib import Path
from typing import List, Tuple, Optional
from fastapi import Header, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings

logger = logging.getLogger("file_archaeologist.security")

# System-level protected directories that should never be monitored
PROTECTED_SYSTEM_PATHS = {
    # Windows system directories
    "c:\\windows", "c:\\program files", "c:\\program files (x86)",
    "c:\\programdata", "c:\\recovery", "c:\\boot", "c:\\system volume information",
    "c:\\$recycle.bin",
    # Unix / Linux root system directories
    "/bin", "/sbin", "/usr", "/etc", "/var", "/dev", "/proc", "/sys", "/root"
}

security_bearer = HTTPBearer(auto_error=False)


def is_root_or_system_path(resolved_path: Path) -> bool:
    """Detects if a path is a root drive or forbidden system folder."""
    path_str = str(resolved_path).lower().rstrip("/\\")
    
    # Check if path is root drive (e.g., 'C:' or 'C:\' or '/')
    if len(resolved_path.parts) <= 1:
        return True
    
    # On Windows, e.g. Path('C:\\').parts is ('C:\\',)
    if sys.platform == "win32":
        if resolved_path.anchor.lower().rstrip("/\\") == path_str:
            return True

    # Check against known system directories
    for sys_path in PROTECTED_SYSTEM_PATHS:
        if path_str == sys_path or path_str.startswith(sys_path + os.sep):
            return True

    return False


def validate_safe_folder_path(raw_path: str) -> Tuple[bool, str, Optional[Path]]:
    """
    Validates that a folder path is safe to monitor:
    - Must exist and be a directory.
    - Must not be a system-critical root or OS directory.
    - Must resolve properly without directory traversal tricks.
    """
    if not raw_path or not raw_path.strip():
        return False, "Folder path cannot be empty", None

    try:
        p = Path(raw_path.strip()).expanduser()
        resolved = p.resolve()
    except Exception as e:
        return False, f"Invalid filesystem path: {e}", None

    if not resolved.exists():
        return False, f"Directory does not exist on disk: {raw_path}", None

    if not resolved.is_dir():
        return False, f"Path is not a directory: {raw_path}", None

    if is_root_or_system_path(resolved):
        return False, "Access denied: Root or system-critical directories cannot be monitored", None

    # Resolve real path to detect hidden symlink targets
    try:
        real_p = Path(os.path.realpath(str(resolved)))
        if is_root_or_system_path(real_p):
            return False, "Access denied: Symlink resolves to a protected system directory", None
    except Exception:
        pass

    return True, "Path is valid", resolved


def validate_path_within_roots(
    target_path: str,
    active_roots: List[str]
) -> Tuple[bool, str, Optional[Path]]:
    """
    Validates that target_path:
    - Exists on disk.
    - Resolves inside one of the actively monitored roots.
    - Does not escape monitored roots via symlinks or path traversal (../).
    """
    if not target_path or not target_path.strip():
        return False, "Path cannot be empty", None

    try:
        target_p = Path(target_path.strip()).expanduser().resolve()
    except Exception as e:
        return False, f"Invalid path syntax: {e}", None

    if not target_p.exists():
        return False, f"File not found on disk: {target_path}", None

    # Get real canonical path to resolve symlinks
    try:
        real_target = Path(os.path.realpath(str(target_p)))
    except Exception as e:
        return False, f"Cannot resolve target realpath: {e}", None

    # Check against all active monitored roots
    matched_root = False
    for root in active_roots:
        if not root:
            continue
        try:
            root_p = Path(root).expanduser().resolve()
            real_root = Path(os.path.realpath(str(root_p)))

            # Check both logical resolved path and physical realpath
            if (target_p == root_p or root_p in target_p.parents) and \
               (real_target == real_root or real_root in real_target.parents):
                matched_root = True
                break
        except Exception:
            continue

    if not matched_root:
        return False, "Access denied: Target path is outside actively monitored folders", None

    return True, "Path validated successfully", real_target


async def verify_api_authorization(
    auth_header: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
) -> bool:
    """
    Verifies API authentication when REQUIRE_AUTH is enabled.
    In local-first desktop mode without REQUIRE_AUTH, requests from localhost are permitted.
    """
    if not settings.REQUIRE_AUTH:
        return True

    expected_key = settings.API_KEY
    if not expected_key:
        # REQUIRE_AUTH enabled but no key set: fail closed
        logger.error("REQUIRE_AUTH is true but API_KEY is not configured in settings.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server authentication misconfigured"
        )

    token = None
    if auth_header and auth_header.scheme.lower() == "bearer":
        token = auth_header.credentials
    elif x_api_key:
        token = x_api_key

    if not token or token != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return True

