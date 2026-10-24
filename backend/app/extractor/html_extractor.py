from pathlib import Path
from bs4 import BeautifulSoup
from app.extractor.base import BaseExtractor, ExtractionResult


class HtmlExtractor(BaseExtractor):
    """
    Extracts visible text from HTML/HTM files without remote network calls.
    Strips scripts, styles, metadata, and tags.
    """

    def extract(self, file_path: Path) -> ExtractionResult:
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read(500000)

            soup = BeautifulSoup(content, "html.parser")

            # Remove javascript, style sheets, and hidden metadata
            for element in soup(["script", "style", "meta", "noscript", "svg"]):
                element.decompose()

            text = soup.get_text(separator=" ")
            cleaned = self.clean_text(text)

            if not cleaned or len(cleaned.strip()) < 10:
                return ExtractionResult(
                    text="", preview="", is_skipped=True,
                    skip_reason="HTML contains no visible text content"
                )

            preview = cleaned[:500]
            return ExtractionResult(text=cleaned, preview=preview)

        except Exception as e:
            return ExtractionResult(
                text="", preview="", error=f"HTML parsing error: {str(e)[:200]}"
            )
