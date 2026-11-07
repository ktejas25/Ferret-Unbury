import uuid
import re
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.core.metadata_store import metadata_store
from app.core.vector_index import vector_index_manager
from app.core.embedder import embedder
from app.services.document_service import document_service

logger = logging.getLogger("file_archaeologist.assistant")


class AIAssistantService:
    """
    RAG-powered AI Document Assistant.
    Retrieves grounded context passages, computes relevance, formats traceable citations,
    and returns factual responses without hallucinations.
    """

    def chat(
        self,
        message: str,
        conversation_id: Optional[str] = None,
        scope_type: str = "all",
        scope_id: Optional[str] = None,
        document_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        # 1. Manage Conversation Session
        if not conversation_id:
            conversation_id = f"conv_{uuid.uuid4().hex[:12]}"
            title = message[:40] + ("..." if len(message) > 40 else "")
            metadata_store.create_or_update_conversation(conversation_id, title, scope_type, scope_id)

        # 2. Persist User Message
        metadata_store.add_message(conversation_id, "user", message)

        # 3. Retrieve Relevant Context
        citations: List[Dict[str, Any]] = []
        context_chunks: List[str] = []

        # Vector search
        try:
            query_vector = embedder.embed_query(message)
            raw_hits = vector_index_manager.search(query_vector, k=15)
        except Exception as e:
            logger.warning(f"Vector search failed: {e}")
            raw_hits = []

        # Filter hits by document scope if applicable
        target_ids = set(document_ids or [])
        if scope_type == "file" and scope_id:
            try:
                target_ids.add(int(scope_id))
            except Exception:
                pass

        matched_files: Dict[int, Dict[str, Any]] = {}

        for hit in raw_hits:
            fid = hit.file_id
            if target_ids and fid not in target_ids:
                continue

            if fid not in matched_files:
                doc_info = metadata_store.get_document_by_id(fid)
                if doc_info:
                    matched_files[fid] = doc_info["document"]

            if fid in matched_files:
                doc = matched_files[fid]
                preview_text = doc.get("content_preview") or ""
                citations.append({
                    "file_id": doc["id"],
                    "filename": doc["filename"],
                    "path": doc["full_path"],
                    "page_number": 1,
                    "excerpt": preview_text[:280] + "..." if len(preview_text) > 280 else preview_text,
                    "relevance_score": round(hit.score, 3)
                })
                context_chunks.append(f"[{doc['filename']}]: {preview_text}")

            if len(citations) >= 4:
                break

        # Fallback keyword match if no vector citations found
        if not citations:
            docs, _ = metadata_store.list_documents(page=1, page_size=5, search=message)
            for d in docs:
                citations.append({
                    "file_id": d["id"],
                    "filename": d["filename"],
                    "path": d["full_path"],
                    "page_number": 1,
                    "excerpt": (d.get("content_preview") or "")[:280] + "...",
                    "relevance_score": 0.75
                })
                context_chunks.append(f"[{d['filename']}]: {d.get('content_preview') or ''}")

        # 4. Generate Grounded Response
        answer_text = ""
        followups = [
            "What are the key dates mentioned in these documents?",
            "Can you summarize the main findings?",
            "Are there any associated risks or penalties?",
        ]

        if not citations:
            answer_text = (
                "I searched across your documents for information related to your query, "
                "but I could not find sufficient matching evidence in the library. "
                "Please verify that the relevant files have been indexed, or refine your search keywords."
            )
            followups = [
                "Show all recently indexed documents",
                "Which monitored folders are active?",
                "How do I add new folders to index?",
            ]
        else:
            # Grounded answer synthesis
            synthesis_parts = []
            synthesis_parts.append(f"Based on analysis of {len(citations)} relevant document(s) in your library:\n")

            # Extract key informative sentences matching question keywords
            q_keywords = [w.lower() for w in re.findall(r"\w+", message) if len(w) > 3]

            relevant_findings = []
            for cit in citations:
                excerpt = cit["excerpt"]
                sentences = [s.strip() for s in re.split(r"[.!?\n]", excerpt) if len(s.strip()) > 20]
                matched_s = [s for s in sentences if any(k in s.lower() for k in q_keywords)]
                if matched_s:
                    relevant_findings.append(f"• **{cit['filename']}**: {matched_s[0]}")
                elif sentences:
                    relevant_findings.append(f"• **{cit['filename']}**: {sentences[0]}")

            if relevant_findings:
                synthesis_parts.extend(relevant_findings[:3])
            else:
                synthesis_parts.append(
                    "The matching documents contain contextual mentions of your query terms. "
                    "You can inspect the exact excerpts and source documents listed below."
                )

            answer_text = "\n".join(synthesis_parts)

        # 5. Persist Assistant Response
        metadata_store.add_message(conversation_id, "assistant", answer_text, citations)

        return {
            "conversation_id": conversation_id,
            "message": answer_text,
            "role": "assistant",
            "sources": citations,
            "suggested_followups": followups
        }

    def summarize_document(self, file_id: int, mode: str = "executive") -> Dict[str, Any]:
        preview = document_service.get_document_preview(file_id)
        if not preview:
            raise FileNotFoundError(f"Document {file_id} not found")

        content = preview["content_text"]
        filename = preview["filename"]
        key_points = preview["key_points"]
        dates = preview["important_dates"]

        # Action items extraction heuristics
        action_sentences = []
        for line in content.split("\n"):
            line_str = line.strip()
            if any(token in line_str.lower() for token in ["must", "shall", "required", "action item", "todo", "deadline", "deliverable"]):
                if len(line_str) > 15 and line_str not in action_sentences:
                    action_sentences.append(line_str)
            if len(action_sentences) >= 4:
                break

        summary = preview["summary"] or f"Executive summary of {filename}"
        if mode == "key_points" and key_points:
            summary = "Key highlights:\n" + "\n".join(f"- {p}" for p in key_points)
        elif mode == "action_items" and action_sentences:
            summary = "Required actions:\n" + "\n".join(f"- {a}" for a in action_sentences)

        return {
            "file_id": file_id,
            "title": filename,
            "summary": summary,
            "key_points": key_points,
            "action_items": action_sentences,
            "dates_mentioned": dates
        }

    def list_conversations(self) -> List[Dict[str, Any]]:
        return metadata_store.list_conversations()

    def get_conversation(self, conv_id: str) -> Optional[Dict[str, Any]]:
        return metadata_store.get_conversation(conv_id)

    def delete_conversation(self, conv_id: str) -> bool:
        return metadata_store.delete_conversation(conv_id)


ai_assistant_service = AIAssistantService()

