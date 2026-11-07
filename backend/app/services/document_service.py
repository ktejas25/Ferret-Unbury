import os
import re
from typing import Dict, Any, List, Optional, Tuple
from app.core.metadata_store import metadata_store
from app.core.security import validate_path_within_roots
from app.extractor.registry import extractor_registry
from app.services.classifier_service import classifier_service
from app.services.extraction_service import extraction_service


class DocumentService:
    def list_documents(
        self,
        page: int = 1,
        page_size: int = 24,
        sort_by: str = "modified_at",
        sort_order: str = "desc",
        category: Optional[str] = None,
        extension: Optional[str] = None,
        folder_id: Optional[int] = None,
        is_favorite: Optional[bool] = None,
        status: Optional[str] = None,
        tag_id: Optional[int] = None,
        collection_id: Optional[int] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        return metadata_store.list_documents(
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
            category=category,
            extension=extension,
            folder_id=folder_id,
            is_favorite=is_favorite,
            status=status,
            tag_id=tag_id,
            collection_id=collection_id,
            search=search,
        )

    def get_document_details(self, file_id: int) -> Optional[Dict[str, Any]]:
        return metadata_store.get_document_by_id(file_id)

    def toggle_favorite(self, file_id: int, is_favorite: bool) -> bool:
        return metadata_store.toggle_favorite(file_id, is_favorite)

    def classify_document(self, file_id: int, category: str) -> None:
        classifier_service.manual_override(file_id, category)

    def assign_tags(self, file_id: int, tag_ids: List[int]) -> None:
        metadata_store.assign_tags_to_file(file_id, tag_ids)

    def list_tags(self) -> List[Dict[str, Any]]:
        return metadata_store.list_tags()

    def create_tag(self, name: str, color: str = "#8b5cf6") -> Dict[str, Any]:
        return metadata_store.create_tag(name, color)

    def delete_tag(self, tag_id: int) -> bool:
        return metadata_store.delete_tag(tag_id)

    def list_collections(self) -> List[Dict[str, Any]]:
        return metadata_store.list_collections()

    def create_collection(
        self,
        name: str,
        description: Optional[str] = None,
        is_smart: bool = False,
        rules_json: Optional[Dict[str, Any]] = None,
        color: str = "#6366f1"
    ) -> Dict[str, Any]:
        return metadata_store.create_collection(name, description, is_smart, rules_json, color)

    def update_collection(
        self,
        collection_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        is_smart: Optional[bool] = None,
        rules_json: Optional[Dict[str, Any]] = None,
        color: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        return metadata_store.update_collection(collection_id, name, description, is_smart, rules_json, color)

    def delete_collection(self, collection_id: int) -> bool:
        return metadata_store.delete_collection(collection_id)

    def add_files_to_collection(self, collection_id: int, file_ids: List[int]) -> int:
        return metadata_store.add_files_to_collection(collection_id, file_ids)

    def remove_files_from_collection(self, collection_id: int, file_ids: List[int]) -> int:
        return metadata_store.remove_files_from_collection(collection_id, file_ids)

    def get_document_preview(self, file_id: int) -> Optional[Dict[str, Any]]:
        doc_info = metadata_store.get_document_by_id(file_id)
        if not doc_info:
            return None

        doc = doc_info["document"]
        full_path = doc["full_path"]

        # Security check: verify path is inside monitored folders
        folders = [f["path"] for f in metadata_store.list_folders() if f.get("is_active")]
        if not validate_path_within_roots(full_path, folders):
            raise PermissionError("Access denied: File does not reside in an actively monitored directory")

        if not os.path.exists(full_path):
            raise FileNotFoundError(f"File not found on filesystem: {full_path}")

        # Extract content using the registered extractor
        extractor = extractor_registry.get_extractor(doc["extension"])
        content_text = ""
        try:
            content_text = extractor.extract_text(full_path)
        except Exception:
            content_text = doc.get("content_preview") or ""

        # Break into readable pseudo-pages (around 1500 chars per page)
        pages = []
        if content_text:
            chunk_size = 1500
            for i in range(0, len(content_text), chunk_size):
                pages.append(content_text[i:i + chunk_size])
        if not pages:
            pages = [content_text or "No extracted text preview available."]

        # Generate summary and key points
        summary = self._generate_summary(content_text, doc["filename"])
        key_points = self._generate_key_points(content_text)
        dates = re.findall(r"\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b", content_text)

        return {
            "file_id": doc["id"],
            "filename": doc["filename"],
            "extension": doc["extension"],
            "full_path": doc["full_path"],
            "size_bytes": doc["size_bytes"],
            "content_text": content_text,
            "pages": pages,
            "summary": summary,
            "key_points": key_points,
            "category": doc.get("category") or "General Document",
            "important_dates": list(dict.fromkeys(dates))[:5]
        }

    def _generate_summary(self, text: str, filename: str) -> str:
        if not text:
            return f"Document '{filename}' is empty or could not be parsed."
        lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 30]
        if lines:
            return " ".join(lines[:3])[:300] + "..."
        return text[:250] + "..."

    def _generate_key_points(self, text: str) -> List[str]:
        if not text:
            return []
        sentences = [s.strip() for s in re.split(r"[.!?\n]", text) if len(s.strip()) > 25]
        # Return top 4 distinct sentences as key points
        pts = []
        for s in sentences:
            if s not in pts:
                pts.append(s)
            if len(pts) >= 4:
                break
        return pts


document_service = DocumentService()

