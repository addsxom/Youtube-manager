from __future__ import annotations

import json
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from backend.database.database import SessionLocal
from backend.database.models import LEGACY_ACCOUNT_ID, Channel, ChannelSnapshot, PendingSyncChange, SyncRun
from backend.services.scoring import calculate_activity_score
from backend.services.youtube_service import YouTubeClient, login_google, resolve_account_profile

_SYNC_RUN_LOCK = threading.Lock()
_SYNC_STATE_LOCK = threading.Lock()
_SYNC_STATE: dict = {
    "running": False,
    "stage": "idle",
    "current": 0,
    "total": 0,
    "channel": None,
    "error": None,
}
_THREAD_LOCAL = threading.local()


class SyncAlreadyRunning(RuntimeError):
    pass


def _set_sync_state(**values) -> None:
    with _SYNC_STATE_LOCK:
        _SYNC_STATE.update(values)


def get_sync_status() -> dict:
    with _SYNC_STATE_LOCK:
        return dict(_SYNC_STATE)


def _client_for_worker(credentials) -> YouTubeClient:
    client = getattr(_THREAD_LOCAL, "youtube_client", None)
    if client is None:
        client = YouTubeClient(credentials)
        _THREAD_LOCAL.youtube_client = client
    return client


def _claim_legacy_data(db, account_id: str) -> bool:
    current_count = db.query(Channel).filter(Channel.account_id == account_id).count()
    legacy_count = db.query(Channel).filter(Channel.account_id == LEGACY_ACCOUNT_ID).count()
    if current_count or not legacy_count:
        return False

    db.query(Channel).filter(Channel.account_id == LEGACY_ACCOUNT_ID).update(
        {Channel.account_id: account_id},
        synchronize_session=False,
    )
    db.query(ChannelSnapshot).filter(ChannelSnapshot.account_id == LEGACY_ACCOUNT_ID).update(
        {ChannelSnapshot.account_id: account_id},
        synchronize_session=False,
    )
    db.flush()
    return True


def _subscriber_delta_pct(previous_subscribers: int | None, current_subscribers: int) -> float | None:
    if not previous_subscribers:
        return None
    return ((current_subscribers - previous_subscribers) / previous_subscribers) * 100


def _fetch_recent_uploads_parallel(credentials, subscriptions: list[dict], details: dict[str, dict]) -> dict[str, list[dict]]:
    total = len(subscriptions)
    if not total:
        return {}

    workers = min(6, total)
    results: dict[str, list[dict]] = {}
    _set_sync_state(stage="videos", current=0, total=total, channel=None)

    def fetch(subscription: dict) -> tuple[str, list[dict]]:
        channel_id = subscription["channel_id"]
        playlist_id = details.get(channel_id, {}).get("uploads_playlist")
        uploads = _client_for_worker(credentials).fetch_recent_uploads(playlist_id, max_results=50)
        return channel_id, uploads

    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="ytm-videos") as executor:
        futures = {executor.submit(fetch, subscription): subscription for subscription in subscriptions}
        completed = 0
        for future in as_completed(futures):
            subscription = futures[future]
            channel_id, uploads = future.result()
            results[channel_id] = uploads
            completed += 1
            _set_sync_state(
                current=completed,
                total=total,
                channel=subscription.get("title") or "Chaîne YouTube",
            )

    return results


