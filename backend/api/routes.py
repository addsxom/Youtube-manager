from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func

from backend.database.database import SessionLocal
from backend.database.models import Channel, ChannelSnapshot, PendingSyncChange, SyncRun
from backend.services.quota_service import get_quota_status
from backend.services.sync_service import SyncAlreadyRunning, get_sync_status, sync_subscriptions
from backend.services.youtube_service import (
    CLIENT_SECRETS_PATH,
    YouTubeClient,
    load_saved_credentials,
    login_google,
    logout_google,
    resolve_account_profile,
)

router = APIRouter(prefix="/api")


class ChannelPatch(BaseModel):
    favorite: bool | None = None
    ignored: bool | None = None
    note: str | None = Field(default=None, max_length=2000)


def _recent_videos(channel: Channel) -> list[dict]:
    if not channel.recent_videos_json:
        return []
    try:
        value = json.loads(channel.recent_videos_json)
        return value if isinstance(value, list) else []
    except (TypeError, ValueError, json.JSONDecodeError):
        return []


def serialize_channel(channel: Channel) -> dict:
    return {
        "id": channel.id,
        "subscriptionId": channel.subscription_id,
        "name": channel.name,
        "description": channel.description or "",
        "thumbnailUrl": channel.thumbnail_url,
        "bannerUrl": channel.banner_url,
        "recentVideos": _recent_videos(channel),
        "subscribedAt": channel.subscribed_at,
        "subscribers": channel.subscribers or 0,
        "videos": channel.videos or 0,
        "lastVideo": channel.last_video or "Inconnue",
        "lastUploadAt": channel.last_upload_at,
        "score": channel.score if channel.score is not None else 0,
        "favorite": bool(channel.favorite),
        "ignored": bool(channel.ignored),
        "note": channel.note or "",
    }


def _active_account_context() -> tuple[object, str]:
    credentials = load_saved_credentials()
    if not credentials:
        raise HTTPException(status_code=401, detail="Connexion YouTube requise")

    try:
        profile = resolve_account_profile(credentials)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Profil YouTube inaccessible : {exc}") from exc

    account_id = (profile or {}).get("id")
    if not account_id:
        raise HTTPException(status_code=502, detail="Impossible d'identifier le compte YouTube connecté")
    return credentials, str(account_id)


def _active_account_id() -> str:
    return _active_account_context()[1]


@router.get("/health")
def health() -> dict:
    authenticated = bool(load_saved_credentials())
    return {
        "status": "ok",
        "authenticated": authenticated,
        "clientSecretPresent": CLIENT_SECRETS_PATH.exists(),
    }


@router.get("/account")
def account() -> dict:
    credentials = load_saved_credentials()
    if not credentials:
        return {"connected": False, "id": None, "name": None, "avatarUrl": None}

    try:
        profile = resolve_account_profile(credentials)
    except Exception:
        profile = None

    return {
        "connected": True,
        "id": (profile or {}).get("id"),
        "name": (profile or {}).get("name") or "Compte YouTube",
        "avatarUrl": (profile or {}).get("avatarUrl"),
    }


@router.post("/auth/logout")
def logout() -> dict:
    logout_google()
    return {"ok": True, "connected": False}


