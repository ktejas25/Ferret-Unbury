import enum
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, DateTime,
    ForeignKey, Enum, JSON, Boolean, Index, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class ScanStatus(str, enum.Enum):
    NEVER = "never"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class ExtractionStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"
    SKIPPED = "skipped"


class OperationStatus(str, enum.Enum):
    STARTED = "started"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class IndexedFolder(Base):
    __tablename__ = "indexed_folders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    path = Column(String(4096), nullable=False)
    path_hash = Column(String(64), nullable=False, unique=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    scan_status = Column(Enum(ScanStatus), nullable=False, default=ScanStatus.NEVER)
    file_count = Column(BigInteger, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_scanned_at = Column(DateTime, nullable=True)
    last_scan_error = Column(String(1024), nullable=True)

    files = relationship("FileRecord", back_populates="folder", cascade="all, delete-orphan")
    operations = relationship("OperationLog", back_populates="folder")


class FileRecord(Base):
    __tablename__ = "files"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    folder_id = Column(Integer, ForeignKey("indexed_folders.id", ondelete="CASCADE"), nullable=False)
    path_hash = Column(String(64), nullable=False, unique=True, index=True)
    full_path = Column(Text, nullable=False)
    filename = Column(String(512), nullable=False)
    extension = Column(String(20), nullable=False, default="", index=True)
    size_bytes = Column(BigInteger, nullable=False, default=0)
    modified_at = Column(DateTime, nullable=False, index=True)
    discovered_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    indexed_at = Column(DateTime, nullable=True)
    content_hash = Column(String(64), nullable=True)
    vector_id = Column(BigInteger, nullable=True, index=True)
    content_preview = Column(Text, nullable=True)
    extraction_status = Column(Enum(ExtractionStatus), nullable=False, default=ExtractionStatus.PENDING)
    retry_count = Column(Integer, nullable=False, default=0)
    is_deleted = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(DateTime, nullable=True)
    error_message = Column(String(1024), nullable=True)

    folder = relationship("IndexedFolder", back_populates="files")
    failures = relationship("FailedExtraction", back_populates="file", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_folder_status", "folder_id", "extraction_status", "is_deleted"),
        Index("idx_deleted", "is_deleted", "deleted_at"),
    )


class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    query_text = Column(String(1024), nullable=False)
    result_count = Column(Integer, nullable=False, default=0)
    searched_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)


class AppSetting(Base):
    __tablename__ = "app_settings"

    setting_key = Column(String(128), primary_key=True)
    setting_value = Column(Text, nullable=False)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class FailedExtraction(Base):
    __tablename__ = "failed_extractions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    file_id = Column(BigInteger, ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    error_type = Column(String(64), nullable=False)
    error_message = Column(String(1024), nullable=False)
    occurred_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    file = relationship("FileRecord", back_populates="failures")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    operation = Column(String(64), nullable=False)
    folder_id = Column(Integer, ForeignKey("indexed_folders.id", ondelete="SET NULL"), nullable=True)
    status = Column(Enum(OperationStatus), nullable=False)
    details_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    folder = relationship("IndexedFolder", back_populates="operations")

    __table_args__ = (
        Index("idx_operation_created", "operation", "created_at"),
        Index("idx_operation_status", "status", "created_at"),
    )
