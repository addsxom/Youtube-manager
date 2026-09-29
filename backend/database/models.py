from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from backend.database.database import Base

LEGACY_ACCOUNT_ID = "__legacy__"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Channel(Base):
    __tablename__ = "channels"
    __table_args__ = (
        UniqueConstraint("account_id", "id", name="uq_channels_account_youtube"),
    )

    pk = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(String, index=True, nullable=False)
    id = Column(String, index=True, nullable=False)
    subscription_id = Column(String, nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    banner_url = Column(String, nullable=True)
    recent_videos_json = Column(Text, nullable=True)
    subscribed_at = Column(String, nullable=True)
    subscribers = Column(Integer, default=0)
    videos = Column(Integer, default=0)
    last_video = Column(String, nullable=True)
    last_upload_at = Column(String, nullable=True)
    score = Column(Integer, default=100)
    favorite = Column(Boolean, default=False)
    ignored = Column(Boolean, default=False)
    note = Column(Text, nullable=True)

    snapshots = relationship(
        "ChannelSnapshot",
        back_populates="channel",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ChannelSnapshot(Base):
    __tablename__ = "channel_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    channel_pk = Column(Integer, ForeignKey("channels.pk", ondelete="CASCADE"), index=True, nullable=False)
    account_id = Column(String, index=True, nullable=False)
    channel_id = Column(String, index=True, nullable=False)
    captured_at = Column(DateTime(timezone=True), default=utcnow, index=True, nullable=False)
    subscribers = Column(Integer, default=0)
    videos = Column(Integer, default=0)
    score = Column(Integer, default=0)
    last_upload_at = Column(String, nullable=True)

    channel = relationship("Channel", back_populates="snapshots")


class SyncRun(Base):
    __tablename__ = "sync_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(String, index=True, nullable=False)
    captured_at = Column(DateTime(timezone=True), default=utcnow, index=True, nullable=False)
    created = Column(Integer, default=0)
    removed = Column(Integer, default=0)
    became_active = Column(Integer, default=0)
    became_inactive = Column(Integer, default=0)
    subscriber_delta = Column(Integer, default=0)
    new_videos = Column(Integer, default=0)


class PendingSyncChange(Base):
    __tablename__ = "pending_sync_changes"

    account_id = Column(String, primary_key=True)
    removed = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
