import re
from datetime import datetime
from typing import List, Dict, Any
from app.core.metadata_store import metadata_store


class TimelineService:
    def get_timeline(self, limit: int = 100) -> Dict[str, Any]:
        """Returns chronological events extracted from indexed documents."""
        # Check if stored events exist in database
        stored_events = metadata_store.get_timeline_events(limit=limit)
        if stored_events:
            return {"events": stored_events, "total": len(stored_events)}

        # Dynamically extract timeline events from indexed documents
        docs, _ = metadata_store.list_documents(page=1, page_size=60)
        events: List[Dict[str, Any]] = []

        date_regex = re.compile(r"\b((?:19|20)\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01]))\b")

        for doc in docs:
            preview = doc.get("content_preview") or ""
            filename = doc["filename"]
            cat = doc.get("category") or "Document"

            matches = date_regex.finditer(preview)
            for m in matches:
                d_str = m.group(1).replace("/", "-")
                # Normalize date parts
                parts = d_str.split("-")
                if len(parts) == 3:
                    yyyy, mm, dd = parts[0], parts[1].zfill(2), parts[2].zfill(2)
                    iso_date = f"{yyyy}-{mm}-{dd}"
                else:
                    iso_date = d_str

                # Surrounding sentence as description
                start = max(0, m.start() - 60)
                end = min(len(preview), m.end() + 80)
                excerpt = preview[start:end].strip()

                events.append({
                    "id": len(events) + 1,
                    "file_id": doc["id"],
                    "filename": filename,
                    "event_date": iso_date,
                    "title": f"{cat} Event ({filename})",
                    "description": excerpt,
                    "confidence": 0.85,
                    "source_page": 1,
                    "source_excerpt": excerpt
                })

                if len(events) >= limit:
                    break

            # Add discovered/modified date as a baseline event
            if doc.get("modified_at"):
                m_date = doc["modified_at"]
                m_str = m_date.strftime("%Y-%m-%d") if isinstance(m_date, datetime) else str(m_date)[:10]
                events.append({
                    "id": len(events) + 1,
                    "file_id": doc["id"],
                    "filename": filename,
                    "event_date": m_str,
                    "title": f"Document Modified: {filename}",
                    "description": f"File '{filename}' was modified on disk.",
                    "confidence": 1.0,
                    "source_page": 1,
                    "source_excerpt": f"Filesystem modified timestamp: {m_str}"
                })

        # Sort chronologically descending
        events.sort(key=lambda x: x["event_date"], reverse=True)
        return {"events": events[:limit], "total": len(events)}


timeline_service = TimelineService()

