import re
import logging
from typing import Dict, Any, Tuple, Optional
from app.core.metadata_store import metadata_store

logger = logging.getLogger("file_archaeologist.classifier")

CATEGORIES = [
    "Invoice",
    "Receipt",
    "Contract",
    "Report",
    "Resume",
    "Purchase Order",
    "Research Paper",
    "Technical Documentation",
    "Presentation",
    "Spreadsheet",
    "General Document"
]

CATEGORY_PATTERNS = {
    "Invoice": {
        "keywords": [r"\binvoice\b", r"\bbill to\b", r"\binvoice no\b", r"\binvoice number\b", r"\bdue date\b", r"\bamount due\b", r"\btax invoice\b", r"\bvat\b", r"\bgst\b", r"\bsubtotal\b"],
        "filename": [r"inv(?:oice)?", r"bill"],
        "extensions": [".pdf", ".txt", ".docx"]
    },
    "Receipt": {
        "keywords": [r"\breceipt\b", r"\bpayment received\b", r"\btransaction id\b", r"\bmerchant\b", r"\bcard ending\b", r"\bcashier\b", r"\btotal paid\b"],
        "filename": [r"receipt", r"rec_"],
        "extensions": [".pdf", ".jpg", ".png", ".txt"]
    },
    "Contract": {
        "keywords": [r"\bagreement\b", r"\bcontract\b", r"\bparties\b", r"\bhereby agrees\b", r"\bterms and conditions\b", r"\bconfidentiality\b", r"\bnda\b", r"\bindemnification\b", r"\bgoverning law\b", r"\bin witness whereof\b"],
        "filename": [r"contract", r"agreement", r"nda"],
        "extensions": [".pdf", ".docx", ".doc"]
    },
    "Resume": {
        "keywords": [r"\bresume\b", r"\bcurriculum vitae\b", r"\bexperience\b", r"\beducation\b", r"\bskills\b", r"\bemployment history\b", r"\bwork history\b", r"\bprojects\b", r"\bcertifications\b"],
        "filename": [r"resume", r"cv"],
        "extensions": [".pdf", ".docx", ".doc"]
    },
    "Purchase Order": {
        "keywords": [r"\bpurchase order\b", r"\bpo number\b", r"\bpo #\b", r"\bvendor\b", r"\bship to\b", r"\border date\b", r"\bline item\b"],
        "filename": [r"purchase_order", r"\bpo_"],
        "extensions": [".pdf", ".xlsx", ".csv"]
    },
    "Research Paper": {
        "keywords": [r"\babstract\b", r"\bintroduction\b", r"\bmethodology\b", r"\breferences\b", r"\bdoi:\b", r"\barxiv\b", r"\bliterature review\b", r"\bconclusion\b"],
        "filename": [r"paper", r"thesis", r"study"],
        "extensions": [".pdf"]
    },
    "Technical Documentation": {
        "keywords": [r"\bapi reference\b", r"\bdocumentation\b", r"\bsdk\b", r"\barchitecture\b", r"\bquickstart\b", r"\binstallation\b", r"\bcli\b", r"\bendpoints\b", r"\bcurl\b"],
        "filename": [r"docs?", r"readme", r"api", r"guide", r"spec"],
        "extensions": [".md", ".html", ".txt", ".json"]
    },
    "Presentation": {
        "keywords": [r"\bslide\b", r"\bagenda\b", r"\bkeynote\b", r"\bpresentation\b"],
        "filename": [r"slide", r"deck", r"presentation"],
        "extensions": [".pptx", ".ppt", ".pdf"]
    },
    "Spreadsheet": {
        "keywords": [r"\bbalance sheet\b", r"\bp&l\b", r"\bledger\b", r"\bforecast\b", r"\bfinancials\b"],
        "filename": [r"sheet", r"ledger", r"data", r"export", r"report"],
        "extensions": [".xlsx", ".xls", ".csv", ".tsv"]
    },
    "Report": {
        "keywords": [r"\bexecutive summary\b", r"\bannual report\b", r"\bquarterly report\b", r"\boverview\b", r"\bfindings\b", r"\bquarter\b", r"\bfy\d{2,4}\b"],
        "filename": [r"report", r"summary", r"analysis"],
        "extensions": [".pdf", ".docx"]
    }
}


class ClassifierService:
    def classify_text_and_meta(
        self,
        filename: str,
        extension: str,
        text_content: Optional[str] = None
    ) -> Tuple[str, float]:
        """Classifies a document based on its extension, filename, and extracted text."""
        scores: Dict[str, float] = {cat: 0.0 for cat in CATEGORIES}
        fn_lower = filename.lower()
        ext_lower = extension.lower() if extension.startswith(".") else f".{extension.lower()}"
        text_sample = (text_content or "")[:4000].lower()

        # 1. Extension matching
        if ext_lower in [".xlsx", ".xls", ".csv", ".tsv"]:
            scores["Spreadsheet"] += 3.0
        elif ext_lower in [".pptx", ".ppt"]:
            scores["Presentation"] += 3.0
        elif ext_lower in [".md"]:
            scores["Technical Documentation"] += 2.0

        # 2. Filename patterns
        for cat, conf in CATEGORY_PATTERNS.items():
            for fpat in conf.get("filename", []):
                if re.search(fpat, fn_lower):
                    scores[cat] += 2.5

            if ext_lower in conf.get("extensions", []):
                scores[cat] += 0.5

        # 3. Content keyword matching
        if text_sample:
            for cat, conf in CATEGORY_PATTERNS.items():
                kw_matches = 0
                for kw in conf.get("keywords", []):
                    if re.search(kw, text_sample):
                        kw_matches += 1
                if kw_matches > 0:
                    scores[cat] += kw_matches * 1.5

        # Find category with highest score
        best_cat = "General Document"
        best_score = scores.get("General Document", 0.0)

        for cat, sc in scores.items():
            if sc > best_score:
                best_score = sc
                best_cat = cat

        # Calculate confidence between 0.50 and 0.98
        if best_cat == "General Document" or best_score < 1.0:
            confidence = 0.50
        else:
            confidence = min(0.98, round(0.60 + (best_score * 0.05), 2))

        return best_cat, confidence

    def classify_and_save(self, file_id: int, filename: str, extension: str, text_content: Optional[str] = None) -> Tuple[str, float]:
        category, confidence = self.classify_text_and_meta(filename, extension, text_content)
        metadata_store.update_document_classification(
            file_id=file_id,
            category=category,
            confidence=confidence,
            model="rule_heuristic_v1"
        )
        return category, confidence

    def manual_override(self, file_id: int, category: str) -> None:
        if category not in CATEGORIES:
            raise ValueError(f"Invalid category: {category}")
        metadata_store.update_document_classification(
            file_id=file_id,
            category=category,
            confidence=1.0,
            model="user_override",
            user_override=category
        )


classifier_service = ClassifierService()

