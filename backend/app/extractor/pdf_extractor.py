import logging
from pathlib import Path
from pypdf import PdfReader
from app.extractor.base import BaseExtractor, ExtractionResult

logger = logging.getLogger("file_archaeologist.pdf_extractor")


class PdfExtractor(BaseExtractor):
    """
    Extracts text page by page from PDF files using pypdf.
    Handles encrypted, malformed, or image-only PDFs gracefully.
    """

    def extract(self, file_path: Path) -> ExtractionResult:
        try:
            reader = PdfReader(str(file_path))
            if reader.is_encrypted:
                try:
                    # Attempt decrypt with empty password
                    decrypt_success = reader.decrypt("")
                    if not decrypt_success:
                        return ExtractionResult(
                            text="", preview="", is_skipped=True,
                            skip_reason="PDF is password-encrypted"
                        )
                except Exception:
                    return ExtractionResult(
                        text="", preview="", is_skipped=True,
                        skip_reason="PDF is password-encrypted"
                    )

            extracted_pages = []
            # Extract first 50 pages maximum
            max_pages = min(len(reader.pages), 50)
            for i in range(max_pages):
                try:
                    page = reader.pages[i]
                    text = page.extract_text()
                    if text:
                        extracted_pages.append(text)
                except Exception as e:
                    logger.debug(f"Error extracting PDF page {i} in {file_path.name}: {e}")

            full_text = " ".join(extracted_pages)
            cleaned = self.clean_text(full_text)

            if not cleaned or len(cleaned.strip()) < 10:
                return ExtractionResult(
                    text="", preview="", is_skipped=True,
                    skip_reason="PDF contains no extractable text (scanned or image-only)"
                )

            preview = cleaned[:500]
            return ExtractionResult(text=cleaned, preview=preview)

        except Exception as e:
            return ExtractionResult(
                text="", preview="", error=f"Malformed or unreadable PDF: {str(e)[:200]}"
            )
