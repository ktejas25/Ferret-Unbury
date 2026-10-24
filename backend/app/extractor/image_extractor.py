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
                skip_reason="OCR is disabled in application settings"
            )

        try:
            import pytesseract
            if settings.TESSERACT_CMD:
                pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

            image = Image.open(str(file_path))

            # Basic preprocessing: convert palette/RGBA to RGB/Grayscale
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")

            text = pytesseract.image_to_string(image)
            cleaned = self.clean_text(text)

            if not cleaned or len(cleaned.strip()) < 5:
                return ExtractionResult(
                    text="", preview="", is_skipped=True,
                    skip_reason="Image processed but no readable text discovered via OCR"
                )

            preview = cleaned[:500]
            return ExtractionResult(text=cleaned, preview=preview)

        except pytesseract.TesseractNotFoundError:
            return ExtractionResult(
                text="", preview="", is_skipped=True,
                skip_reason="Tesseract OCR binary is not installed on system PATH"
            )
        except Exception as e:
            return ExtractionResult(
                text="", preview="", error=f"Image OCR failure: {str(e)[:200]}"
            )
