import os
from pathlib import Path
from typing import Set
from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Load .env files from backend or root if present
env_paths = [
    Path(__file__).resolve().parent.parent / ".env",
    Path(__file__).resolve().parent.parent.parent / ".env",
    Path(".env")
]
for p in env_paths:
    if p.exists():
        load_dotenv(dotenv_path=str(p))


class Settings(BaseModel):
    # Database Configuration
    MYSQL_HOST: str = Field(default_factory=lambda: os.getenv("MYSQL_HOST", "127.0.0.1"))
    MYSQL_PORT: int = Field(default_factory=lambda: int(os.getenv("MYSQL_PORT", "3306")))
    MYSQL_USER: str = Field(default_factory=lambda: os.getenv("MYSQL_USER", "root"))
    MYSQL_PASSWORD: str = Field(default_factory=lambda: os.getenv("MYSQL_PASSWORD", ""))
    MYSQL_DATABASE: str = Field(default_factory=lambda: os.getenv("MYSQL_DATABASE", "file_archaeologist"))

    # API Configuration
    API_HOST: str = Field(default_factory=lambda: os.getenv("API_HOST", "127.0.0.1"))
    API_PORT: int = Field(default_factory=lambda: int(os.getenv("API_PORT", "8420")))

    # Vector Index & Model Configuration
    EMBEDDING_MODEL: str = Field(default_factory=lambda: os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2"))
    INDEX_PATH: str = Field(default_factory=lambda: os.getenv("INDEX_PATH", "data/vector_index.bin"))
    DATA_DIR: str = Field(default_factory=lambda: os.getenv("DATA_DIR", "data"))
    VECTOR_DIM: int = Field(default=384)

    # Extraction & Indexing Options
    OCR_ENABLED: bool = Field(default_factory=lambda: os.getenv("OCR_ENABLED", "false").lower() in ("true", "1", "yes"))
    TESSERACT_CMD: str = Field(default_factory=lambda: os.getenv("TESSERACT_CMD", ""))
    IGNORED_EXTENSIONS: str = Field(
        default_factory=lambda: os.getenv(
            "IGNORED_EXTENSIONS",
            ".tmp,.log,.bak,.git,.pyc,.bin,.exe,.dll,.sys,.iso,.dmg,.zip,.tar,.gz,.rar,.7z"
        )
    )
    MAX_FILE_SIZE_BYTES: int = Field(default_factory=lambda: int(os.getenv("MAX_FILE_SIZE_BYTES", "52428800")))
    MAX_PREVIEW_LENGTH: int = Field(default_factory=lambda: int(os.getenv("MAX_PREVIEW_LENGTH", "1000")))
    INDEX_SAVE_INTERVAL: int = Field(default_factory=lambda: int(os.getenv("INDEX_SAVE_INTERVAL", "100")))
    HISTORY_RETENTION_LIMIT: int = Field(default_factory=lambda: int(os.getenv("HISTORY_RETENTION_LIMIT", "500")))
    BATCH_CLAIM_SIZE: int = Field(default_factory=lambda: int(os.getenv("BATCH_CLAIM_SIZE", "10")))
    MAX_RETRIES: int = Field(default_factory=lambda: int(os.getenv("MAX_RETRIES", "3")))

    @property
    def database_url(self) -> str:
        pwd = f":{self.MYSQL_PASSWORD}" if self.MYSQL_PASSWORD else ""
        return f"mysql+pymysql://{self.MYSQL_USER}{pwd}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}?charset=utf8mb4"

    @property
    def ignored_extension_set(self) -> Set[str]:
        return {ext.strip().lower() for ext in self.IGNORED_EXTENSIONS.split(",") if ext.strip()}

    def get_resolved_data_dir(self) -> Path:
        p = Path(self.DATA_DIR)
        if not p.is_absolute():
            root = Path(__file__).resolve().parent.parent.parent
            p = root / p
        p.mkdir(parents=True, exist_ok=True)
        return p

    def get_resolved_index_path(self) -> Path:
        p = Path(self.INDEX_PATH)
        if not p.is_absolute():
            root = Path(__file__).resolve().parent.parent.parent
            p = root / p
        p.parent.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
