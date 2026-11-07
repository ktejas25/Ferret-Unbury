import re
import logging
from pathlib import Path
from app.extractor.base import BaseExtractor, ExtractionResult

logger = logging.getLogger("file_archaeologist.legacy_doc_extractor")


class LegacyDocExtractor(BaseExtractor):
    """
    Safely handles legacy Microsoft Word (.doc) binary files.
    Extracts embedded UTF-16LE and ASCII text streams without calling python-docx
    or native Word automation, preventing crashes on binary OLE structures.
    """

    def extract(self, file_path: Path) -> ExtractionResult:
        try:
            with open(file_path, "rb") as f:
                raw_bytes = f.read(500000)  # Read up to 500KB

            if not raw_bytes:
                return ExtractionResult(
                    text="", preview="", is_skipped=True,
                    skip_reason="Empty legacy DOC file",
                    extractor="legacy_doc",
                )

            # Strategy 1: Search for UTF-16LE text sequences (standard in Word 97-2003 OLE streams)
            # Find contiguous readable UTF-16LE characters (printable ASCII ranges in UTF-16)
            utf16_matches = re.findall(b"(?:[\x20-\x7e]\x00){4,}", raw_bytes)
            extracted_words = []
            for m in utf16_matches:
                try:
                    decoded = m.decode("utf-16le", errors="ignore").strip()
                    if len(decoded) >= 3 and not decoded.startswith(("Normal", "Default", "Times New Roman")):
                        extracted_words.append(decoded)
                except Exception:
                    continue

            # Strategy 2: Search for ASCII/Latin-1 strings (length >= 4)
            ascii_matches = re.findall(b"[\x20-\x7e\n\r\t]{4,}", raw_bytes)
            for m in ascii_matches:
                try:
                    decoded = m.decode("latin-1", errors="ignore").strip()
                    # Filter out common OLE/Word header noise
                    if len(decoded) >= 4 and not decoded.startswith(("Microsoft Word", "Root Entry", "WordDocument")):
                        extracted_words.append(decoded)
                except Exception:
                    continue

            combined = " ".join(extracted_words)
            cleaned = self.clean_text(combined)

            if len(cleaned) < 15:
                return ExtractionResult(
                    text="",
                    preview="",
                    is_skipped=True,
                    skip_reason="Legacy Word (.doc) binary format contains insufficient extractable text; convert to .docx for complete indexing",
                    extractor="legacy_doc",
                )

            preview = cleaned[:500]
            return ExtractionResult(
                text=cleaned,
                preview=preview,
                extractor="legacy_doc",
            )

        except Exception as e:
            logger.warning(f"Error inspecting legacy .doc {file_path.name}: {e}")
            return ExtractionResult(
                text="",
                preview="",
                is_skipped=True,
                skip_reason=f"Legacy Word (.doc) binary could not be parsed: {str(e)[:150]}",
                extractor="legacy_doc",
            )

