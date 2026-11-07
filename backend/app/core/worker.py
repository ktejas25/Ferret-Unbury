import time
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from pathlib import Path
from typing import Optional, Dict, Any, List

from app.core.metadata_store import metadata_store
from app.core.embedder import embedder
from app.core.vector_index import vector_index_manager
from app.extractor.registry import extractor_registry
from app.config import settings

logger = logging.getLogger("file_archaeologist.worker")

# Per-file processing timeout in seconds
FILE_PROCESSING_TIMEOUT_SECONDS = 30.0


class IndexingWorker:
    """
    Background worker claiming batches of pending files, extracting searchable text,
    generating 384-dimensional semantic embeddings, adding to the vector index,
    and committing status to MySQL.
    
    Robustness features:
    - Independent operational state (paused vs idle vs indexing)
    - Atomic batch claiming with MySQL SKIP LOCKED
    - Bounded per-file processing timeouts (prevents hanging on corrupt files)
    - Exponential backoff retry delays
    - Automatic periodic recovery of stale processing jobs
    - Graceful shutdown and cancellation
    """

    def __init__(self, concurrency: int = 2):
        self.concurrency = concurrency
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._is_paused = False
        self._current_task: Optional[str] = None
        self._is_indexing = False
        self._lock = threading.Lock()
        self._backoff_schedule: Dict[int, float] = {}  # file_id -> resume_timestamp
        self._last_stale_recovery = 0.0

    def start(self) -> None:
        """Starts the background indexing loop."""
        with self._lock:
            if self._thread is None or not self._thread.is_alive():
                # Startup recovery: reset any leftover 'processing' files from previous crash
                recovered = metadata_store.recover_orphaned_processing_jobs()
                if recovered > 0:
                    logger.info(f"Startup recovery: reset {recovered} orphaned processing files to pending.")

                self._stop_event.clear()
                self._pause_event.set()
                self._is_paused = False
                self._thread = threading.Thread(
                    target=self._run_loop,
                    name="IndexingWorkerSupervisor",
                    daemon=True
                )
                self._thread.start()
                logger.info(f"Indexing worker supervisor started (concurrency={self.concurrency}).")

    def stop(self, timeout: float = 5.0) -> None:
        """Gracefully halts background processing and saves vector state."""
        with self._lock:
            self._stop_event.set()
            self._pause_event.set()  # Unpause to let thread exit
            if self._thread and self._thread.is_alive():
                self._thread.join(timeout=timeout)
                self._thread = None
            self._is_indexing = False
            self._current_task = None
            # Ensure vector index is saved on shutdown
            vector_index_manager.save_index()
            logger.info("Indexing worker stopped cleanly.")

    def pause(self) -> None:
        """Pauses worker from claiming new batches."""
        with self._lock:
            self._is_paused = True
            self._pause_event.clear()
            logger.info("Indexing worker paused.")

    def resume(self) -> None:
        """Resumes worker claiming and processing."""
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

    def get_status_label(self) -> str:
        """Returns accurate operational status: 'paused', 'indexing', or 'idle'."""
        if self._is_paused:
            return "paused"
        if self._is_indexing:
            return "indexing"
        return "idle"

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            # Wait if paused
            self._pause_event.wait()
            if self._stop_event.is_set():
                break

            now = time.time()
            # Stale job recovery: check every 60s
            if now - self._last_stale_recovery > 60.0:
                self._last_stale_recovery = now
                stale_count = metadata_store.recover_orphaned_processing_jobs()
                if stale_count > 0:
                    logger.warning(f"Periodic recovery: reset {stale_count} stale processing jobs to pending.")

            try:
                # Atomically claim pending files using sp_fetch_pending_files
                batch = metadata_store.fetch_pending_files(limit=settings.BATCH_CLAIM_SIZE)
                if not batch:
                    self._is_indexing = False
                    self._current_task = None
                    time.sleep(1.0)
                    continue

                self._is_indexing = True
                self._process_batch(batch)

            except Exception as e:
                logger.error(f"Error in indexing worker loop: {e}")
                self._is_indexing = False
                time.sleep(2.0)

    def _process_batch(self, batch: List[Dict[str, Any]]) -> None:
        """Processes claimed files using bounded concurrency and timeouts."""
        with ThreadPoolExecutor(max_workers=self.concurrency, thread_name_prefix="IndexerWorker") as executor:
            futures = []
            for item in batch:
                if self._stop_event.is_set():
                    break
                self._pause_event.wait()

                # Check exponential backoff schedule
                file_id = item["id"]
                retry_count = item.get("retry_count", 0)
                now = time.time()

                if file_id in self._backoff_schedule and now < self._backoff_schedule[file_id]:
                    # Still in backoff window, reset to pending without penalty
                    metadata_store.mark_file_failed(
                        file_id=file_id,
                        error_type="BACKOFF_WAIT",
                        error_message=f"Waiting for exponential backoff window ({round(self._backoff_schedule[file_id] - now, 1)}s remaining)",
                        max_retries=settings.MAX_RETRIES + 5
                    )
                    continue

                fut = executor.submit(self._process_single_file_with_timeout, item)
                futures.append((fut, item))

            for fut, item in futures:
                try:
                    fut.result(timeout=FILE_PROCESSING_TIMEOUT_SECONDS + 5.0)
                except FutureTimeoutError:
                    file_id = item["id"]
                    logger.error(f"File {file_id} ({item.get('filename')}) exceeded timeout of {FILE_PROCESSING_TIMEOUT_SECONDS}s!")
                    self._handle_failure(
                        item=item,
                        error_type="PROCESSING_TIMEOUT",
                        error_msg=f"File extraction exceeded {FILE_PROCESSING_TIMEOUT_SECONDS}s processing timeout"
                    )
                except Exception as e:
                    logger.error(f"Unhandled error processing future for file {item.get('id')}: {e}")

        self._is_indexing = False
        self._current_task = None

    def _process_single_file(self, item: Dict[str, Any]) -> None:
        """Alias for single file processing to maintain backwards compatibility with existing integration tests."""
        self._process_single_file_with_timeout(item)

    def _process_single_file_with_timeout(self, item: Dict[str, Any]) -> None:
        """Executes the extraction and vector indexing of a single file."""
        file_id = item["id"]
        full_path_str = item["full_path"]
        fname = item.get("filename", full_path_str)
        self._current_task = f"Processing {fname}"
        file_path = Path(full_path_str)

        # 1. Existence check
        if not file_path.exists():
            logger.info(f"File vanished during indexing: {full_path_str}")
            p_hash = item.get("path_hash")
            if p_hash:
                metadata_store.soft_delete_file(p_hash)
            return

        # 2. File stability check (skip if actively being written)
        try:
            stat1 = file_path.stat()
            time.sleep(0.05)
            stat2 = file_path.stat()
            if stat1.st_mtime != stat2.st_mtime or stat1.st_size != stat2.st_size:
                logger.info(f"File actively changing, requeuing: {fname}")
                self._handle_failure(
                    item=item,
                    error_type="FILE_LOCKED",
                    error_msg="File modified during indexing"
                )
                return
        except Exception as e:
            logger.warning(f"Failed stability check for {full_path_str}: {e}")

        # 3. Text Extraction
        try:
            res = extractor_registry.extract_file(file_path)

            if res.error:
                self._handle_failure(
                    item=item,
                    error_type="EXTRACTION_ERROR",
                    error_msg=res.error
                )
                return

            if res.is_skipped:
                metadata_store.mark_file_skipped(file_id=file_id, reason=res.skip_reason or "Skipped")
                # Clear from backoff schedule if present
                self._backoff_schedule.pop(file_id, None)
                return

            # 4. Generate Semantic Embeddings
            embedding = embedder.embed_document(res.text)

            # 5. Add to vector index (file_id is stable vector identifier)
            vector_id = file_id
            vector_index_manager.add_item(vector_id=vector_id, vector=embedding)

            # 6. Commit success to database
            metadata_store.mark_file_done(
                file_id=file_id,
                vector_id=vector_id,
                preview=res.preview
            )
            # Clear backoff upon success
            self._backoff_schedule.pop(file_id, None)
            logger.info(f"Indexed file {file_id}: {fname} ({len(res.text)} chars)")

            # 7. Asynchronous Document Classification & Structured Extraction
            try:
                from app.services.classifier_service import classifier_service
                from app.services.extraction_service import extraction_service
                cat, conf = classifier_service.classify_and_save(
                    file_id=file_id,
                    filename=fname,
                    extension=item.get("extension", ""),
                    text_content=res.text
                )
                extraction_service.extract_and_save(
                    file_id=file_id,
                    category=cat,
                    text=res.text
                )
            except Exception as e:
                logger.warning(f"Non-blocking classification/extraction skipped for file {file_id}: {e}")

        except Exception as e:
            logger.error(f"Failed processing file {file_id} ({full_path_str}): {e}")
            self._handle_failure(
                item=item,
                error_type="UNHANDLED_EXCEPTION",
                error_msg=str(e)
            )

    def _handle_failure(self, item: Dict[str, Any], error_type: str, error_msg: str) -> None:
        """Handles failure recording with exponential backoff delay."""
        file_id = item["id"]
        current_retries = item.get("retry_count", 0) + 1
        max_retries = settings.MAX_RETRIES

        # Exponential backoff delay: 2, 4, 8, 16... capped at 60s
        delay = min(60.0, 2.0 ** current_retries)
        self._backoff_schedule[file_id] = time.time() + delay

        metadata_store.mark_file_failed(
            file_id=file_id,
            error_type=error_type,
            error_message=f"{error_msg} (backoff {int(delay)}s)",
            max_retries=max_retries
        )
        logger.warning(
            f"File {file_id} failed ({error_type}, attempt {current_retries}/{max_retries}): {error_msg}"
        )


indexing_worker = IndexingWorker()
