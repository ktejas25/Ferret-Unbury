import os
import shutil
import logging
from typing import Dict, Any, List
from app.core.metadata_store import metadata_store
from app.core.security import validate_path_within_roots

logger = logging.getLogger("file_archaeologist.organization")


class OrganizationService:
    def propose_organization(self, folder_id: int) -> Dict[str, Any]:
        """
        Analyzes files in a monitored directory and proposes a structured folder hierarchy
        organized by Document Category and Financial Year / Year.
        Strictly a dry-run proposal; does NOT modify or move any files.
        """
        folders = metadata_store.list_folders()
        target_folder = next((f for f in folders if f["id"] == folder_id), None)
        if not target_folder:
            raise FileNotFoundError(f"Monitored folder {folder_id} not found")

        root_path = target_folder["path"]
        docs, _ = metadata_store.list_documents(page=1, page_size=200, folder_id=folder_id)

        proposals = []
        for d in docs:
            curr_path = d["full_path"]
            cat = d.get("category") or "General Document"
            # Determine year from modified_at
            mod = d.get("modified_at")
            year_str = str(mod.year) if hasattr(mod, "year") else "2026"

            # Clean category directory name
            cat_dir = cat.replace(" ", "_")
            proposed_dir = os.path.join(root_path, "Organized", cat_dir, year_str)
            proposed_path = os.path.join(proposed_dir, d["filename"])

            if curr_path != proposed_path:
                proposals.append({
                    "file_id": d["id"],
                    "filename": d["filename"],
                    "current_path": curr_path,
                    "proposed_path": proposed_path,
                    "reason": f"Categorized as '{cat}' from year {year_str}"
                })

        return {
            "folder_path": root_path,
            "proposals": proposals,
            "total_proposals": len(proposals)
        }

    def execute_organization(self, approved_moves: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Executes approved file moves ONLY after explicit confirmation.
        Validates all paths against monitored directories and records operations in audit logs.
        """
        monitored_paths = [f["path"] for f in metadata_store.list_folders() if f.get("is_active")]
        executed_count = 0
        errors = []

        for move in approved_moves:
            curr_path = move.get("current_path")
            prop_path = move.get("proposed_path")

            if not curr_path or not prop_path:
                continue

            # Validate security boundaries
            if not validate_path_within_roots(curr_path, monitored_paths) or not validate_path_within_roots(prop_path, monitored_paths):
                errors.append(f"Security boundary check failed for: {curr_path}")
                continue

            if not os.path.exists(curr_path):
                errors.append(f"Source file not found on disk: {curr_path}")
                continue

            try:
                os.makedirs(os.path.dirname(prop_path), exist_ok=True)
                shutil.move(curr_path, prop_path)
                executed_count += 1
                logger.info(f"Successfully moved file '{curr_path}' -> '{prop_path}'")
            except Exception as e:
                errors.append(f"Failed moving {curr_path}: {e}")

        # Record operation in audit logs
        metadata_store.log_operation(
            operation="file_reorganization",
            status="completed" if not errors else "partial",
            details={"executed_count": executed_count, "errors": errors}
        )

        return {
            "executed_count": executed_count,
            "errors": errors,
            "message": f"Successfully reorganized {executed_count} file(s)."
        }


organization_service = OrganizationService()

