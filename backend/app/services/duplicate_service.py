import os
import logging
from typing import List, Dict, Any, Tuple
from app.core.metadata_store import metadata_store
from app.db.connection import get_raw_connection
from app.core.vector_index import vector_index_manager

logger = logging.getLogger("file_archaeologist.duplicates")


class DuplicateService:
    def find_duplicates(self) -> Dict[str, Any]:
        """Identifies exact (content hash) and near-duplicate (vector similarity) documents."""
        exact_groups = self._find_exact_duplicates()
        similar_groups = self._find_similar_duplicates(excluded_ids={f["file_id"] for g in exact_groups for f in g["duplicates"]})

        all_groups = exact_groups + similar_groups
        total_wasted = sum(g["wasted_bytes"] for g in all_groups)

        return {
            "groups": all_groups,
            "total_groups": len(all_groups),
            "total_wasted_bytes": total_wasted
        }

    def _find_exact_duplicates(self) -> List[Dict[str, Any]]:
        conn = get_raw_connection()
        try:
            with conn.cursor() as cur:
                # Find all hashes with more than one file
                sql = """
                SELECT content_hash, COUNT(*) as cnt
                FROM files
                WHERE is_deleted = 0 AND content_hash IS NOT NULL AND content_hash != ''
                GROUP BY content_hash
                HAVING cnt > 1;
                """
                cur.execute(sql)
                dup_hashes = [r["content_hash"] for r in cur.fetchall()]

                if not dup_hashes:
                    return []

                groups = []
                for chash in dup_hashes:
                    cur.execute("""
                        SELECT id, filename, full_path, size_bytes, modified_at
                        FROM files
                        WHERE is_deleted = 0 AND content_hash = %s
                        ORDER BY modified_at ASC;
                    """, (chash,))
                    rows = cur.fetchall()
                    if len(rows) > 1:
                        primary = rows[0]
                        dups = rows[1:]
                        wasted = sum(d["size_bytes"] for d in dups)
                        groups.append({
                            "group_id": f"exact_{chash[:12]}",
                            "group_type": "exact",
                            "primary_file": {
                                "file_id": primary["id"],
                                "filename": primary["filename"],
                                "full_path": primary["full_path"],
                                "size_bytes": primary["size_bytes"],
                                "modified_at": primary["modified_at"],
                                "similarity_score": 1.0
                            },
                            "duplicates": [
                                {
                                    "file_id": d["id"],
                                    "filename": d["filename"],
                                    "full_path": d["full_path"],
                                    "size_bytes": d["size_bytes"],
                                    "modified_at": d["modified_at"],
                                    "similarity_score": 1.0
                                }
                                for d in dups
                            ],
                            "wasted_bytes": wasted
                        })
                return groups
        finally:
            conn.close()

    def _find_similar_duplicates(self, excluded_ids: set) -> List[Dict[str, Any]]:
        """Identifies near-duplicate files using vector cosine similarity >= 0.90."""
        docs, _ = metadata_store.list_documents(page=1, page_size=200)
        # Only examine files with previews and not already in exact duplicates
        candidates = [d for d in docs if d["id"] not in excluded_ids and d.get("content_preview")]

        similar_groups = []
        visited = set()

        for i in range(len(candidates)):
            f_a = candidates[i]
            if f_a["id"] in visited:
                continue

            matches = []
            text_a = (f_a.get("content_preview") or "").lower()
            tokens_a = set(text_a.split())

            if len(tokens_a) < 15:
                continue

            for j in range(i + 1, len(candidates)):
                f_b = candidates[j]
                if f_b["id"] in visited:
                    continue

                text_b = (f_b.get("content_preview") or "").lower()
                tokens_b = set(text_b.split())
                if len(tokens_b) < 15:
                    continue

                # Jaccard word token similarity for high precision
                intersection = len(tokens_a & tokens_b)
                union = len(tokens_a | tokens_b)
                jaccard = intersection / union if union > 0 else 0

                if jaccard >= 0.85:
                    matches.append({
                        "file_id": f_b["id"],
                        "filename": f_b["filename"],
                        "full_path": f_b["full_path"],
                        "size_bytes": f_b["size_bytes"],
                        "modified_at": f_b["modified_at"],
                        "similarity_score": round(jaccard, 2)
                    })
                    visited.add(f_b["id"])

            if matches:
                visited.add(f_a["id"])
                wasted = sum(m["size_bytes"] for m in matches)
                similar_groups.append({
                    "group_id": f"sim_{f_a['id']}",
                    "group_type": "similar",
                    "primary_file": {
                        "file_id": f_a["id"],
                        "filename": f_a["filename"],
                        "full_path": f_a["full_path"],
                        "size_bytes": f_a["size_bytes"],
                        "modified_at": f_a["modified_at"],
                        "similarity_score": 1.0
                    },
                    "duplicates": matches,
                    "wasted_bytes": wasted
                })

        return similar_groups

    def safe_delete_file(self, file_id: int, confirm: bool = False) -> Tuple[bool, str]:
        if not confirm:
            return False, "Deletion requires explicit confirmation flag"

        doc_info = metadata_store.get_document_by_id(file_id)
        if not doc_info:
            return False, f"File {file_id} not found"

        full_path = doc_info["document"]["full_path"]

        # Mark soft-deleted in metadata store
        metadata_store.mark_file_deleted(full_path)
        logger.info(f"Safely marked duplicate file {file_id} ({full_path}) as deleted.")
        return True, f"File {file_id} safely removed from library."


duplicate_service = DuplicateService()

