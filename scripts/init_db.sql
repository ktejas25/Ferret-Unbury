-- =====================================================================
-- FILE ARCHAEOLOGIST - COMPLETE DATABASE INITIALIZATION
-- =====================================================================

CREATE DATABASE IF NOT EXISTS file_archaeologist
 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE file_archaeologist;

-- Tables
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

CREATE TABLE IF NOT EXISTS search_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    query_text VARCHAR(1024) NOT NULL,
    result_count INT UNSIGNED NOT NULL DEFAULT 0,
    searched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_searched_at (searched_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(128) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

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

-- Default Settings
INSERT INTO app_settings (setting_key, setting_value) VALUES
('schema_version', '1.0.0'),
('embedding_model', 'all-MiniLM-L6-v2'),
('ocr_enabled', 'false'),
('max_preview_length', '500'),
('history_retention_limit', '500')
ON DUPLICATE KEY UPDATE setting_value = setting_value;

-- Stored Procedures
DROP PROCEDURE IF EXISTS sp_upsert_file;
DELIMITER //
CREATE PROCEDURE sp_upsert_file(
    IN p_folder_id INT UNSIGNED,
    IN p_path_hash CHAR(64),
    IN p_full_path TEXT,
    IN p_filename VARCHAR(512),
    IN p_extension VARCHAR(20),
    IN p_size_bytes BIGINT UNSIGNED,
    IN p_modified_at DATETIME
)
BEGIN
    INSERT INTO files
    (folder_id, path_hash, full_path, filename, extension,
     size_bytes, modified_at, extraction_status, is_deleted)
    VALUES
    (p_folder_id, p_path_hash, p_full_path, p_filename, p_extension,
     p_size_bytes, p_modified_at, 'pending', 0)
    ON DUPLICATE KEY UPDATE
        extraction_status = IF(
            size_bytes <> p_size_bytes OR modified_at <> p_modified_at
            OR is_deleted = 1, 'pending', extraction_status
        ),
        folder_id = p_folder_id,
        full_path = p_full_path,
        filename = p_filename,
        extension = p_extension,
        size_bytes = p_size_bytes,
        modified_at = p_modified_at,
        is_deleted = 0,
        deleted_at = NULL;

    SELECT id, extraction_status, vector_id
    FROM files WHERE path_hash = p_path_hash;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_fetch_pending_files;
DELIMITER //
CREATE PROCEDURE sp_fetch_pending_files(IN p_limit INT UNSIGNED)
BEGIN
    DROP TEMPORARY TABLE IF EXISTS tmp_claimed_ids;
    CREATE TEMPORARY TABLE tmp_claimed_ids (id BIGINT UNSIGNED PRIMARY KEY);

    INSERT INTO tmp_claimed_ids (id)
    SELECT id FROM files
    WHERE extraction_status = 'pending' AND is_deleted = 0
    ORDER BY discovered_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED;

    UPDATE files f
    JOIN tmp_claimed_ids t ON f.id = t.id
    SET f.extraction_status = 'processing';

    SELECT f.id, f.folder_id, f.full_path, f.filename, f.extension,
           f.size_bytes, f.modified_at, f.retry_count, f.vector_id
    FROM files f
    JOIN tmp_claimed_ids t ON f.id = t.id;

    DROP TEMPORARY TABLE IF EXISTS tmp_claimed_ids;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_mark_file_done;
DELIMITER //
CREATE PROCEDURE sp_mark_file_done(
    IN p_file_id BIGINT UNSIGNED,
    IN p_vector_id BIGINT,
    IN p_preview TEXT
)
BEGIN
    UPDATE files
    SET vector_id = p_vector_id,
        content_preview = p_preview,
        extraction_status = 'done',
        indexed_at = CURRENT_TIMESTAMP,
        retry_count = 0,
        error_message = NULL
    WHERE id = p_file_id AND is_deleted = 0;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_mark_file_failed;
DELIMITER //
CREATE PROCEDURE sp_mark_file_failed(
    IN p_file_id BIGINT UNSIGNED,
    IN p_error_type VARCHAR(64),
    IN p_error_message VARCHAR(1024),
    IN p_max_retries TINYINT UNSIGNED
)
BEGIN
    DECLARE v_new_retry_count TINYINT UNSIGNED DEFAULT 1;
    DECLARE v_new_status VARCHAR(16);

    SELECT retry_count + 1 INTO v_new_retry_count
    FROM files WHERE id = p_file_id AND is_deleted = 0
    FOR UPDATE;

    IF v_new_retry_count < p_max_retries THEN
        SET v_new_status = 'pending';
    ELSE
        SET v_new_status = 'failed';
    END IF;

    UPDATE files
    SET retry_count = v_new_retry_count,
        error_message = LEFT(p_error_message, 1024),
        extraction_status = v_new_status
    WHERE id = p_file_id AND is_deleted = 0;

    IF v_new_status = 'failed' THEN
        INSERT INTO failed_extractions (file_id, error_type, error_message, occurred_at)
        VALUES (p_file_id, p_error_type, LEFT(p_error_message, 1024), CURRENT_TIMESTAMP);
    END IF;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_soft_delete_file;
DELIMITER //
CREATE PROCEDURE sp_soft_delete_file(IN p_path_hash CHAR(64))
BEGIN
    UPDATE files
    SET is_deleted = 1,
        deleted_at = CURRENT_TIMESTAMP
    WHERE path_hash = p_path_hash AND is_deleted = 0;

    SELECT id AS file_id, vector_id
    FROM files
    WHERE path_hash = p_path_hash;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_purge_deleted_file;
DELIMITER //
CREATE PROCEDURE sp_purge_deleted_file(IN p_file_id BIGINT UNSIGNED)
BEGIN
    DELETE FROM files
    WHERE id = p_file_id
      AND is_deleted = 1
      AND vector_id IS NULL;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_get_files_by_vector_ids;
DELIMITER //
CREATE PROCEDURE sp_get_files_by_vector_ids(IN p_vector_ids JSON)
BEGIN
    SELECT f.id, f.folder_id, f.full_path, f.filename, f.extension,
           f.size_bytes, f.modified_at, f.content_preview, f.vector_id
    FROM files AS f
    JOIN JSON_TABLE(
        p_vector_ids, '$[*]' COLUMNS (vector_id BIGINT PATH '$')
    ) AS ids ON ids.vector_id = f.vector_id
    WHERE f.extraction_status = 'done'
      AND f.is_deleted = 0;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_search_fallback_filename;
DELIMITER //
CREATE PROCEDURE sp_search_fallback_filename(
    IN p_query VARCHAR(1024),
    IN p_limit INT UNSIGNED
)
BEGIN
    SELECT id, full_path, filename, extension, size_bytes,
           modified_at, content_preview
    FROM files
    WHERE is_deleted = 0
      AND extraction_status <> 'failed'
      AND filename LIKE CONCAT('%', p_query, '%')
    ORDER BY modified_at DESC
    LIMIT p_limit;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_get_index_stats;
DELIMITER //
CREATE PROCEDURE sp_get_index_stats()
BEGIN
    SELECT
        COUNT(*) AS total_files,
        COALESCE(SUM(is_deleted = 0), 0) AS active_files,
        COALESCE(SUM(is_deleted = 0 AND extraction_status = 'done'), 0) AS indexed_files,
        COALESCE(SUM(is_deleted = 0 AND extraction_status = 'pending'), 0) AS pending_files,
        COALESCE(SUM(is_deleted = 0 AND extraction_status = 'processing'), 0) AS processing_files,
        COALESCE(SUM(is_deleted = 0 AND extraction_status = 'failed'), 0) AS failed_files,
        COALESCE(SUM(is_deleted = 0 AND extraction_status = 'skipped'), 0) AS skipped_files,
        COALESCE(SUM(is_deleted = 0 AND vector_id IS NOT NULL), 0) AS files_with_vectors,
        COALESCE(SUM(is_deleted = 1), 0) AS soft_deleted_files
    FROM files;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_refresh_folder_count;
DELIMITER //
CREATE PROCEDURE sp_refresh_folder_count(IN p_folder_id INT UNSIGNED)
BEGIN
    UPDATE indexed_folders
    SET file_count = (
        SELECT COUNT(*) FROM files
        WHERE folder_id = p_folder_id AND is_deleted = 0
    )
    WHERE id = p_folder_id;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_remove_folder_cascade;
DELIMITER //
CREATE PROCEDURE sp_remove_folder_cascade(IN p_folder_id INT UNSIGNED)
BEGIN
    SELECT id AS file_id, vector_id, path_hash
    FROM files
    WHERE folder_id = p_folder_id AND is_deleted = 0;

    UPDATE indexed_folders
    SET is_active = 0, scan_status = 'paused'
    WHERE id = p_folder_id;

    UPDATE files
    SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP
    WHERE folder_id = p_folder_id AND is_deleted = 0;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_log_operation;
DELIMITER //
CREATE PROCEDURE sp_log_operation(
    IN p_operation VARCHAR(64),
    IN p_folder_id INT UNSIGNED,
    IN p_status VARCHAR(16),
    IN p_details_json JSON
)
BEGIN
    INSERT INTO operation_logs (operation, folder_id, status, details_json, created_at)
    VALUES (p_operation, p_folder_id, p_status, p_details_json, CURRENT_TIMESTAMP);

    SELECT LAST_INSERT_ID() AS operation_id;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_purge_old_history;
DELIMITER //
CREATE PROCEDURE sp_purge_old_history(IN p_keep INT UNSIGNED)
BEGIN
    DELETE FROM search_history
    WHERE id NOT IN (
        SELECT id FROM (
            SELECT id FROM search_history
            ORDER BY searched_at DESC, id DESC
            LIMIT p_keep
        ) AS retained
    );
    SELECT ROW_COUNT() AS deleted_rows;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_reset_all_for_rebuild;
DELIMITER //
CREATE PROCEDURE sp_reset_all_for_rebuild()
BEGIN
    START TRANSACTION;
    UPDATE files
    SET extraction_status = 'pending',
        vector_id = NULL,
        retry_count = 0,
        error_message = NULL,
        indexed_at = NULL
    WHERE is_deleted = 0;

    DELETE FROM failed_extractions;

    UPDATE indexed_folders
    SET scan_status = 'never',
        last_scan_error = NULL;
    COMMIT;
END//
DELIMITER ;