def sync_subscriptions() -> dict:
    if not _SYNC_RUN_LOCK.acquire(blocking=False):
        raise SyncAlreadyRunning("Une synchronisation est déjà en cours.")

    _set_sync_state(running=True, stage="auth", current=0, total=0, channel=None, error=None)
    try:
        credentials = login_google()
        profile = resolve_account_profile(credentials)
        account_id = (profile or {}).get("id")
        if not account_id:
            raise RuntimeError("Impossible d'identifier le compte YouTube connecté.")

        client = YouTubeClient(credentials)
        _set_sync_state(stage="subscriptions")
        subscriptions = client.fetch_all_subscriptions()
        channel_ids = [item["channel_id"] for item in subscriptions]
        _set_sync_state(stage="details", current=0, total=len(subscriptions))
        details = client.fetch_channels_details(channel_ids)
        recent_by_channel = _fetch_recent_uploads_parallel(credentials, subscriptions, details)
        captured_at = datetime.now(timezone.utc)

        db = SessionLocal()
        try:
            claimed_legacy = _claim_legacy_data(db, account_id)
            existing_rows = db.query(Channel).filter(Channel.account_id == account_id).all()
            existing = {channel.id: channel for channel in existing_rows}
            had_previous_data = bool(existing_rows)
            previous_total_subscribers = sum(channel.subscribers or 0 for channel in existing_rows)
            pending_change = (
                db.query(PendingSyncChange)
                .filter(PendingSyncChange.account_id == account_id)
                .first()
            )
            pending_removed = max(0, int(pending_change.removed or 0)) if pending_change else 0

            seen_ids: set[str] = set()
            created = 0
            updated = 0
            became_active = 0
            became_inactive = 0
            new_videos = 0
            current_total_subscribers = 0

            _set_sync_state(stage="saving", current=0, total=len(subscriptions), channel=None)
            for index, subscription in enumerate(subscriptions, start=1):
                channel_id = subscription["channel_id"]
                seen_ids.add(channel_id)
                stats = details.get(channel_id, {})
                subscribers = int(stats.get("subscribers", 0) or 0)
                videos = int(stats.get("videos", 0) or 0)
                recent_uploads = recent_by_channel.get(channel_id, [])
                upload_dates = [item["publishedAt"] for item in recent_uploads]

                channel = existing.get(channel_id)
                previous_score = channel.score if channel is not None else None
                previous_subscribers = channel.subscribers if channel is not None else None
                previous_videos = channel.videos if channel is not None else None
                delta_pct = _subscriber_delta_pct(previous_subscribers, subscribers)
                score, relative_label, _ = calculate_activity_score(upload_dates, delta_pct)
                latest_upload = upload_dates[0] if upload_dates else None

                if channel is None:
                    channel = Channel(account_id=account_id, id=channel_id)
                    db.add(channel)
                    existing[channel_id] = channel
                    created += 1
                else:
                    updated += 1
                    if previous_videos is not None:
                        new_videos += max(0, videos - int(previous_videos or 0))
                    if previous_score is not None and previous_score < 70 <= score:
                        became_active += 1
                    if previous_score is not None and previous_score >= 40 > score:
                        became_inactive += 1

                channel.subscription_id = subscription.get("subscription_id")
                channel.name = subscription.get("title") or "Chaîne inconnue"
                channel.description = subscription.get("description")
                channel.thumbnail_url = subscription.get("thumbnail_url")
                channel.banner_url = stats.get("banner_url")
                channel.recent_videos_json = json.dumps(recent_uploads, ensure_ascii=False)
                channel.subscribed_at = subscription.get("published_at")
                channel.subscribers = subscribers
                channel.videos = videos
                channel.last_video = relative_label
                channel.last_upload_at = latest_upload
                channel.score = score
                current_total_subscribers += subscribers

                if channel.pk is None:
                    db.flush()

                db.add(
                    ChannelSnapshot(
                        channel_pk=channel.pk,
                        account_id=account_id,
                        channel_id=channel_id,
                        captured_at=captured_at,
                        subscribers=subscribers,
                        videos=videos,
                        score=score,
                        last_upload_at=latest_upload,
                    )
                )
                _set_sync_state(
                    current=index,
                    total=len(subscriptions),
                    channel=channel.name,
                )

            stale = (
                db.query(Channel)
                .filter(Channel.account_id == account_id, ~Channel.id.in_(seen_ids))
                .all()
                if seen_ids
                else db.query(Channel).filter(Channel.account_id == account_id).all()
            )
            remote_removed = len(stale)
            removed = remote_removed + pending_removed
            for channel in stale:
                db.delete(channel)

            subscriber_delta = (
                current_total_subscribers - previous_total_subscribers
                if had_previous_data or claimed_legacy
                else 0
            )
            db.add(
                SyncRun(
                    account_id=account_id,
                    captured_at=captured_at,
                    created=created,
                    removed=removed,
                    became_active=became_active,
                    became_inactive=became_inactive,
                    subscriber_delta=subscriber_delta,
                    new_videos=new_videos,
                )
            )

            if pending_change and pending_removed:
                pending_change.removed = max(0, int(pending_change.removed or 0) - pending_removed)

            db.commit()
            changes = {
                "created": created,
                "removed": removed,
                "becameActive": became_active,
                "becameInactive": became_inactive,
                "subscriberDelta": subscriber_delta,
                "newVideos": new_videos,
            }
            _set_sync_state(stage="done", current=len(subscriptions), total=len(subscriptions), channel=None)
            return {
                "total": len(subscriptions),
                "created": created,
                "updated": updated,
                "removed": removed,
                "synced_at": captured_at.isoformat(),
                "changes": changes,
            }
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
    except Exception as exc:
        _set_sync_state(stage="error", error=str(exc))
        raise
    finally:
        _set_sync_state(running=False)
        _SYNC_RUN_LOCK.release()
