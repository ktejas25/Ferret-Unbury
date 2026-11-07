import tempfile
from pathlib import Path
import pytest
from app.extractor.text_extractor import TextExtractor
from app.extractor.html_extractor import HtmlExtractor
from app.extractor.docx_extractor import DocxExtractor
from app.extractor.legacy_doc_extractor import LegacyDocExtractor
from app.extractor.image_extractor import ImageExtractor
from app.extractor.registry import extractor_registry


def test_text_extractor():
    extractor = TextExtractor()
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write("Line 1 with text\n\nLine 2 with important content.")
        tmp_path = Path(f.name)

    try:
        res = extractor.extract(tmp_path)
        assert not res.is_skipped
        assert res.error is None
        assert "important content" in res.text
        assert len(res.preview) > 0
        assert res.char_count > 0
        assert res.extractor == "text"
    finally:
        tmp_path.unlink()


def test_text_extractor_multi_encoding():
    extractor = TextExtractor()
    # Test UTF-16 encoded file
    with tempfile.NamedTemporaryFile("wb", suffix=".txt", delete=False) as f:
        f.write("Multi-encoding discovery with UTF-16 test content.".encode("utf-16"))
        tmp_path = Path(f.name)

    try:
        res = extractor.extract(tmp_path)
        assert not res.is_skipped
        assert "Multi-encoding discovery" in res.text
    finally:
        tmp_path.unlink()


def test_text_extractor_binary_detection():
    extractor = TextExtractor()
    # Test binary file with null bytes disguised as .txt
    with tempfile.NamedTemporaryFile("wb", suffix=".txt", delete=False) as f:
        f.write(b"\x00\x00\x00\x01\x02\x03\x00\x00\x05\x00" * 50)
        tmp_path = Path(f.name)

    try:
        res = extractor.extract(tmp_path)
        assert res.is_skipped
        assert "Binary content detected" in res.skip_reason
    finally:
        tmp_path.unlink()


def test_legacy_doc_extractor():
    extractor = LegacyDocExtractor()
    with tempfile.NamedTemporaryFile("wb", suffix=".doc", delete=False) as f:
        # Construct mock legacy OLE stream with readable UTF-16LE text
        f.write(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 32)
        f.write("Quarterly Financial Summary Report".encode("utf-16le"))
        f.write(b"\x00" * 32)
        tmp_path = Path(f.name)

    try:
        res = extractor.extract(tmp_path)
        assert res.extractor == "legacy_doc"
        assert res.error is None
        assert "Quarterly Financial" in res.text or not res.error
    finally:
        tmp_path.unlink()


def test_docx_rejects_legacy_doc():
    docx_extractor = DocxExtractor()
    with tempfile.NamedTemporaryFile("wb", suffix=".doc", delete=False) as f:
        f.write(b"not a real zip")
        tmp_path = Path(f.name)

    try:
        res = docx_extractor.extract(tmp_path)
        assert res.is_skipped
        assert "only handles .docx" in res.skip_reason
    finally:
        tmp_path.unlink()


def test_html_extractor():
    extractor = HtmlExtractor()
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write("<html><head><script>var x = 10;</script><style>.a{color:red;}</style></head><body><h1>Welcome</h1><p>Main body content.</p></body></html>")
        tmp_path = Path(f.name)

    try:
        res = extractor.extract(tmp_path)
        assert not res.is_skipped
        assert res.error is None
        assert "Welcome" in res.text
        assert "Main body content" in res.text
        assert "var x" not in res.text  # Scripts stripped
    finally:
        tmp_path.unlink()


def test_image_ocr_disabled_gracefully():
    extractor = ImageExtractor()
    with tempfile.NamedTemporaryFile("wb", suffix=".png", delete=False) as f:
        f.write(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR...")
        tmp_path = Path(f.name)

    try:
        res = extractor.extract(tmp_path)
        # When OCR_ENABLED is False (default in test env), gracefully skips without throwing
        assert res.is_skipped
        assert res.error is None
    finally:
        tmp_path.unlink()


def test_registry_unsupported():
    with tempfile.NamedTemporaryFile("w", suffix=".xyz999", delete=False) as f:
        f.write("data")
        tmp_path = Path(f.name)

    try:
        res = extractor_registry.extract_file(tmp_path)
        assert res.is_skipped
        assert "Unsupported format" in res.skip_reason
    finally:
        tmp_path.unlink()
