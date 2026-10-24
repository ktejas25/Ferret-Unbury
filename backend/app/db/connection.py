import logging
import os
from contextlib import contextmanager
from typing import Generator
import pymysql
import pymysql.constants.CLIENT
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings

logger = logging.getLogger("file_archaeologist.db")

engine = create_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
    pool_pre_ping=True,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


import queue
import re
import threading

class PooledConnectionWrapper:
    """Wraps a PyMySQL connection so .close() returns it to the pool instead of closing the TCP socket."""
    def __init__(self, raw_conn, pool):
        self._raw_conn = raw_conn
        self._pool = pool
        self._closed = False

    def close(self):
        if not self._closed:
            self._closed = True
            self._pool.return_connection(self._raw_conn)

    def __getattr__(self, item):
        return getattr(self._raw_conn, item)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


class PyMySQLConnectionPool:
    """Thread-safe connection pool for raw PyMySQL operations preventing WinError 10048."""
    def __init__(self, max_connections: int = 25):
        self._pool = queue.Queue(maxsize=max_connections)
        self._max = max_connections

    def _create(self) -> pymysql.Connection:
        return pymysql.connect(
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE,
            charset="utf8mb4",
            autocommit=True,
            client_flag=pymysql.constants.CLIENT.MULTI_STATEMENTS,
            cursorclass=pymysql.cursors.DictCursor
        )

    def get_connection(self) -> PooledConnectionWrapper:
        conn = None
        while not conn:
            try:
                conn = self._pool.get_nowait()
                try:
                    conn.ping(reconnect=True)
                except Exception:
                    try:
                        conn.close()
                    except Exception:
                        pass
                    conn = None
            except queue.Empty:
                conn = self._create()
        return PooledConnectionWrapper(conn, self)

    def return_connection(self, raw_conn: pymysql.Connection):
        try:
            self._pool.put_nowait(raw_conn)
        except queue.Full:
            try:
                raw_conn.close()
            except Exception:
                pass


_mysql_pool = PyMySQLConnectionPool(max_connections=25)


def get_raw_connection() -> PooledConnectionWrapper:
    """Provides a pooled raw PyMySQL connection with multi-statement support."""
    return _mysql_pool.get_connection()


def get_db() -> Generator[Session, None, None]:
    """Dependency injection helper for FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def db_session_scope() -> Generator[Session, None, None]:
    """Context manager for background workers and services."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def check_database_health() -> bool:
    """Verifies that the database is reachable and responsive."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False


def init_database() -> None:
    """Initializes schema and stored procedures if not present."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    migrations_dir = os.path.join(base_dir, "migrations")

    # Connect to MySQL server (without selecting DB initially in case DB needs creating)
    try:
        server_conn = pymysql.connect(
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            charset="utf8mb4",
            autocommit=True
        )
        with server_conn.cursor() as cur:
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{settings.MYSQL_DATABASE}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        server_conn.close()
    except Exception as e:
        logger.warning(f"Could not verify/create database directly: {e}")

    # Now apply schema migration 001
    init_sql_path = os.path.join(migrations_dir, "001_init.sql")
    if os.path.exists(init_sql_path):
        try:
            with open(init_sql_path, "r", encoding="utf-8") as f:
                schema_sql = f.read()
            raw_conn = get_raw_connection()
            with raw_conn.cursor() as cur:
                cur.execute(schema_sql)
            raw_conn.close()
            logger.info("Database schema initialized successfully.")
        except Exception as e:
            logger.error(f"Failed executing schema migration: {e}")

    # Apply stored procedures migration 002
    proc_sql_path = os.path.join(migrations_dir, "002_procedures.sql")
    if os.path.exists(proc_sql_path):
        try:
            with open(proc_sql_path, "r", encoding="utf-8") as f:
                proc_sql = f.read()

            raw_conn = get_raw_connection()
            with raw_conn.cursor() as cur:
                blocks = proc_sql.split("DELIMITER //")
                for block in blocks:
                    parts = block.split("//")
                    for part in parts:
                        clean = part.replace("DELIMITER ;", "").strip()
                        if clean and not clean.startswith("--"):
                            if "CREATE PROCEDURE" in clean:
                                m = re.search(r"CREATE\s+PROCEDURE\s+`?([a-zA-Z0-9_]+)`?", clean, re.IGNORECASE)
                                if m:
                                    proc_name = m.group(1)
                                    try:
                                        cur.execute(f"DROP PROCEDURE IF EXISTS `{proc_name}`;")
                                    except Exception:
                                        pass
                                cur.execute(clean)
                            else:
                                for stmt in clean.split(";"):
                                    stmt = stmt.strip()
                                    if stmt and not stmt.startswith("--"):
                                        cur.execute(stmt)
            raw_conn.close()
            logger.info("Stored procedures initialized successfully.")
        except Exception as e:
            logger.error(f"Failed executing stored procedures migration: {e}")
