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


search_service = SearchService()
