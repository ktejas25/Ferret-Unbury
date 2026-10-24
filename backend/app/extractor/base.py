from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class ExtractionResult:
    text: str
    preview: str
    is_skipped: bool = False
    skip_reason: Optional[str] = None
    error: Optional[str] = None


class BaseExtractor(ABC):
    """Abstract base class for all file text extractors."""

    @abstractmethod
    def extract(self, file_path: Path) -> ExtractionResult:
        """Extracts text content and preview from the given file."""
        pass

    def clean_text(self, text: str) -> str:
        """Normalizes excessive whitespace while preserving readable words."""
        lines = [line.strip() for line in text.splitlines()]
        cleaned = " ".join([l for l in lines if l])
        return " ".join(cleaned.split())
