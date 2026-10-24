from pathlib import Path
from app.extractor.base import BaseExtractor, ExtractionResult


class TextExtractor(BaseExtractor):
    """
    Extracts text from plaintext, Markdown, CSV, JSON, LOG, and source code files.
    Applies multi-encoding fallback (utf-8, cp1252, latin-1, utf-16).
    """

    SUPPORTED_EXTENSIONS = {
        ".txt", ".md", ".markdown", ".csv", ".json", ".log",
        ".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css",
        ".sql", ".sh", ".ps1", ".yaml", ".yml", ".xml", ".ini",
        ".toml", ".c", ".cpp", ".h", ".hpp", ".java", ".go",
        ".rs", ".rb", ".php", ".bat", ".cmd", ".env.example"
    }

    def extract(self, file_path: Path) -> ExtractionResult:
        encodings = ["utf-8", "utf-8-sig", "cp1252", "latin-1", "utf-16"]
        raw_text = None

        for enc in encodings:
            try:
                with open(file_path, "r", encoding=enc, errors="replace") as f:
                    raw_text = f.read(500000)  # Read up to 500KB
                break
            except Exception:
                continue

        if raw_text is None:
            return ExtractionResult(text="", preview="", is_skipped=True, skip_reason="Failed to decode file with standard encodings")

        cleaned = self.clean_text(raw_text)
        if not cleaned or len(cleaned.strip()) < 5:
            return ExtractionResult(text="", preview="", is_skipped=True, skip_reason="Empty or below minimum content threshold")

        preview = cleaned[:500]
        return ExtractionResult(text=cleaned, preview=preview)
