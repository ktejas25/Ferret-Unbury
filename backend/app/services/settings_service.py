import logging
from typing import Dict, Any
from app.core.metadata_store import metadata_store
from app.config import settings

logger = logging.getLogger("file_archaeologist.settings_service")


class SettingsService:
    """Manages application-wide settings stored in app_settings table."""

    def get_settings(self) -> Dict[str, str]:
        db_settings = metadata_store.get_app_settings()
        # Merge with in-memory defaults
        combined = {
            "embedding_model": settings.EMBEDDING_MODEL,
            "ocr_enabled": str(settings.OCR_ENABLED).lower(),
            "ignored_extensions": settings.IGNORED_EXTENSIONS,
            "max_preview_length": str(settings.MAX_PREVIEW_LENGTH),
            "history_retention_limit": str(settings.HISTORY_RETENTION_LIMIT),
            "api_port": str(settings.API_PORT),
        }
        combined.update(db_settings)
        return combined

    def update_settings(self, new_settings: Dict[str, str]) -> Dict[str, str]:
        for k, v in new_settings.items():
            metadata_store.set_app_setting(k, str(v))
            if k == "ocr_enabled":
                settings.OCR_ENABLED = v.lower() in ("true", "1", "yes")
            elif k == "ignored_extensions":
                settings.IGNORED_EXTENSIONS = v
        return self.get_settings()


settings_service = SettingsService()
