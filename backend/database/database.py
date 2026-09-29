from __future__ import annotations

import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "youtube_manager.db"
DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"
LEGACY_ACCOUNT_ID = "__legacy__"
LEGACY_CHANNELS_TABLE = "channels_legacy_v1"
LEGACY_SNAPSHOTS_TABLE = "channel_snapshots_legacy_v1"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    future=True,
)


@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _table_exists(connection: sqlite3.Connection, table: str) -> bool:
    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone()
    return row is not None


def _columns(connection: sqlite3.Connection, table: str) -> set[str]:
    if not _table_exists(connection, table):
        return set()
    return {row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')}


def _prepare_legacy_rebuild() -> bool:
    if not DB_PATH.exists():
        return False

    with sqlite3.connect(DB_PATH) as connection:
        channel_columns = _columns(connection, "channels")
        if not channel_columns:
            return False
        if "pk" in channel_columns and "account_id" in channel_columns:
            return False

        connection.execute("PRAGMA foreign_keys=OFF")
        if _table_exists(connection, LEGACY_SNAPSHOTS_TABLE):
            connection.execute(f'DROP TABLE "{LEGACY_SNAPSHOTS_TABLE}"')
        if _table_exists(connection, LEGACY_CHANNELS_TABLE):
            connection.execute(f'DROP TABLE "{LEGACY_CHANNELS_TABLE}"')

        if _table_exists(connection, "channel_snapshots"):
            connection.execute(
                f'ALTER TABLE "channel_snapshots" RENAME TO "{LEGACY_SNAPSHOTS_TABLE}"'
            )
        connection.execute(f'ALTER TABLE "channels" RENAME TO "{LEGACY_CHANNELS_TABLE}"')
        connection.commit()
        return True


def _copy_legacy_data() -> None:
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute("PRAGMA foreign_keys=OFF")

        source_columns = _columns(connection, LEGACY_CHANNELS_TABLE)
        channel_fields = [
            "id",
            "subscription_id",
            "name",
            "description",
            "thumbnail_url",
            "banner_url",
            "recent_videos_json",
            "subscribed_at",
            "subscribers",
            "videos",
            "last_video",
            "last_upload_at",
            "score",
            "favorite",
            "ignored",
            "note",
        ]
        copied_fields = [field for field in channel_fields if field in source_columns]
        if copied_fields:
            target_sql = ", ".join(["account_id", *copied_fields])
            source_sql = ", ".join(copied_fields)
            connection.execute(
                f'INSERT INTO channels ({target_sql}) '
                f'SELECT ?, {source_sql} FROM "{LEGACY_CHANNELS_TABLE}"',
                (LEGACY_ACCOUNT_ID,),
            )

        snapshot_columns = _columns(connection, LEGACY_SNAPSHOTS_TABLE)
        if snapshot_columns and "channel_id" in snapshot_columns:
            optional = [
                field
                for field in ["captured_at", "subscribers", "videos", "score", "last_upload_at"]
                if field in snapshot_columns
            ]
            target_sql = ", ".join(["channel_pk", "account_id", "channel_id", *optional])
            source_sql = ", ".join([f's."{field}"' for field in optional])
            optional_select = f", {source_sql}" if source_sql else ""
            connection.execute(
                f'INSERT INTO channel_snapshots ({target_sql}) '
                f'SELECT c.pk, ?, s.channel_id{optional_select} '
                f'FROM "{LEGACY_SNAPSHOTS_TABLE}" s '
                f'JOIN channels c ON c.account_id = ? AND c.id = s.channel_id',
                (LEGACY_ACCOUNT_ID, LEGACY_ACCOUNT_ID),
            )

        if _table_exists(connection, LEGACY_SNAPSHOTS_TABLE):
            connection.execute(f'DROP TABLE "{LEGACY_SNAPSHOTS_TABLE}"')
        if _table_exists(connection, LEGACY_CHANNELS_TABLE):
            connection.execute(f'DROP TABLE "{LEGACY_CHANNELS_TABLE}"')
        connection.commit()
        connection.execute("PRAGMA foreign_keys=ON")


def _ensure_additive_columns() -> None:
    if not DB_PATH.exists():
        return

    with sqlite3.connect(DB_PATH) as connection:
        sync_columns = _columns(connection, "sync_runs")
        if sync_columns and "new_videos" not in sync_columns:
            connection.execute("ALTER TABLE sync_runs ADD COLUMN new_videos INTEGER DEFAULT 0")
        connection.commit()


def init_db() -> None:
    from backend.database import models  # noqa: F401

    legacy_rebuild = _prepare_legacy_rebuild()
    Base.metadata.create_all(bind=engine)
    if legacy_rebuild:
        _copy_legacy_data()
    _ensure_additive_columns()
