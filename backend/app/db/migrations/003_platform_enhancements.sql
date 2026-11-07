-- Migration 003: Platform Enhancements (Library, Classification, Collections, AI, Relationships, Timeline)
USE file_archaeologist;

-- 2. Tags Table
CREATE TABLE IF NOT EXISTS tags (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    color VARCHAR(32) NOT NULL DEFAULT '#8b5cf6',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. File Tags Mapping
CREATE TABLE IF NOT EXISTS file_tags (
    file_id BIGINT UNSIGNED NOT NULL,
    tag_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (file_id, tag_id),
    CONSTRAINT fk_file_tags_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    CONSTRAINT fk_file_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Collections Table (Manual & Smart collections)
CREATE TABLE IF NOT EXISTS collections (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description TEXT NULL,
    is_smart TINYINT(1) NOT NULL DEFAULT 0,
    rules_json JSON NULL,
    color VARCHAR(32) NOT NULL DEFAULT '#6366f1',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 5. Collection Items Mapping
CREATE TABLE IF NOT EXISTS collection_items (
    collection_id INT UNSIGNED NOT NULL,
    file_id BIGINT UNSIGNED NOT NULL,
    added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, file_id),
    CONSTRAINT fk_ci_collection FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    CONSTRAINT fk_ci_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Structured Document Extractions Table
CREATE TABLE IF NOT EXISTS document_extractions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id BIGINT UNSIGNED NOT NULL,
    extraction_type VARCHAR(64) NOT NULL,
    data_json JSON NOT NULL,
    confidence FLOAT NOT NULL DEFAULT 1.0,
    extracted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_extraction_file (file_id),
    CONSTRAINT fk_doc_ext_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Document Entities Table
CREATE TABLE IF NOT EXISTS document_entities (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id BIGINT UNSIGNED NOT NULL,
    entity_name VARCHAR(256) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    occurrences INT UNSIGNED NOT NULL DEFAULT 1,
    KEY idx_entity_file (file_id),
    KEY idx_entity_lookup (entity_name(128), entity_type),
    CONSTRAINT fk_doc_entity_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 8. Document Relationships Table (Knowledge Graph)
CREATE TABLE IF NOT EXISTS document_relationships (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    source_file_id BIGINT UNSIGNED NOT NULL,
    target_file_id BIGINT UNSIGNED NULL,
    target_entity_name VARCHAR(256) NOT NULL,
    relationship_type VARCHAR(64) NOT NULL,
    confidence FLOAT NOT NULL DEFAULT 0.8,
    evidence_text TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_rel_source (source_file_id),
    KEY idx_rel_target (target_file_id),
    CONSTRAINT fk_rel_source FOREIGN KEY (source_file_id) REFERENCES files(id) ON DELETE CASCADE,
    CONSTRAINT fk_rel_target FOREIGN KEY (target_file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. Document Timeline Events Table
CREATE TABLE IF NOT EXISTS document_timeline_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id BIGINT UNSIGNED NOT NULL,
    event_date DATE NOT NULL,
    event_title VARCHAR(256) NOT NULL,
    event_description TEXT NULL,
    confidence FLOAT NOT NULL DEFAULT 0.8,
    source_page INT UNSIGNED NULL,
    source_excerpt TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_timeline_date (event_date),
    KEY idx_timeline_file (file_id),
    CONSTRAINT fk_timeline_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 10. AI Assistant Conversations Table
CREATE TABLE IF NOT EXISTS ai_conversations (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(256) NOT NULL,
    scope_type VARCHAR(32) NOT NULL DEFAULT 'all',
    scope_id VARCHAR(128) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 11. AI Assistant Messages Table
CREATE TABLE IF NOT EXISTS ai_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL,
    role ENUM('user', 'assistant', 'system') NOT NULL,
    content MEDIUMTEXT NOT NULL,
    sources_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_msg_conv (conversation_id, created_at),
    CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 12. Saved Searches Table
CREATE TABLE IF NOT EXISTS saved_searches (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    query_text VARCHAR(1024) NOT NULL,
    filters_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
