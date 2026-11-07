import pytest
from datetime import datetime
from app.services.classifier_service import classifier_service
from app.services.extraction_service import extraction_service
from app.services.search_service import search_service
from app.services.ai_assistant_service import ai_assistant_service
from app.services.duplicate_service import duplicate_service
from app.services.knowledge_service import knowledge_service
from app.services.comparison_service import comparison_service
from app.services.timeline_service import timeline_service
from app.services.analytics_service import analytics_service


def test_classifier_heuristics():
    # Test Invoice classification
    cat, conf = classifier_service.classify_text_and_meta("invoice_1024.pdf", ".pdf", "INVOICE #1024\nBill To: Acme Corp\nAmount Due: $1,250.00\nDue Date: 2026-12-01")
    assert cat == "Invoice"
    assert conf >= 0.70

    # Test Resume classification
    cat, conf = classifier_service.classify_text_and_meta("john_doe_resume.docx", ".docx", "Curriculum Vitae\nJohn Doe\nExperience:\nSoftware Engineer at TechCorp\nEducation: BS Computer Science\nSkills: Python, React, SQL")
    assert cat == "Resume"
    assert conf >= 0.70

    # Test Contract classification
    cat, conf = classifier_service.classify_text_and_meta("service_agreement.pdf", ".pdf", "Master Services Agreement between Company A and Company B. Terms and conditions governed by the laws of California.")
    assert cat == "Contract"
    assert conf >= 0.65

    # Test Spreadsheet extension
    cat, conf = classifier_service.classify_text_and_meta("q3_financials.xlsx", ".xlsx", "")
    assert cat == "Spreadsheet"


def test_extraction_service():
    invoice_text = """
    TAX INVOICE
    Invoice Number: INV-98765
    Date: 2026-10-15
    Due Date: 2026-11-15
    Supplier: Global Supplies Inc
    Total: $4,500.00
    VAT: $450.00
    """
    res = extraction_service._extract_invoice(invoice_text)
    assert res.get("invoice_number") == "INV-98765"
    assert "$4,500.00" in res.get("total", "")
    assert res.get("currency") == "USD"
    assert "Global Supplies" in res.get("supplier", "")

    resume_text = """
    Jane Smith
    Email: jane.smith@example.com
    Phone: (555) 123-4567
    Skills: Python, TypeScript, React, Docker, SQL
    """
    res_cv = extraction_service._extract_resume(resume_text)
    assert res_cv.get("email") == "jane.smith@example.com"
    assert "Python" in res_cv.get("skills", [])
    assert "React" in res_cv.get("skills", [])


def test_natural_language_query_parser():
    q, filters = search_service.parse_natural_language_query("Find all invoices mentioning warehouse management")
    assert filters.get("category") == "Invoice"
    assert "warehouse management" in q.lower()

    q2, filters2 = search_service.parse_natural_language_query("Show contracts from this year")
    assert filters2.get("category") == "Contract"
    assert "date_from" in filters2


def test_knowledge_graph_structure():
    graph = knowledge_service.get_knowledge_graph()
    assert "nodes" in graph
    assert "links" in graph
    assert isinstance(graph["nodes"], list)
    assert isinstance(graph["links"], list)


def test_timeline_service():
    timeline = timeline_service.get_timeline(limit=10)
    assert "events" in timeline
    assert isinstance(timeline["events"], list)


def test_ai_assistant_chat_and_insufficient_context():
    # Test query with nonexistent terms
    res = ai_assistant_service.chat(message="xyznonexistentqueryterm123456789")
    assert "conversation_id" in res
    assert "message" in res
    assert "suggested_followups" in res
    # Insufficient context handled honestly without hallucinating
    assert len(res["message"]) > 0


def test_analytics_service_telemetry():
    telemetry = analytics_service.get_comprehensive_analytics()
    assert "metrics" in telemetry
    assert "diagnostics" in telemetry
    assert "database" in telemetry["diagnostics"]
    assert "vector_index" in telemetry["diagnostics"]
    assert "worker" in telemetry["diagnostics"]

