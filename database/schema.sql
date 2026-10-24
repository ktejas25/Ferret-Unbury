-- =====================================================================
-- FILE ARCHAEOLOGIST - CANONICAL DATABASE SCHEMA (MySQL 8.0+)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS file_archaeologist
 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE file_archaeologist;

-- 1. Monitored folders table
CREATE TABLE IF NOT EXISTS indexed_folders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    path VARCHAR(4096) NOT NULL,
    path_hash CHAR(64) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    scan_status ENUM('never','running','completed','failed','paused') NOT NULL DEFAULT 'never',
    file_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_scanned_at DATETIME NULL,
    last_scan_error VARCHAR(1024) NULL,
    UNIQUE KEY uq_folder_path_hash (path_hash),
    KEY idx_folder_active (is_active)
) ENGINE=InnoDB;

-- 2. Files metadata table
CREATE TABLE IF NOT EXISTS files (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    folder_id INT UNSIGNED NOT NULL,
    path_hash CHAR(64) NOT NULL,
    full_path TEXT NOT NULL,
    filename VARCHAR(512) NOT NULL,
    extension VARCHAR(20) NOT NULL DEFAULT '',
    size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
    modified_at DATETIME NOT NULL,
    discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    indexed_at DATETIME NULL,
    content_hash CHAR(64) NULL,
    vector_id BIGINT NULL,
    content_preview TEXT NULL,
    extraction_status ENUM('pending','processing','done','failed','skipped') NOT NULL DEFAULT 'pending',
    retry_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    is_deleted TINYINT(1) NOT NULL DEFAULT 0,
    deleted_at DATETIME NULL,
    error_message VARCHAR(1024) NULL,
    UNIQUE KEY uq_file_path_hash (path_hash),
    KEY idx_folder_status (folder_id, extraction_status, is_deleted),
    KEY idx_extension (extension),
    KEY idx_modified (modified_at),
    KEY idx_vector_id (vector_id),
    KEY idx_deleted (is_deleted, deleted_at),
    CONSTRAINT fk_files_folder FOREIGN KEY (folder_id)
        REFERENCES indexed_folders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Search history table
CREATE TABLE IF NOT EXISTS search_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    query_text VARCHAR(1024) NOT NULL,
    result_count INT UNSIGNED NOT NULL DEFAULT 0,
    searched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_searched_at (searched_at)
) ENGINE=InnoDB;

-- 4. Application settings table
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(128) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 5. Failed extractions table
CREATE TABLE IF NOT EXISTS failed_extractions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id BIGINT UNSIGNED NOT NULL,
    error_type VARCHAR(64) NOT NULL,
    error_message VARCHAR(1024) NOT NULL,
    occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_failure_file (file_id),
    KEY idx_failure_time (occurred_at),
    CONSTRAINT fk_failure_file FOREIGN KEY (file_id)
        REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Operation audit logs table
CREATE TABLE IF NOT EXISTS operation_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    operation VARCHAR(64) NOT NULL,
    folder_id INT UNSIGNED NULL,
    status ENUM('started','completed','failed','cancelled') NOT NULL,
    details_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    KEY idx_operation_created (operation, created_at),
    KEY idx_operation_status (status, created_at),
    CONSTRAINT fk_operation_folder FOREIGN KEY (folder_id)
        REFERENCES indexed_folders(id) ON DELETE SET NULL
) ENGINE=InnoDB;
