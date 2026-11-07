import difflib
import re
from typing import Dict, Any, List
from app.core.metadata_store import metadata_store
from app.services.document_service import document_service


class ComparisonService:
    def compare_documents(self, file_id_a: int, file_id_b: int) -> Dict[str, Any]:
        """Compares two documents side-by-side, analyzing text diffs, clause changes, and similarities."""
        doc_a_info = metadata_store.get_document_by_id(file_id_a)
        doc_b_info = metadata_store.get_document_by_id(file_id_b)

        if not doc_a_info or not doc_b_info:
            raise FileNotFoundError("One or both documents could not be found for comparison.")

        doc_a = doc_a_info["document"]
        doc_b = doc_b_info["document"]

        # Fetch preview/content
        prev_a = document_service.get_document_preview(file_id_a)
        prev_b = document_service.get_document_preview(file_id_b)

        text_a = (prev_a["content_text"] if prev_a else doc_a.get("content_preview") or "").splitlines()
        text_b = (prev_b["content_text"] if prev_b else doc_b.get("content_preview") or "").splitlines()

        matcher = difflib.SequenceMatcher(None, text_a, text_b)
        similarity = round(matcher.ratio(), 3)

        diffs: List[Dict[str, str]] = []
        added_lines = 0
        removed_lines = 0

        for opcode, a0, a1, b0, b1 in matcher.get_opcodes():
            if opcode == "equal":
                for line in text_a[a0:a1][:4]:
                    diffs.append({"type": "unchanged", "text": line})
            elif opcode == "insert":
                for line in text_b[b0:b1]:
                    diffs.append({"type": "added", "text": line})
                    added_lines += 1
            elif opcode == "delete":
                for line in text_a[a0:a1]:
                    diffs.append({"type": "removed", "text": line})
                    removed_lines += 1
            elif opcode == "replace":
                for line in text_a[a0:a1]:
                    diffs.append({"type": "removed", "text": line})
                    removed_lines += 1
                for line in text_b[b0:b1]:
                    diffs.append({"type": "added", "text": line})
                    added_lines += 1

        # Changed clauses/topics identification
        clauses_changed = []
        if added_lines > 0:
            clauses_changed.append(f"{added_lines} line(s) added in '{doc_b['filename']}'")
        if removed_lines > 0:
            clauses_changed.append(f"{removed_lines} line(s) removed from '{doc_a['filename']}'")

        if doc_a.get("category") != doc_b.get("category"):
            clauses_changed.append(f"Classification difference: '{doc_a.get('category')}' vs '{doc_b.get('category')}'")

        summary_diff = (
            f"Comparison between '{doc_a['filename']}' and '{doc_b['filename']}': "
            f"Overall textual similarity is {round(similarity * 100, 1)}%. "
            f"Detected {added_lines} additions and {removed_lines} deletions."
        )

        return {
            "file_a": doc_a,
            "file_b": doc_b,
            "similarity_score": similarity,
            "summary_diff": summary_diff,
            "clauses_changed": clauses_changed,
            "diffs": diffs[:120]  # Limit to 120 diff items for fast rendering
        }


comparison_service = ComparisonService()

