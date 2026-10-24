import os
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

        fallback_mode = False
        items: List[SearchResultItem] = []

        # 1. Semantic Vector Search
        try:
            q_emb = embedder.embed_query(query)
            # Retrieve up to 3x top_k to allow for post-filtering
            candidate_vids, sim_scores = vector_index_manager.knn_query(q_emb, k=max(top_k * 3, 50))
            score_map = {vid: score for vid, score in zip(candidate_vids, sim_scores)}

            if candidate_vids:
                # Fetch metadata from MySQL
                records = metadata_store.get_files_by_vector_ids(candidate_vids)
                # Filter and construct items
                filtered = self._apply_filters(records, score_map, req)
                # Sort by score descending
                filtered.sort(key=lambda x: x.score, reverse=True)
                items = filtered[:top_k]
        except Exception as e:
            logger.error(f"Semantic search error: {e}")
            fallback_mode = True

        # 2. Filename Fallback Search if semantic search yielded no matches or failed
        if not items:
            fallback_mode = True
            fallback_records = metadata_store.search_fallback_filename(query, limit=top_k * 2)
            # Fallback scores (1.0 for exact/prefix match, 0.7 for partial match)
            score_map = {}
            for r in fallback_records:
                fname = r.get("filename", "").lower()
                q_lower = query.lower()
                if fname == q_lower:
                    score_map[r["id"]] = 1.0
                elif fname.startswith(q_lower):
                    score_map[r["id"]] = 0.9
                else:
                    score_map[r["id"]] = 0.7

            filtered = self._apply_filters(fallback_records, score_map, req)
            filtered.sort(key=lambda x: (x.score, x.modified_at), reverse=True)
            items = filtered[:top_k]

        took_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # 3. Record search history
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

            if req.date_from and mod_at and mod_at < req.date_from:
                continue
            if req.date_to and mod_at and mod_at >= req.date_to:
                continue

            vid = r.get("vector_id") or r.get("id")
            score = score_map.get(vid, 0.5)

            filtered_items.append(
                SearchResultItem(
                    file_id=r["id"],
                    path=r["full_path"],
                    filename=r["filename"],
                    extension=r.get("extension", ""),
                    size_bytes=r.get("size_bytes", 0),
                    modified_at=mod_at if isinstance(mod_at, datetime) else datetime.utcnow(),
                    score=round(float(score), 4),
                    preview=r.get("content_preview")
                )
            )

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

        # Validate target path exists on disk
        target_p = Path(target_path).resolve()
        if not target_p.exists():
            return False, f"File not found on disk: {target_path}"

        # Security check: Validate resolved path is within an active monitored root
        active_roots = metadata_store.get_active_folder_paths()
        is_safe = False
        for root in active_roots:
            try:
                root_p = Path(root).resolve()
                if target_p == root_p or root_p in target_p.parents:
                    is_safe = True
                    break
            except Exception:
                continue

        if not is_safe:
            return False, "Access denied: Target path is outside actively monitored folders"

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


search_service = SearchService()