@router.post("/auth/switch")
async def switch_account() -> dict:
    if not CLIENT_SECRETS_PATH.exists():
        raise HTTPException(
            status_code=400,
            detail="client_secret.json est requis à la racine du projet pour changer de compte.",
        )

    logout_google()
    try:
        credentials = await asyncio.to_thread(login_google, True)
        profile = await asyncio.to_thread(resolve_account_profile, credentials, True)
        return {
            "ok": True,
            "connected": True,
            "id": (profile or {}).get("id"),
            "name": (profile or {}).get("name") or "Compte YouTube",
            "avatarUrl": (profile or {}).get("avatarUrl"),
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Connexion Google impossible : {exc}") from exc


@router.get("/quota")
def quota() -> dict:
    return get_quota_status()


@router.get("/channels")
def list_channels(
    search: str = "",
    status: str = Query(default="all", pattern="^(all|active|watch|inactive|favorite)$"),
) -> dict:
    account_id = _active_account_id()
    db = SessionLocal()
    try:
        query = db.query(Channel).filter(Channel.account_id == account_id)
        if search.strip():
            query = query.filter(Channel.name.ilike(f"%{search.strip()}%"))
        if status == "active":
            query = query.filter(Channel.score >= 70)
        elif status == "watch":
            query = query.filter(Channel.score >= 40, Channel.score < 70)
        elif status == "inactive":
            query = query.filter(Channel.score < 40)
        elif status == "favorite":
            query = query.filter(Channel.favorite.is_(True))

        channels = query.order_by(Channel.score.asc(), Channel.name.asc()).all()
        return {"items": [serialize_channel(channel) for channel in channels], "total": len(channels)}
    finally:
        db.close()


@router.get("/channels/{channel_id}")
def get_channel(channel_id: str) -> dict:
    account_id = _active_account_id()
    db = SessionLocal()
    try:
        channel = (
            db.query(Channel)
            .filter(Channel.account_id == account_id, Channel.id == channel_id)
            .first()
        )
        if not channel:
            raise HTTPException(status_code=404, detail="Chaîne introuvable")
        result = serialize_channel(channel)
        snapshots = (
            db.query(ChannelSnapshot)
            .filter(
                ChannelSnapshot.account_id == account_id,
                ChannelSnapshot.channel_id == channel_id,
            )
            .order_by(ChannelSnapshot.captured_at.desc())
            .limit(60)
            .all()
        )
        result["history"] = [
            {
                "capturedAt": snap.captured_at.isoformat(),
                "subscribers": snap.subscribers,
                "videos": snap.videos,
                "score": snap.score,
            }
            for snap in reversed(snapshots)
        ]
        return result
    finally:
        db.close()


@router.patch("/channels/{channel_id}")
def patch_channel(channel_id: str, patch: ChannelPatch) -> dict:
    account_id = _active_account_id()
    db = SessionLocal()
    try:
        channel = (
            db.query(Channel)
            .filter(Channel.account_id == account_id, Channel.id == channel_id)
            .first()
        )
        if not channel:
            raise HTTPException(status_code=404, detail="Chaîne introuvable")

        fields = patch.model_fields_set
        if "favorite" in fields:
            channel.favorite = bool(patch.favorite)
        if "ignored" in fields:
            channel.ignored = bool(patch.ignored)
        if "note" in fields:
            channel.note = (patch.note or "").strip()

        db.commit()
        db.refresh(channel)
        return serialize_channel(channel)
    finally:
        db.close()


@router.delete("/channels/{channel_id}/subscription")
def unsubscribe(channel_id: str) -> dict:
    credentials, account_id = _active_account_context()
    db = SessionLocal()
    try:
        channel = (
            db.query(Channel)
            .filter(Channel.account_id == account_id, Channel.id == channel_id)
            .first()
        )
        if not channel:
            raise HTTPException(status_code=404, detail="Chaîne introuvable")
        if not channel.subscription_id:
            raise HTTPException(status_code=400, detail="ID d'abonnement manquant")

        YouTubeClient(credentials).unsubscribe(channel.subscription_id)
        name = channel.name

        pending = db.query(PendingSyncChange).filter(PendingSyncChange.account_id == account_id).first()
        if pending is None:
            pending = PendingSyncChange(account_id=account_id, removed=1)
            db.add(pending)
        else:
            pending.removed = int(pending.removed or 0) + 1

        db.delete(channel)
        db.commit()
        return {"ok": True, "channelId": channel_id, "name": name}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail=f"YouTube API : {exc}") from exc
    finally:
        db.close()


@router.get("/sync/status")
def sync_status() -> dict:
    return get_sync_status()


@router.post("/sync")
async def sync() -> dict:
    try:
        return await asyncio.to_thread(sync_subscriptions)
    except SyncAlreadyRunning as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Synchronisation impossible : {exc}") from exc


