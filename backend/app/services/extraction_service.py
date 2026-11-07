import re
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from app.core.metadata_store import metadata_store

logger = logging.getLogger("file_archaeologist.extraction")


class ExtractionService:
    """Extracts structured schema fields for specific document categories."""

    def extract_and_save(self, file_id: int, category: str, text: str) -> Dict[str, Any]:
        data: Dict[str, Any] = {}
        confidence = 0.85

        if category == "Invoice":
            data = self._extract_invoice(text)
        elif category == "Receipt":
            data = self._extract_receipt(text)
        elif category == "Contract":
            data = self._extract_contract(text)
        elif category == "Resume":
            data = self._extract_resume(text)
        elif category == "Purchase Order":
            data = self._extract_purchase_order(text)
        elif category == "Report":
            data = self._extract_report(text)
        else:
            data = self._extract_general(text)
            confidence = 0.70

        if data:
            metadata_store.save_extractions(
                file_id=file_id,
                extraction_type=category.lower().replace(" ", "_"),
                data=data,
                confidence=confidence
            )

        return data

    def _extract_invoice(self, text: str) -> Dict[str, Any]:
        res: Dict[str, Any] = {}
        # 1. Invoice Number
        inv_match = re.search(r"(?:invoice\s*(?:no|number|#|id)\s*[:.\s]+)([a-zA-Z0-9_-]{3,30})", text, re.I)
        if not inv_match:
            inv_match = re.search(r"\b(?:inv|invoice)[-_#]?\s*([0-9]+[a-zA-Z0-9_-]*)", text, re.I)
        if inv_match:
            val = inv_match.group(1).strip()
            if val.lower() != "number":
                res["invoice_number"] = val

        # 2. Total Amount
        total_match = re.search(r"(?:total|amount\s*due|grand\s*total)[:.\s]*([$€£¥₹]?\s*[\d,]+(?:\.\d{2})?)", text, re.I)
        if total_match:
            val = total_match.group(1).strip()
            res["total"] = val
            # Detect currency
            for curr_sym, curr_code in [("$", "USD"), ("€", "EUR"), ("£", "GBP"), ("¥", "JPY"), ("₹", "INR")]:
                if curr_sym in val:
                    res["currency"] = curr_code
                    break
            if "currency" not in res:
                res["currency"] = "USD"

        # 3. Tax / VAT
        tax_match = re.search(r"(?:tax|vat|gst)[:.\s]*([$€£¥₹]?\s*[\d,]+(?:\.\d{2})?)", text, re.I)
        if tax_match:
            res["tax"] = tax_match.group(1).strip()

        # 4. Dates
        date_matches = re.findall(r"\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b", text)
        if date_matches:
            res["invoice_date"] = date_matches[0]
            if len(date_matches) > 1:
                res["due_date"] = date_matches[1]

        # 5. Supplier / Billed To
        supplier_match = re.search(r"(?:from|supplier|vendor|biller)[:.\s]+([^\n\r,]{3,40})", text, re.I)
        if supplier_match:
            res["supplier"] = supplier_match.group(1).strip()

        return res

    def _extract_receipt(self, text: str) -> Dict[str, Any]:
        res: Dict[str, Any] = {}
        merchant_match = re.search(r"(?:merchant|store|shop|retailer)[:.\s]+([^\n\r,]{3,40})", text, re.I)
        if merchant_match:
            res["merchant"] = merchant_match.group(1).strip()

        total_match = re.search(r"(?:total|paid|amount)[:.\s]*([$€£¥₹]?\s*[\d,]+(?:\.\d{2})?)", text, re.I)
        if total_match:
            res["total_amount"] = total_match.group(1).strip()

        date_match = re.search(r"\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b", text)
        if date_match:
            res["receipt_date"] = date_match.group(0)

        payment_match = re.search(r"(?:visa|mastercard|amex|cash|debit|credit\s*card)", text, re.I)
        if payment_match:
            res["payment_method"] = payment_match.group(0).upper()

        return res

    def _extract_contract(self, text: str) -> Dict[str, Any]:
        res: Dict[str, Any] = {}
        # Parties
        parties_match = re.search(r"between\s+([^\n\r]+?)\s+and\s+([^\n\r]+?)(?:,|\.|\s+whereas)", text, re.I)
        if parties_match:
            res["party_a"] = parties_match.group(1).strip()
            res["party_b"] = parties_match.group(2).strip()

        # Dates
        eff_match = re.search(r"(?:effective\s*date|dated\s*as\s*of)[:.\s]*([^\n\r,]{6,30})", text, re.I)
        if eff_match:
            res["effective_date"] = eff_match.group(1).strip()

        exp_match = re.search(r"(?:term|expiration\s*date|terminates\s*on)[:.\s]*([^\n\r,]{6,30})", text, re.I)
        if exp_match:
            res["expiration_date"] = exp_match.group(1).strip()

        # Governing Law
        law_match = re.search(r"(?:governed\s*by\s*(?:the\s*laws\s*of)?)\s*([^\n\r,.;]{3,40})", text, re.I)
        if law_match:
            res["governing_law"] = law_match.group(1).strip()

        return res

    def _extract_resume(self, text: str) -> Dict[str, Any]:
        res: Dict[str, Any] = {}
        email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
        if email_match:
            res["email"] = email_match.group(0)

        phone_match = re.search(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", text)
        if phone_match:
            res["phone"] = phone_match.group(0)

        skills_list = ["Python", "JavaScript", "TypeScript", "React", "Node.js", "Docker", "Kubernetes", "AWS", "SQL", "Git", "Go", "Java", "C++", "Rust", "FastAPI", "Tailwind", "Machine Learning"]
        found_skills = [s for s in skills_list if re.search(rf"\b{re.escape(s)}\b", text, re.I)]
        if found_skills:
            res["skills"] = found_skills

        return res

    def _extract_purchase_order(self, text: str) -> Dict[str, Any]:
        res: Dict[str, Any] = {}
        po_match = re.search(r"(?:po\s*(?:no|number|#)?[:.\s]*)([a-zA-Z0-9_-]{3,20})", text, re.I)
        if po_match:
            res["po_number"] = po_match.group(1).strip()

        vendor_match = re.search(r"(?:vendor|supplier)[:.\s]+([^\n\r,]{3,40})", text, re.I)
        if vendor_match:
            res["vendor"] = vendor_match.group(1).strip()

        total_match = re.search(r"(?:total|amount)[:.\s]*([$€£¥₹]?\s*[\d,]+(?:\.\d{2})?)", text, re.I)
        if total_match:
            res["total_amount"] = total_match.group(1).strip()

        return res

    def _extract_report(self, text: str) -> Dict[str, Any]:
        res: Dict[str, Any] = {}
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        if lines:
            res["title"] = lines[0][:100]

        exec_match = re.search(r"(?:executive\s*summary|overview|abstract)[:.\s]*([^\n\r]{20,250})", text, re.I)
        if exec_match:
            res["summary"] = exec_match.group(1).strip()

        return res

    def _extract_general(self, text: str) -> Dict[str, Any]:
        res: Dict[str, Any] = {}
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        if lines:
            res["title"] = lines[0][:80]
        dates = re.findall(r"\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b", text)
        if dates:
            res["dates_found"] = dates[:3]
        return res


extraction_service = ExtractionService()
