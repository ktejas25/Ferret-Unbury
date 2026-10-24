import tempfile
from pathlib import Path
import pytest
from app.extractor.text_extractor import TextExtractor
from app.extractor.html_extractor import HtmlExtractor
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
