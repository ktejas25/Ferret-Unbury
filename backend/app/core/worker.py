import time
import logging
import threading
from pathlib import Path
from typing import Optional, Dict, Any

from app.core.metadata_store import metadata_store
from app.core.embedder import embedder
from app.core.vector_index import vector_index_manager
from app.extractor.registry import extractor_registry
from app.config import settings

logger = logging.getLogger("file_archaeologist.worker")


class IndexingWorker:
    """
    Background worker claiming batches of pending files, extracting searchable text,
    generating 384-dimensional semantic embeddings, adding to the vector index,
    and committing status to MySQL.
    Supports pause/resume, bounded retries, and startup recovery.
    """

    def __init__(self):
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._is_paused = False
        self._current_task: Optional[str] = None
        self._is_indexing = False
        self._lock = threading.Lock()

    def start(self) -> None:
        with self._lock:
            if self._thread is None or not self._thread.is_alive():
                # Startup recovery: reset any leftover 'processing' files from previous crash
                recovered = metadata_store.recover_orphaned_processing_jobs()
                if recovered > 0:
                    logger.info(f"Startup recovery: reset {recovered} orphaned processing files to pending.")

                self._stop_event.clear()
                self._pause_event.set()  # Not paused
                self._is_paused = False
                self._thread = threading.Thread(target=self._run_loop, name="IndexingWorkerThread", daemon=True)
                self._thread.start()
                logger.info("Indexing worker service started.")

    def stop(self) -> None:
        with self._lock:
            self._stop_event.set()
            self._pause_event.set()  # Unpause so it can exit
            if self._thread and self._thread.is_alive():
                self._thread.join(timeout=3)
                self._thread = None
            # Ensure vector index is saved on shutdown
            vector_index_manager.save_index()
            logger.info("Indexing worker service stopped cleanly.")

    def pause(self) -> None:
        with self._lock:
            self._is_paused = True
            self._pause_event.clear()
            logger.info("Indexing worker paused.")

    def resume(self) -> None:
        with self._lock:
            self._is_paused = False
            self._pause_event.set()
            logger.info("Indexing worker resumed.")

    def is_paused(self) -> bool:
        return self._is_paused

    def is_indexing(self) -> bool:
        return self._is_indexing

    def get_current_task(self) -> Optional[str]:
        return self._current_task

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            # Wait if paused
            self._pause_event.wait()
            if self._stop_event.is_set():
                break

            try:
                # Atomically claim pending files using sp_fetch_pending_files
                batch = metadata_store.fetch_pending_files(limit=settings.BATCH_CLAIM_SIZE)
                if not batch:
                    self._is_indexing = False
                    self._current_task = None
                    # Sleep when no work
                    time.sleep(1.0)
                    continue

                self._is_indexing = True
                for item in batch:
                    if self._stop_event.is_set():
                        break
                    self._pause_event.wait()
                    self._process_single_file(item)

            except Exception as e:
                logger.error(f"Error in indexing worker loop: {e}")
                time.sleep(2.0)

    def _process_single_file(self, item: Dict[str, Any]) -> None:
        file_id = item["id"]
        full_path_str = item["full_path"]
        self._current_task = f"Processing {item.get('filename', full_path_str)}"
        file_path = Path(full_path_str)

        # Check if file still exists on disk
        if not file_path.exists():
            logger.info(f"File vanished during indexing: {full_path_str}")
            metadata_store.soft_delete_file(item["path_hash"])
            return

        # Check file stability (mtime/size not changing actively)
        try:
            stat1 = file_path.stat()
            time.sleep(0.05)  # brief check
            stat2 = file_path.stat()
            if stat1.st_mtime != stat2.st_mtime or stat1.st_size != stat2.st_size:
                logger.info(f"File actively changing, re-queueing: {file_path.name}")
                metadata_store.mark_file_failed(
                    file_id=file_id,
                    error_type="FILE_LOCKED",
                    error_message="File modified during indexing",
                    max_retries=settings.MAX_RETRIES
                )
                return
        except Exception as e:
            logger.warning(f"Failed file stability check for {full_path_str}: {e}")

        # Extract text
        try:
            res = extractor_registry.extract_file(file_path)

            if res.error:
                metadata_store.mark_file_failed(
                    file_id=file_id,
                    error_type="EXTRACTION_ERROR",
                    error_message=res.error,
                    max_retries=settings.MAX_RETRIES
                )
                return

            if res.is_skipped:
                metadata_store.mark_file_skipped(file_id=file_id, reason=res.skip_reason or "Skipped")
                return

            # Extractable text available -> generate embedding
            embedding = embedder.embed_document(res.text)

            # Assign vector_id: use file_id as the stable vector identifier
            vector_id = file_id
            vector_index_manager.add_item(vector_id=vector_id, vector=embedding)

            # Commit success to MySQL
            metadata_store.mark_file_done(
                file_id=file_id,
                vector_id=vector_id,
                preview=res.preview
            )
            logger.info(f"Indexed file {file_id}: {file_path.name}")

        except Exception as e:
            logger.error(f"Failed processing file {file_id} ({full_path_str}): {e}")
            metadata_store.mark_file_failed(
                file_id=file_id,
                error_type="UNHANDLED_EXCEPTION",
                error_message=str(e),
                max_retries=settings.MAX_RETRIES
            )


indexing_worker = IndexingWorker()
