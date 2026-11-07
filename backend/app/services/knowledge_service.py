import re
import logging
from typing import Dict, Any, List, Optional
from app.core.metadata_store import metadata_store

logger = logging.getLogger("file_archaeologist.knowledge")

COMMON_TOPICS = [
    "Security", "Architecture", "Database", "Financial", "Invoice", "Contract",
    "API", "Machine Learning", "Deployment", "Frontend", "Backend", "Testing",
    "Analytics", "Compliance", "Strategy", "Operations", "Research"
]


class KnowledgeService:
    def get_knowledge_graph(self, filter_group: Optional[str] = None) -> Dict[str, Any]:
        """Builds an interactive knowledge graph of documents, entities, topics, and relationships."""
        docs, _ = metadata_store.list_documents(page=1, page_size=100)

        nodes: List[Dict[str, Any]] = []
        links: List[Dict[str, Any]] = []
        node_ids = set()

        def add_node(nid: str, name: str, group: str, val: int = 1, fid: Optional[int] = None, details: Optional[Dict] = None):
            if nid not in node_ids:
                node_ids.add(nid)
                nodes.append({
                    "id": nid,
                    "name": name,
                    "group": group,
                    "value": val,
                    "file_id": fid,
                    "details": details or {}
                })

        # 1. Add document nodes
        for doc in docs:
            d_id = f"doc_{doc['id']}"
            cat = doc.get("category") or "General Document"
            add_node(
                nid=d_id,
                name=doc["filename"],
                group="document",
                val=3,
                fid=doc["id"],
                details={
                    "category": cat,
                    "size": doc["size_bytes"],
                    "path": doc["full_path"]
                }
            )

            # Link document to its Category node
            cat_id = f"cat_{cat.lower().replace(' ', '_')}"
            add_node(nid=cat_id, name=cat, group="topic", val=5)
            links.append({
                "source": d_id,
                "target": cat_id,
                "relation": "belongs_to",
                "strength": 0.9,
                "evidence": f"Classified as {cat}"
            })

            # Check for Topics mentioned in content
            preview = (doc.get("content_preview") or "").lower()
            for topic in COMMON_TOPICS:
                if re.search(rf"\b{re.escape(topic.lower())}\b", preview):
                    top_id = f"top_{topic.lower()}"
                    add_node(nid=top_id, name=topic, group="topic", val=2)
                    links.append({
                        "source": d_id,
                        "target": top_id,
                        "relation": "mentions",
                        "strength": 0.7,
                        "evidence": f"Mentions {topic} in content"
                    })

            # Check for email domains / companies mentioned
            emails = re.findall(r"@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)", preview)
            for domain in list(dict.fromkeys(emails))[:2]:
                comp_name = domain.split(".")[0].capitalize()
                comp_id = f"comp_{comp_name.lower()}"
                add_node(nid=comp_id, name=comp_name, group="company", val=4)
                links.append({
                    "source": d_id,
                    "target": comp_id,
                    "relation": "references",
                    "strength": 0.8,
                    "evidence": f"References domain @{domain}"
                })

        # Apply group filtering if specified
        if filter_group and filter_group != "all":
            valid_node_ids = {n["id"] for n in nodes if n["group"] in ["document", filter_group]}
            nodes = [n for n in nodes if n["id"] in valid_node_ids]
            links = [l for l in links if l["source"] in valid_node_ids and l["target"] in valid_node_ids]

        return {
            "nodes": nodes,
            "links": links
        }


knowledge_service = KnowledgeService()

