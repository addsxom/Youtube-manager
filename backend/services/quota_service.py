from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
QUOTA_PATH = DATA_DIR / "quota_usage.json"
DEFAULT_LIMIT = int(os.getenv("YTM_YOUTUBE_QUOTA_LIMIT", "10000"))

try:
    PACIFIC = ZoneInfo("America/Los_Angeles")
except ZoneInfoNotFoundError:
    # Windows Python installations can lack the IANA timezone database until the
    # tzdata package is installed. Keep the app bootable instead of crashing.
    PACIFIC = timezone(timedelta(hours=-8), name="Pacific")

_LOCK = threading.Lock()

LABELS = {
    "subscriptions.list": "Abonnements",
    "channels.list": "Chaînes / profil",
    "playlistItems.list": "Dernières vidéos",
    "subscriptions.delete": "Désabonnements",
}


def _today_key() -> str:
    # YouTube Data API quotas reset at midnight Pacific Time.
    return datetime.now(PACIFIC).date().isoformat()


def _empty_state() -> dict:
    return {"date": _today_key(), "units": 0, "operations": {}}


def _load_unlocked() -> dict:
    if not QUOTA_PATH.exists():
        return _empty_state()
    try:
        data = json.loads(QUOTA_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError):
        return _empty_state()
    if data.get("date") != _today_key():
        return _empty_state()
    data.setdefault("units", 0)
    data.setdefault("operations", {})
    return data


def _save_unlocked(data: dict) -> None:
    QUOTA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def record_quota(operation: str, units: int, calls: int = 1) -> None:
    if units <= 0 or calls <= 0:
        return
    with _LOCK:
        data = _load_unlocked()
        data["units"] = int(data.get("units", 0)) + units
        operations = data.setdefault("operations", {})
        entry = operations.setdefault(operation, {"calls": 0, "units": 0})
        entry["calls"] = int(entry.get("calls", 0)) + calls
        entry["units"] = int(entry.get("units", 0)) + units
        _save_unlocked(data)


def get_quota_status() -> dict:
    with _LOCK:
        data = _load_unlocked()

    used = int(data.get("units", 0))
    limit = max(1, DEFAULT_LIMIT)
    remaining = max(0, limit - used)
    percent_used = min(100, round((used / limit) * 100, 1))
    operations = data.get("operations", {})
    breakdown = []
    for key, value in operations.items():
        breakdown.append(
            {
                "operation": key,
                "label": LABELS.get(key, key),
                "calls": int(value.get("calls", 0)),
                "units": int(value.get("units", 0)),
            }
        )
    breakdown.sort(key=lambda item: item["units"], reverse=True)

    return {
        "date": data.get("date") or _today_key(),
        "used": used,
        "limit": limit,
        "remaining": remaining,
        "percentUsed": percent_used,
        "breakdown": breakdown,
        "estimated": True,
        "resetTimezone": "America/Los_Angeles",
        "note": "Estimation locale des requêtes effectuées par YTB Manager. Le quota réel reste celui du projet Google Cloud.",
    }
