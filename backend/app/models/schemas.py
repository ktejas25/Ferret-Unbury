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
    is_paused: bool = False
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


# ---------------- Document Library & Tags Schemas ----------------
class TagItem(BaseModel):
    id: int
    name: str
    color: str = "#8b5cf6"
    created_at: Optional[datetime] = None


class CreateTagRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    color: str = Field(default="#8b5cf6", max_length=32)


class AssignTagsRequest(BaseModel):
    tag_ids: List[int]


class CollectionItem(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_smart: bool = False
    rules_json: Optional[Dict[str, Any]] = None
    color: str = "#6366f1"
    item_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CreateCollectionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = None
    is_smart: bool = False
    rules_json: Optional[Dict[str, Any]] = None
    color: str = "#6366f1"


class UpdateCollectionRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_smart: Optional[bool] = None
    rules_json: Optional[Dict[str, Any]] = None
    color: Optional[str] = None


class CollectionFileActionRequest(BaseModel):
    file_ids: List[int]


class DocumentItem(BaseModel):
    id: int
    folder_id: int
    filename: str
    full_path: str
    extension: str
    size_bytes: int
    modified_at: datetime
    discovered_at: Optional[datetime] = None
    indexed_at: Optional[datetime] = None
    content_hash: Optional[str] = None
    extraction_status: str
    is_favorite: bool = False
    category: Optional[str] = None
    category_confidence: Optional[float] = None
    tags: List[TagItem] = []
    collections: List[str] = []
    content_preview: Optional[str] = None


class DocumentListResponse(BaseModel):
    items: List[DocumentItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class DocumentDetailResponse(BaseModel):
    document: DocumentItem
    extractions: Optional[Dict[str, Any]] = None
    entities: List[Dict[str, Any]] = []
    related_documents: List[Dict[str, Any]] = []


class ToggleFavoriteRequest(BaseModel):
    is_favorite: bool


class ClassifyDocumentRequest(BaseModel):
    category: str
    confidence: Optional[float] = 1.0


class DocumentPreviewResponse(BaseModel):
    file_id: int
    filename: str
    extension: str
    full_path: str
    size_bytes: int
    content_text: str
    pages: List[str] = []
    summary: Optional[str] = None
    key_points: List[str] = []
    category: Optional[str] = None
    important_dates: List[str] = []


# ---------------- AI Assistant Schemas ----------------
class SourceCitation(BaseModel):
    file_id: int
    filename: str
    path: str
    page_number: Optional[int] = 1
    excerpt: str
    relevance_score: float = 1.0


class ChatMessageItem(BaseModel):
    id: Optional[int] = None
    role: str
    content: str
    sources: List[SourceCitation] = []
    created_at: Optional[datetime] = None


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str = Field(..., min_length=1)
    scope_type: str = Field(default="all", description="'all', 'file', or 'collection'")
    scope_id: Optional[str] = None
    document_ids: Optional[List[int]] = None


class ChatResponse(BaseModel):
    conversation_id: str
    message: str
    role: str = "assistant"
    sources: List[SourceCitation] = []
    suggested_followups: List[str] = []


class ConversationItem(BaseModel):
    id: str
    title: str
    scope_type: str
    scope_id: Optional[str] = None
    message_count: int = 0
    created_at: datetime
    updated_at: datetime


class ConversationDetailResponse(BaseModel):
    conversation: ConversationItem
    messages: List[ChatMessageItem]


class SummarizeRequest(BaseModel):
    file_id: int
    mode: str = Field(default="executive", description="'executive', 'key_points', 'action_items'")


class SummarizeResponse(BaseModel):
    file_id: int
    title: str
    summary: str
    key_points: List[str] = []
    action_items: List[str] = []
    dates_mentioned: List[str] = []


# ---------------- Discovery Schemas ----------------
class DuplicateFileItem(BaseModel):
    file_id: int
    filename: str
    full_path: str
    size_bytes: int
    modified_at: datetime
    similarity_score: float = 1.0


class DuplicateGroup(BaseModel):
    group_id: str
    group_type: str  # 'exact' or 'similar'
    primary_file: DuplicateFileItem
    duplicates: List[DuplicateFileItem]
    wasted_bytes: int


class DuplicateListResponse(BaseModel):
    groups: List[DuplicateGroup]
    total_groups: int
    total_wasted_bytes: int


class GraphNode(BaseModel):
    id: str
    name: str
    group: str  # 'document', 'person', 'company', 'project', 'topic', 'location'
    value: int = 1
    file_id: Optional[int] = None
    details: Optional[Dict[str, Any]] = None


class GraphLink(BaseModel):
    source: str
    target: str
    relation: str  # 'references', 'mentions', 'belongs_to', 'created_by', 'related_to', 'supersedes'
    strength: float = 1.0
    evidence: Optional[str] = None


class KnowledgeGraphResponse(BaseModel):
    nodes: List[GraphNode]
    links: List[GraphLink]


class CompareDocumentsRequest(BaseModel):
    file_id_a: int
    file_id_b: int


class DiffItem(BaseModel):
    type: str  # 'added', 'removed', 'unchanged'
    text: str


class CompareDocumentsResponse(BaseModel):
    file_a: DocumentItem
    file_b: DocumentItem
    similarity_score: float
    summary_diff: str
    clauses_changed: List[str] = []
    diffs: List[DiffItem] = []


class TimelineEventItem(BaseModel):
    id: Optional[int] = None
    file_id: int
    filename: str
    event_date: str
    title: str
    description: Optional[str] = None
    confidence: float = 0.8
    source_page: Optional[int] = 1
    source_excerpt: Optional[str] = None


class DocumentTimelineResponse(BaseModel):
    events: List[TimelineEventItem]
    total: int


class OrganizeProposalItem(BaseModel):
    file_id: int
    filename: str
    current_path: str
    proposed_path: str
    reason: str


class OrganizeProposalResponse(BaseModel):
    folder_path: str
    proposals: List[OrganizeProposalItem]
    total_proposals: int


class ExecuteOrganizeRequest(BaseModel):
    approved_moves: List[Dict[str, str]]  # list of {"current_path": "...", "proposed_path": "..."}


# ---------------- Advanced Search & Saved Searches ----------------
class AdvancedSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1024)
    search_mode: str = Field(default="hybrid", description="'semantic', 'keyword', 'exact', 'natural_language', 'similar'")
    top_k: int = Field(default=20, ge=1, le=100)
    file_types: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    folder_id: Optional[int] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    min_size_bytes: Optional[int] = None
    max_size_bytes: Optional[int] = None
    min_score: Optional[float] = None
    tag_ids: Optional[List[int]] = None
    collection_id: Optional[int] = None
    similar_file_id: Optional[int] = None


class SavedSearchItem(BaseModel):
    id: int
    name: str
    query_text: str
    filters_json: Optional[Dict[str, Any]] = None
    created_at: datetime


class CreateSavedSearchRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    query_text: str
    filters_json: Optional[Dict[str, Any]] = None


# ---------------- Dashboard & Analytics ----------------
class DistributionItem(BaseModel):
    label: str
    count: int
    percentage: float = 0.0


class DashboardOverviewResponse(BaseModel):
    total_documents: int
    total_storage_bytes: int
    documents_indexed_today: int
    failed_indexing_jobs: int
    duplicate_count: int
    active_monitored_folders: int
    recent_documents: List[DocumentItem] = []
    recent_searches: List[HistoryItem] = []
    file_type_distribution: List[DistributionItem] = []
    category_distribution: List[DistributionItem] = []
    indexing_breakdown: Dict[str, int] = {}
    average_indexing_latency_ms: float = 0.0
