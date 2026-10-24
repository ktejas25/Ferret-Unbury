import logging
from pathlib import Path
from typing import Dict, Optional
from app.extractor.base import BaseExtractor, ExtractionResult
from app.extractor.text_extractor import TextExtractor
from app.extractor.pdf_extractor import PdfExtractor
from app.extractor.docx_extractor import DocxExtractor
from app.extractor.html_extractor import HtmlExtractor
from app.extractor.image_extractor import ImageExtractor
from app.config import settings

logger = logging.getLogger("file_archaeologist.extractor_registry")


class ExtractorRegistry:
    """
    Central registry routing file paths to the appropriate text extractor.
    Enforces size limits, ignored extensions, and safe unsupported-file fallback.
    """

    def __init__(self):
        self.text_extractor = TextExtractor()
        self.pdf_extractor = PdfExtractor()
        self.docx_extractor = DocxExtractor()
        self.html_extractor = HtmlExtractor()
        self.image_extractor = ImageExtractor()

    def get_extractor(self, ext: str) -> Optional[BaseExtractor]:
        normalized = ext.lower()
        if normalized == ".pdf":
            return self.pdf_extractor
        elif normalized in (".docx", ".doc"):
            return self.docx_extractor
        elif normalized in (".html", ".htm"):
            return self.html_extractor
        elif normalized in ImageExtractor.SUPPORTED_EXTENSIONS:
            return self.image_extractor
        elif normalized in TextExtractor.SUPPORTED_EXTENSIONS:
            return self.text_extractor
        return None

    def extract_file(self, file_path: Path) -> ExtractionResult:
        if not file_path.exists():
            return ExtractionResult(text="", preview="", error="File does not exist on disk")

        # Check ignored extensions
        ext = file_path.suffix.lower()
        if ext in settings.ignored_extension_set:
            return ExtractionResult(text="", preview="", is_skipped=True, skip_reason=f"Extension '{ext}' is in ignored extensions list")

        # Check maximum file size
        try:
            size = file_path.stat().st_size
            if size > settings.MAX_FILE_SIZE_BYTES:
                return ExtractionResult(
                    text="", preview="", is_skipped=True,
                    skip_reason=f"File size ({size} bytes) exceeds limit ({settings.MAX_FILE_SIZE_BYTES} bytes)"
                )
            if size == 0:
                return ExtractionResult(text="", preview="", is_skipped=True, skip_reason="Empty file (0 bytes)")
        except Exception as e:
            return ExtractionResult(text="", preview="", error=f"Could not read file stat: {e}")

        extractor = self.get_extractor(ext)
        if extractor is None:
            return ExtractionResult(
                text="", preview="", is_skipped=True,
                skip_reason=f"Unsupported format '{ext}'"
            )

        try:
            return extractor.extract(file_path)
        except Exception as e:
            return ExtractionResult(text="", preview="", error=f"Unhandled extraction error: {e}")


extractor_registry = ExtractorRegistry()
