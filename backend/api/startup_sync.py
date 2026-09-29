from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException

from backend.database.database import SessionLocal
from backend.database.models import Channel, PendingSyncChange
from backend.services.youtube_service import YouTubeClient, load_saved_credentials, resolve_account_profile

router = APIRouter(prefix="/api")


def _check_sync_needed() -> dict:
    credentials = load_saved_credentials()
    if not credentials:
        raise HTTPException(status_code=401, detail="Connexion YouTube requise")

    profile = resolve_account_profile(credentials)
    account_id = (profile or {}).get("id")
    if not account_id:
        raise HTTPException(status_code=502, detail="Impossible d'identifier le compte YouTube connecté")

    # Au lancement, on ne fait volontairement qu'une vérification légère de la
    # liste des abonnements. Les compteurs de vidéos changent naturellement
    # quand les créateurs publient et ne doivent donc pas déclencher une grosse
    # synchronisation à chaque ouverture de YTB Manager.
    client = YouTubeClient(credentials)
    subscriptions = client.fetch_all_subscriptions()
    remote_ids = {item["channel_id"] for item in subscriptions if item.get("channel_id")}

    db = SessionLocal()
    try:
        local_rows = db.query(Channel).filter(Channel.account_id == str(account_id)).all()
        local_ids = {channel.id for channel in local_rows}

        pending = (
            db.query(PendingSyncChange)
            .filter(PendingSyncChange.account_id == str(account_id))
            .first()
        )
        pending_removed = max(0, int(pending.removed or 0)) if pending else 0

        added = len(remote_ids - local_ids)
        removed_external = len(local_ids - remote_ids)
        removed = removed_external + pending_removed

        return {
            "needsSync": bool(added or removed),
            "added": added,
            "removed": removed,
            "channelsWithVideoChanges": 0,
            "remoteTotal": len(remote_ids),
        }
    finally:
        db.close()


@router.get("/sync/check")
async def sync_check() -> dict:
    try:
        return await asyncio.to_thread(_check_sync_needed)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Vérification de synchronisation impossible : {exc}") from exc
