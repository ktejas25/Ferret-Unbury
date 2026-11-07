import logging
from pathlib import Path
from PIL import Image
from app.extractor.base import BaseExtractor, ExtractionResult
from app.config import settings

logger = logging.getLogger("file_archaeologist.image_extractor")


class ImageExtractor(BaseExtractor):
    """
    Extracts text from PNG, JPG, JPEG, WEBP images using OCR (Pillow + Tesseract).
    Gracefully skips if OCR is disabled or if Tesseract is not installed on system.
    """

    SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}

    def extract(self, file_path: Path) -> ExtractionResult:
        if not settings.OCR_ENABLED:
            return ExtractionResult(
                text="", preview="", is_skipped=True,
                skip_reason="OCR is disabled in application settings",
                extractor="image_ocr",
            )

        try:
            import pytesseract
        except ImportError:
            return ExtractionResult(
                text="", preview="", is_skipped=True,
                skip_reason="pytesseract Python package is not installed",
                extractor="image_ocr",
            )

        try:
            if settings.TESSERACT_CMD:
                pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

            image = Image.open(str(file_path))

            # Basic preprocessing: convert palette/RGBA to RGB
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")

            text = pytesseract.image_to_string(image)
            cleaned = self.clean_text(text)

            if not cleaned or len(cleaned.strip()) < 5:
                return ExtractionResult(
                    text="", preview="", is_skipped=True,
                    skip_reason="Image processed but no readable text discovered via OCR",
                    extractor="image_ocr",
                )

            preview = cleaned[:500]
            return ExtractionResult(text=cleaned, preview=preview, extractor="image_ocr")

        except getattr(pytesseract, "TesseractNotFoundError", Exception):
            return ExtractionResult(
                text="", preview="", is_skipped=True,
                skip_reason="Tesseract OCR binary is not installed on system PATH",
                extractor="image_ocr",
            )
        except Exception as e:
            return ExtractionResult(
                text="", preview="", error=f"Image OCR failure: {str(e)[:200]}",
                extractor="image_ocr",
            )