@router.get("/dashboard")
def dashboard() -> dict:
    account_id = _active_account_id()
    db = SessionLocal()
    try:
        channels = db.query(Channel).filter(Channel.account_id == account_id).all()
        total = len(channels)
        active = sum(1 for c in channels if (c.score or 0) >= 70)
        watch = sum(1 for c in channels if 40 <= (c.score or 0) < 70)
        inactive = sum(1 for c in channels if (c.score or 0) < 40)
        favorites = sum(1 for c in channels if c.favorite)
        total_subscribers = sum(c.subscribers or 0 for c in channels)
        latest_run = (
            db.query(SyncRun)
            .filter(SyncRun.account_id == account_id)
            .order_by(SyncRun.captured_at.desc())
            .first()
        )
        latest_sync = latest_run.captured_at if latest_run else (
            db.query(func.max(ChannelSnapshot.captured_at))
            .filter(ChannelSnapshot.account_id == account_id)
            .scalar()
        )

        now = datetime.now(timezone.utc)
        buckets = {
            "< 7 jours": 0,
            "7 - 30 jours": 0,
            "1 - 3 mois": 0,
            "3 - 6 mois": 0,
            "6 - 12 mois": 0,
            "> 1 an": 0,
            "Aucune vidéo": 0,
        }
        for channel in channels:
            if not channel.last_upload_at:
                buckets["Aucune vidéo"] += 1
                continue
            try:
                uploaded = datetime.fromisoformat(channel.last_upload_at.replace("Z", "+00:00"))
                days = max(0, (now - uploaded).days)
            except ValueError:
                buckets["Aucune vidéo"] += 1
                continue
            if days < 7:
                buckets["< 7 jours"] += 1
            elif days <= 30:
                buckets["7 - 30 jours"] += 1
            elif days <= 90:
                buckets["1 - 3 mois"] += 1
            elif days <= 180:
                buckets["3 - 6 mois"] += 1
            elif days <= 365:
                buckets["6 - 12 mois"] += 1
            else:
                buckets["> 1 an"] += 1

        attention = sorted(
            [c for c in channels if not c.ignored and (c.score or 0) < 70],
            key=lambda c: (c.score or 0, c.name.lower()),
        )[:6]

        last_changes = None
        if latest_run:
            last_changes = {
                "created": latest_run.created or 0,
                "removed": latest_run.removed or 0,
                "becameActive": latest_run.became_active or 0,
                "becameInactive": latest_run.became_inactive or 0,
                "subscriberDelta": latest_run.subscriber_delta or 0,
                "newVideos": latest_run.new_videos or 0,
            }

        return {
            "total": total,
            "active": active,
            "watch": watch,
            "inactive": inactive,
            "favorites": favorites,
            "totalSubscribers": total_subscribers,
            "lastSync": latest_sync.isoformat() if latest_sync else None,
            "lastChanges": last_changes,
            "distribution": [{"label": key, "value": value} for key, value in buckets.items()],
            "attention": [serialize_channel(channel) for channel in attention],
        }
    finally:
        db.close()


@router.get("/analytics/history")
def analytics_history(days: int = Query(default=90, ge=7, le=730)) -> dict:
    account_id = _active_account_id()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    db = SessionLocal()
    try:
        snapshots = (
            db.query(ChannelSnapshot)
            .filter(
                ChannelSnapshot.account_id == account_id,
                ChannelSnapshot.captured_at >= cutoff,
            )
            .order_by(ChannelSnapshot.captured_at.asc())
            .all()
        )

        latest_per_channel_day: dict[tuple[str, str], ChannelSnapshot] = {}
        for snap in snapshots:
            key = (snap.captured_at.date().isoformat(), snap.channel_id)
            latest_per_channel_day[key] = snap

        grouped: dict[str, list[ChannelSnapshot]] = defaultdict(list)
        for (date, _channel_id), snap in latest_per_channel_day.items():
            grouped[date].append(snap)

        points = []
        for date in sorted(grouped):
            items = grouped[date]
            points.append(
                {
                    "date": date,
                    "subscribers": sum(item.subscribers or 0 for item in items),
                    "channels": len(items),
                    "averageScore": round(sum(item.score or 0 for item in items) / max(1, len(items)), 1),
                }
            )
        return {"points": points}
    finally:
        db.close()


@router.get("/settings")
def settings() -> dict:
    return {
        "authenticated": bool(load_saved_credentials()),
        "clientSecretPresent": CLIENT_SECRETS_PATH.exists(),
        "database": "data/youtube_manager.db",
        "apiBase": "http://127.0.0.1:8765/api",
    }
