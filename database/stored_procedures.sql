-- =====================================================================
-- FILE ARCHAEOLOGIST - STORED PROCEDURES (MySQL 8.0+)
-- =====================================================================

USE file_archaeologist;

-- 1. sp_upsert_file
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

-- 2. sp_fetch_pending_files
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

-- 3. sp_mark_file_done
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

-- 4. sp_mark_file_failed
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

-- 5. sp_soft_delete_file
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

-- 6. sp_purge_deleted_file
DROP PROCEDURE IF EXISTS sp_purge_deleted_file;
DELIMITER //
CREATE PROCEDURE sp_purge_deleted_file(IN p_file_id BIGINT UNSIGNED)
BEGIN
    -- Caller must only invoke after vector cleanup is confirmed.
    DELETE FROM files
    WHERE id = p_file_id
      AND is_deleted = 1
      AND vector_id IS NULL;
END//
DELIMITER ;

-- 7. sp_get_files_by_vector_ids
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

-- 8. sp_search_fallback_filename
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

-- 9. sp_get_index_stats
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

-- 10. sp_refresh_folder_count
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

-- 11. sp_remove_folder_cascade
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

-- 12. sp_log_operation
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

-- 13. sp_purge_old_history
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

-- 14. sp_reset_all_for_rebuild
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
