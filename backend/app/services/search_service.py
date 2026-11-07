import os
import re
import time
import logging
import platform
import subprocess
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple

from app.core.metadata_store import metadata_store
from app.core.embedder import embedder
from app.core.vector_index import vector_index_manager
from app.core.security import validate_path_within_roots
from app.models.schemas import SearchRequest, SearchResponse, SearchResultItem

logger = logging.getLogger("file_archaeologist.search_service")


class SearchService:
    """
    Orchestrates semantic search, vector candidate retrieval, metadata filtering,
    filename fallback search, search suggestions, and safe OS file launching.
    """

    def search(self, req: SearchRequest) -> SearchResponse:
        start_time = time.perf_counter()
        query = req.query.strip()
        top_k = req.top_k or 20

        # RRF (Reciprocal Rank Fusion) parameters
        RRF_K = 60.0
        rrf_scores: Dict[int, float] = {}
        all_records_by_id: Dict[int, Dict[str, Any]] = {}

        # 1. Semantic Vector Search Channel
        semantic_records: List[Dict[str, Any]] = []
        try:
            q_emb = embedder.embed_query(query)
            candidate_vids, sim_scores = vector_index_manager.knn_query(q_emb, k=max(top_k * 3, 50))
            if candidate_vids:
                semantic_records = metadata_store.get_files_by_vector_ids(candidate_vids)
                # Map records by vector_id to preserve rank order
                rec_by_vid = {r.get("vector_id"): r for r in semantic_records if r.get("vector_id")}
                for rank, vid in enumerate(candidate_vids, start=1):
                    rec = rec_by_vid.get(vid)
                    if rec:
                        fid = rec["id"]
                        all_records_by_id[fid] = rec
                        rrf_scores[fid] = rrf_scores.get(fid, 0.0) + (1.0 / (RRF_K + rank))
        except Exception as e:
            logger.error(f"Semantic search channel error: {e}")

        # 2. Filename Lexical Matching Channel
        filename_records = metadata_store.search_fallback_filename(query, limit=top_k * 3)
        q_lower = query.lower().strip()
        q_tokens = [t.lower() for t in query.replace(".", " ").replace("_", " ").replace("-", " ").split() if len(t) >= 2]

        for rank, r in enumerate(filename_records, start=1):
            fid = r["id"]
            all_records_by_id[fid] = r
            fname = r.get("filename", "").lower()
            fname_no_ext = os.path.splitext(fname)[0]

            # Boost exact or prefix matches in filename ranking
            weight = 1.0
            if fname == q_lower or fname_no_ext == q_lower:
                weight = 2.0
            elif fname.startswith(q_lower) or fname_no_ext.startswith(q_lower):
                weight = 1.5
            elif q_lower in fname:
                weight = 1.2
            elif any(tok in fname for tok in q_tokens):
                weight = 1.0

            rrf_scores[fid] = rrf_scores.get(fid, 0.0) + (weight / (RRF_K + rank))

        # Normalize RRF scores into [0.1, 1.0] range for consistent UI score presentation
        max_rrf = max(rrf_scores.values()) if rrf_scores else 1.0
        normalized_scores: Dict[int, float] = {}
        for fid, raw_score in rrf_scores.items():
            norm_score = min(1.0, max(0.1, raw_score / max_rrf))
            normalized_scores[fid] = round(norm_score, 4)

        # 3. Apply Metadata & Date Filtering
        candidate_list = list(all_records_by_id.values())
        filtered = self._apply_filters(candidate_list, normalized_scores, req)
        filtered.sort(key=lambda x: (x.score, x.modified_at), reverse=True)
        items = filtered[:top_k]

        fallback_mode = (len(semantic_records) == 0 and len(filename_records) > 0)
        took_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # 4. Record search history
        try:
            metadata_store.record_search_history(query, len(items))
        except Exception as e:
            logger.warning(f"Could not record search history: {e}")

        return SearchResponse(
            query=query,
            results=items,
            total=len(items),
            took_ms=took_ms,
            fallback_mode=fallback_mode
        )

    def _apply_filters(
        self,
        records: List[Dict[str, Any]],
        score_map: Dict[int, float],
        req: SearchRequest
    ) -> List[SearchResultItem]:
        filtered_items = []
        file_types = {t.lower().lstrip(".") for t in req.file_types} if req.file_types else None

        # Normalize filter boundaries to timezone-naive UTC for robust comparison
        date_from = req.date_from.replace(tzinfo=None) if req.date_from else None
        date_to = req.date_to.replace(tzinfo=None) if req.date_to else None

        for r in records:
            ext = r.get("extension", "").lower().lstrip(".")
            if file_types and ext not in file_types:
                continue

            mod_at = r.get("modified_at")
            if isinstance(mod_at, str):
                try:
                    mod_at = datetime.fromisoformat(mod_at)
                except Exception:
                    pass

            if isinstance(mod_at, datetime):
                clean_mod = mod_at.replace(tzinfo=None)
                if date_from and clean_mod < date_from:
                    continue
                if date_to and clean_mod >= date_to:
                    continue
            else:
                clean_mod = datetime.utcnow()

            fid = r["id"]
            score = score_map.get(fid, 0.5)

            filtered_items.append(
                SearchResultItem(
                    file_id=r["id"],
                    path=r["full_path"],
                    filename=r["filename"],
                    extension=r.get("extension", ""),
                    size_bytes=r.get("size_bytes", 0),
                    modified_at=clean_mod,
                    score=round(float(score), 4),
                    preview=r.get("content_preview")
                )
            )

        return filtered_items

        return filtered_items

    def open_file(self, file_id: Optional[int], path: Optional[str], open_folder: bool = False) -> Tuple[bool, str]:
        """
        Validates target path against active monitored roots to defend against
        path traversal and unmonitored file access, then invokes safe OS launch.
        """
        target_path: Optional[str] = None
        if file_id:
            record = metadata_store.get_file_by_id(file_id)
            if not record:
                return False, "File record not found in database"
            target_path = record["full_path"]
        elif path:
            target_path = path

        if not target_path:
            return False, "No file ID or path provided"

        # Security check: Validate resolved realpath and symlink target against active roots
        active_roots = metadata_store.get_active_folder_paths()
        is_safe, error_msg, validated_p = validate_path_within_roots(target_path, active_roots)
        if not is_safe or validated_p is None:
            return False, error_msg

        target_p = validated_p

        # Safe launch with OS default application
        try:
            if open_folder:
                # Open containing folder
                folder_to_open = str(target_p.parent)
                if platform.system() == "Windows":
                    os.startfile(folder_to_open)
                elif platform.system() == "Darwin":
                    subprocess.run(["open", folder_to_open], check=True)
                else:
                    subprocess.run(["xdg-open", folder_to_open], check=True)
                return True, "Containing folder opened successfully"
            else:
                # Open file
                if platform.system() == "Windows":
                    os.startfile(str(target_p))
                elif platform.system() == "Darwin":
                    subprocess.run(["open", str(target_p)], check=True)
                else:
                    subprocess.run(["xdg-open", str(target_p)], check=True)
                return True, "File opened successfully"
        except Exception as e:
            logger.error(f"Failed to open file '{target_path}': {e}")
            return False, f"Failed to open file: {e}"

    def get_suggestions(self, prefix: str) -> List[str]:
        """Returns up to 8 search suggestions from recent queries and matching filenames."""
        prefix = prefix.strip()
        if not prefix:
            return []

        suggestions: List[str] = []

        # From recent history
        history = metadata_store.get_recent_history(limit=50)
        for h in history:
            q = h.get("query_text", "")
            if q.lower().startswith(prefix.lower()) and q not in suggestions:
                suggestions.append(q)
                if len(suggestions) >= 4:
                    break

        # From indexed filenames
        filenames = metadata_store.get_matching_filenames(prefix, limit=8)
        for fname in filenames:
            if fname not in suggestions:
                suggestions.append(fname)
            if len(suggestions) >= 8:
                break

        return suggestions[:8]

    # ---------------- Advanced Search, Natural Language & Saved Searches ----------------
    def parse_natural_language_query(self, query: str) -> Tuple[str, Dict[str, Any]]:
        """Extracts structured filters (categories, date hints, file types) from natural-language queries."""
        cleaned_query = query.strip()
        filters: Dict[str, Any] = {}

        # 1. Category extraction hints
        cat_hints = {
            "invoice": "Invoice",
            "receipt": "Receipt",
            "contract": "Contract",
            "agreement": "Contract",
            "resume": "Resume",
            "cv": "Resume",
            "purchase order": "Purchase Order",
            "po": "Purchase Order",
            "report": "Report",
            "presentation": "Presentation",
            "spreadsheet": "Spreadsheet",
            "sheet": "Spreadsheet",
            "documentation": "Technical Documentation",
            "paper": "Research Paper"
        }
        for kw, cat in cat_hints.items():
            if re.search(rf"\b{re.escape(kw)}s?\b", cleaned_query, re.I):
                filters["category"] = cat
                # Optionally remove keyword from search text if prefix-like
                cleaned_query = re.sub(rf"\bfind\s+(?:the\s+)?{re.escape(kw)}s?\b", "", cleaned_query, flags=re.I).strip()
                cleaned_query = re.sub(rf"\bshow\s+(?:all\s+)?{re.escape(kw)}s?\b", "", cleaned_query, flags=re.I).strip()

        # 2. Date hints
        now = datetime.now()
        if re.search(r"\blast\s+month\b", cleaned_query, re.I):
            filters["date_from"] = datetime(now.year, max(1, now.month - 1), 1)
            cleaned_query = re.sub(r"\blast\s+month\b", "", cleaned_query, flags=re.I).strip()
        elif re.search(r"\bthis\s+year\b", cleaned_query, re.I):
            filters["date_from"] = datetime(now.year, 1, 1)
            cleaned_query = re.sub(r"\bthis\s+year\b", "", cleaned_query, flags=re.I).strip()
        elif re.search(r"\blast\s+year\b", cleaned_query, re.I):
            filters["date_from"] = datetime(now.year - 1, 1, 1)
            filters["date_to"] = datetime(now.year, 1, 1)
            cleaned_query = re.sub(r"\blast\s+year\b", "", cleaned_query, flags=re.I).strip()

        # Clean filler words
        cleaned_query = re.sub(r"^(?:find|search|show|get|locate)\s+(?:me\s+)?(?:all\s+)?(?:documents?\s+)?(?:mentioning|about|related\s+to|with)?", "", cleaned_query, flags=re.I).strip()
        if not cleaned_query:
            cleaned_query = query.strip()

        return cleaned_query, filters

    def advanced_search(
        self,
        query: str,
        search_mode: str = "hybrid",
        top_k: int = 20,
        file_types: Optional[List[str]] = None,
        categories: Optional[List[str]] = None,
        folder_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        min_size_bytes: Optional[int] = None,
        max_size_bytes: Optional[int] = None,
        min_score: Optional[float] = None,
        similar_file_id: Optional[int] = None
    ) -> SearchResponse:
        """Executes targeted multi-mode search with deep multi-facet filtering."""
        target_query = query.strip()
        active_categories = list(categories) if categories else []

        # 1. Natural Language Query Parsing
        if search_mode == "natural_language":
            parsed_q, extracted_filters = self.parse_natural_language_query(target_query)
            target_query = parsed_q
            if "category" in extracted_filters and extracted_filters["category"] not in active_categories:
                active_categories.append(extracted_filters["category"])
            if "date_from" in extracted_filters and not date_from:
                date_from = extracted_filters["date_from"]
            if "date_to" in extracted_filters and not date_to:
                date_to = extracted_filters["date_to"]

        # 2. Similar Document Search Mode
        if search_mode == "similar" and similar_file_id:
            doc_info = metadata_store.get_document_by_id(similar_file_id)
            if doc_info:
                preview = doc_info["document"].get("content_preview") or doc_info["document"]["filename"]
                target_query = preview[:300]

        # Standard RRF search baseline
        req = SearchRequest(
            query=target_query,
            top_k=max(top_k * 2, 40),
            file_types=file_types,
            date_from=date_from,
            date_to=date_to
        )
        base_res = self.search(req)

        # 3. Post-filter for Categories, Folders, Sizes, Min Score
        filtered_results = []
        for item in base_res.results:
            # Check file metadata
            f_detail = metadata_store.get_document_by_id(item.file_id)
            if not f_detail:
                continue
            doc = f_detail["document"]

            # Category filter
            if active_categories:
                doc_cat = doc.get("category") or "General Document"
                if doc_cat not in active_categories:
                    continue

            # Folder filter
            if folder_id and doc.get("folder_id") != folder_id:
                continue

            # Size filters
            if min_size_bytes is not None and doc["size_bytes"] < min_size_bytes:
                continue
            if max_size_bytes is not None and doc["size_bytes"] > max_size_bytes:
                continue

            # Min score filter
            if min_score is not None and item.score < min_score:
                continue

            filtered_results.append(item)

        final_items = filtered_results[:top_k]
        return SearchResponse(
            query=query,
            results=final_items,
            total=len(final_items),
            took_ms=base_res.took_ms,
            fallback_mode=base_res.fallback_mode
        )

    # ---------------- Saved Searches ----------------
    def list_saved_searches(self) -> List[Dict[str, Any]]:
        return metadata_store.list_saved_searches()

    def create_saved_search(self, name: str, query_text: str, filters_json: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return metadata_store.create_saved_search(name, query_text, filters_json)

    def delete_saved_search(self, search_id: int) -> bool:
        return metadata_store.delete_saved_search(search_id)


search_service = SearchService()
