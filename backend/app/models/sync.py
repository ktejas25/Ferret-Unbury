from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class SyncStatus(str, Enum):
    NOT_SELECTED = "not_selected"
    PENDING = "pending"
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    INDEXING = "indexing"
    SYNCED = "synced"
    FAILED = "failed"
    PAUSED = "paused"
    CONFLICT = "conflict"


class SyncConnectRequest(BaseModel):
    cloud_url: str = Field(..., description="Base URL of Cloudflare Worker API (e.g. https://archaeologist.worker.dev)")
    api_key: Optional[str] = Field(default=None, description="API Key or Bearer Token for cloud workspace")
    workspace_id: Optional[str] = Field(default="default", description="Cloud Workspace Identifier")


class SyncFolderRequest(BaseModel):
    folder_path: str = Field(..., description="Absolute local path to add or toggle for cloud sync")
    enabled: bool = Field(default=True, description="Whether folder sync is enabled")


class SyncSettingsUpdate(BaseModel):
    excluded_folders: Optional[List[str]] = None
    excluded_extensions: Optional[List[str]] = None
    max_file_size_bytes: Optional[int] = None
    retry_limit: Optional[int] = None


class SyncSettings(BaseModel):
    cloud_url: str = ""
    api_key: str = ""
    workspace_id: str = "default"
    is_connected: bool = False
    is_paused: bool = False
    sync_folders: List[str] = Field(default_factory=list)
    excluded_folders: List[str] = Field(default_factory=list)
    excluded_extensions: List[str] = Field(
        default_factory=lambda: [".tmp", ".log", ".bak", ".exe", ".dll", ".bin", ".iso", ".dmg", ".pyc"]
    )
    max_file_size_bytes: int = 52428800  # 50MB
    retry_limit: int = 3


class SyncItem(BaseModel):
    id: Optional[int] = None
    local_path: str
    filename: str
    folder_path: str
    content_hash: str
    size_bytes: int
    status: SyncStatus = SyncStatus.NOT_SELECTED
    cloud_file_id: Optional[str] = None
    bytes_transferred: int = 0
    error_message: Optional[str] = None
    retry_count: int = 0
    last_sync_attempt: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SyncHistoryEntry(BaseModel):
    id: Optional[int] = None
    source_path: str
    cloud_file_id: Optional[str] = None
    status: str
    bytes_transferred: int = 0
    error_message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    action_taken: str


class SyncStats(BaseModel):
    is_connected: bool
    is_paused: bool
    total_eligible: int = 0
    synced_count: int = 0
    pending_count: int = 0
    uploading_count: int = 0
    failed_count: int = 0
    conflict_count: int = 0
    bytes_synced: int = 0
    cloud_url: Optional[str] = None
    workspace_id: Optional[str] = None

