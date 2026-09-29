from __future__ import annotations

from datetime import datetime, timezone
from statistics import mean
from typing import Iterable


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def relative_date(last_upload: str | None) -> str:
    if not last_upload:
        return "Aucune vidéo"

    try:
        days = max(0, (datetime.now(timezone.utc) - _parse_iso(last_upload)).days)
    except (ValueError, TypeError):
        return "Inconnue"

    if days == 0:
        return "Aujourd'hui"
    if days == 1:
        return "Hier"
    if days < 30:
        return f"il y a {days} jours"
    if days < 365:
        months = max(1, days // 30)
        return f"il y a {months} mois"
    years = max(1, days // 365)
    return f"il y a {years} an" if years == 1 else f"il y a {years} ans"


def _recency_score(days: int) -> int:
    if days <= 14:
        return 50
    if days <= 30:
        return 46
    if days <= 60:
        return 39
    if days <= 90:
        return 32
    if days <= 180:
        return 22
    if days <= 365:
        return 10
    return 2


def _frequency_score(dates: list[datetime]) -> int:
    if len(dates) < 2:
        return 8 if dates else 0

    ordered = sorted(dates, reverse=True)
    intervals = [max(1, (ordered[i] - ordered[i + 1]).days) for i in range(len(ordered) - 1)]
    avg_interval = mean(intervals)

    if avg_interval <= 7:
        return 25
    if avg_interval <= 14:
        return 23
    if avg_interval <= 30:
        return 20
    if avg_interval <= 60:
        return 15
    if avg_interval <= 90:
        return 10
    return 5


def _recent_activity_score(dates: Iterable[datetime]) -> int:
    now = datetime.now(timezone.utc)
    recent = sum(1 for date in dates if (now - date).days <= 90)
    if recent >= 8:
        return 15
    if recent >= 5:
        return 13
    if recent >= 3:
        return 10
    if recent >= 1:
        return 6
    return 0


def _evolution_score(subscriber_delta_pct: float | None) -> int:
    if subscriber_delta_pct is None:
        return 5
    if subscriber_delta_pct >= 5:
        return 10
    if subscriber_delta_pct >= 1:
        return 8
    if subscriber_delta_pct >= 0:
        return 6
    if subscriber_delta_pct >= -2:
        return 4
    return 1


def calculate_activity_score(
    upload_dates: list[str] | None,
    subscriber_delta_pct: float | None = None,
) -> tuple[int, str, dict[str, int]]:
    """Return a 0-100 score, a relative date label and its weighted breakdown."""
    clean_dates: list[datetime] = []
    for value in upload_dates or []:
        try:
            clean_dates.append(_parse_iso(value))
        except (ValueError, TypeError):
            continue

    if not clean_dates:
        return 0, "Aucune vidéo", {"recency": 0, "frequency": 0, "activity": 0, "evolution": 0}

    latest = max(clean_dates)
    days_since_latest = max(0, (datetime.now(timezone.utc) - latest).days)
    breakdown = {
        "recency": _recency_score(days_since_latest),
        "frequency": _frequency_score(clean_dates),
        "activity": _recent_activity_score(clean_dates),
        "evolution": _evolution_score(subscriber_delta_pct),
    }
    score = max(0, min(100, sum(breakdown.values())))
    return score, relative_date(latest.isoformat()), breakdown
