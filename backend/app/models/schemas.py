from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ---------------- Search Schemas ----------------
class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1024, description="Search query string")
    top_k: int = Field(default=20, ge=1, le=100, description="Max results to return")
    file_types: Optional[List[str]] = Field(default=None, description="Filter by file extensions (e.g. ['pdf', 'docx'])")
    date_from: Optional[datetime] = Field(default=None, description="Filter files modified on or after this timestamp")
    date_to: Optional[datetime] = Field(default=None, description="Filter files modified before this timestamp")


class SearchResultItem(BaseModel):
    file_id: int
    path: str
    filename: str
    extension: str
    size_bytes: int
    modified_at: datetime
    score: float = Field(..., description="Relevance score (cosine similarity or normalized fallback score)")
    preview: Optional[str] = None


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResultItem]
    total: int
    took_ms: float
    fallback_mode: bool = False


class OpenFileRequest(BaseModel):
    file_id: Optional[int] = None
    path: Optional[str] = None
    open_containing_folder: bool = False


class SearchSuggestionResponse(BaseModel):
    query: str
    suggestions: List[str]


# ---------------- Index & Folder Schemas ----------------
class FolderItem(BaseModel):
    id: int
    path: str
    path_hash: str
    is_active: bool
    scan_status: str
    file_count: int
    created_at: datetime
    last_scanned_at: Optional[datetime] = None
    last_scan_error: Optional[str] = None


class AddFolderRequest(BaseModel):
    path: str = Field(..., min_length=1, description="Absolute folder path to monitor")


class IndexStatusResponse(BaseModel):
    total_files: int
    active_files: int
    indexed_files: int
    pending_files: int
    processing_files: int
    failed_files: int
    skipped_files: int
    files_with_vectors: int
    soft_deleted_files: int
    vector_count: int
    deleted_vector_count: int
    index_size_bytes: int
    is_indexing: bool
    current_task: Optional[str] = None
    last_scan_error: Optional[str] = None
    last_scanned_at: Optional[datetime] = None


class RebuildIndexRequest(BaseModel):
    confirm: bool = Field(..., description="Confirmation flag to rebuild the index")


# ---------------- History & Settings Schemas ----------------
class HistoryItem(BaseModel):
    id: int
    query_text: str
    result_count: int
    searched_at: datetime


class HistoryResponse(BaseModel):
    items: List[HistoryItem]
    total: int


class HealthStatus(BaseModel):
    status: str
    database: str
    model: str
    vector_index: str
    worker: str
    watcher: str
    details: Optional[Dict[str, Any]] = None


class SettingsResponse(BaseModel):
    settings: Dict[str, str]


class UpdateSettingsRequest(BaseModel):
    settings: Dict[str, str]


class GenericSuccessResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
