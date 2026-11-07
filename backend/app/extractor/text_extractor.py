from pathlib import Path
from app.extractor.base import BaseExtractor, ExtractionResult


class TextExtractor(BaseExtractor):
    """
    Extracts text from plaintext, Markdown, CSV, JSON, LOG, and source code files.
    Applies multi-encoding detection (utf-8, utf-8-sig, cp1252, latin-1, utf-16)
    and validates against binary files masquerading as plaintext.
    """

    SUPPORTED_EXTENSIONS = {
        ".txt", ".md", ".markdown", ".csv", ".json", ".log",
        ".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css",
        ".sql", ".sh", ".ps1", ".yaml", ".yml", ".xml", ".ini",
        ".toml", ".c", ".cpp", ".h", ".hpp", ".java", ".go",
        ".rs", ".rb", ".php", ".bat", ".cmd", ".env.example"
    }

    def extract(self, file_path: Path) -> ExtractionResult:
        # Step 1: Read initial chunk in binary mode to detect binary files
        try:
            with open(file_path, "rb") as f:
                raw_bytes = f.read(500000)  # Up to 500KB
        except Exception as e:
            return ExtractionResult(
                text="", preview="", error=f"Could not read file: {e}",
                extractor="text",
            )

        if not raw_bytes:
            return ExtractionResult(
                text="", preview="", is_skipped=True,
                skip_reason="Empty file (0 bytes)",
                extractor="text",
            )

        # Binary heuristic: if null bytes present without UTF-16 BOM or high printable ratio
        first_1k = raw_bytes[:1024]
        has_utf16_bom = raw_bytes.startswith((b"\xff\xfe", b"\xfe\xff"))

        if b"\x00" in first_1k:
            if not has_utf16_bom:
                # Check whether it might be UTF-16LE without BOM
                is_valid_utf16 = False
                try:
                    cand = first_1k.decode("utf-16le")
                    printable = sum(1 for c in cand if c.isprintable() or c in "\r\n\t ")
                    if len(cand) >= 4 and (printable / len(cand)) >= 0.8:
                        is_valid_utf16 = True
                except Exception:
                    is_valid_utf16 = False

                if not is_valid_utf16:
                    return ExtractionResult(
                        text="", preview="", is_skipped=True,
                        skip_reason="Binary content detected; skipped plaintext extraction",
                        extractor="text",
                    )

        # Step 2: Decode with candidate encodings (strict first, then fallback)
        encodings = ["utf-8", "utf-8-sig", "utf-16", "cp1252", "latin-1"]
        decoded_text = None
        used_encoding = None

        for enc in encodings:
            try:
                decoded_text = raw_bytes.decode(enc)
                used_encoding = enc
                break
            except (UnicodeDecodeError, LookupError):
                continue

        # Fallback with replacement if strict decoding failed
        if decoded_text is None:
            decoded_text = raw_bytes.decode("utf-8", errors="replace")
            used_encoding = "utf-8 (replace)"

        cleaned = self.clean_text(decoded_text)
        if not cleaned or len(cleaned.strip()) < 5:
            return ExtractionResult(
                text="", preview="", is_skipped=True,
                skip_reason="Content empty or below minimum readable threshold",
                extractor="text",
            )

        # Clean preview truncation on word boundary
        preview_len = min(500, len(cleaned))
        preview = cleaned[:preview_len]
        if preview_len == 500 and " " in preview:
            preview = preview.rsplit(" ", 1)[0] + "..."

        is_truncated = len(raw_bytes) >= 500000
        return ExtractionResult(
            text=cleaned,
            preview=preview,
            extractor="text",
            is_truncated=is_truncated,
        )
