from __future__ import annotations

import json
import os
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from backend.services.quota_service import record_quota

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
TOKEN_PATH = Path(os.getenv("YTM_TOKEN_PATH", ROOT_DIR / "token.json"))
CLIENT_SECRETS_PATH = Path(os.getenv("YTM_CLIENT_SECRET_PATH", ROOT_DIR / "client_secret.json"))
ACCOUNT_STATE_PATH = DATA_DIR / "active_account.json"
SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]


def load_saved_credentials() -> Credentials | None:
    """Load the existing OAuth session without opening a login window."""
    if not CLIENT_SECRETS_PATH.exists() or not TOKEN_PATH.exists():
        return None

    try:
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    except Exception:
        return None

    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
        except Exception:
            return None

    return creds if creds.valid else None


def load_account_profile() -> dict | None:
    if not ACCOUNT_STATE_PATH.exists():
        return None
    try:
        value = json.loads(ACCOUNT_STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError):
        return None
    if not isinstance(value, dict) or not value.get("id"):
        return None
    return value


def save_account_profile(profile: dict | None) -> None:
    if not profile or not profile.get("id"):
        return
    ACCOUNT_STATE_PATH.write_text(
        json.dumps(
            {
                "id": profile.get("id"),
                "name": profile.get("name") or "Compte YouTube",
                "avatarUrl": profile.get("avatarUrl"),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def login_google(force_account_selection: bool = False) -> Credentials:
    if not CLIENT_SECRETS_PATH.exists():
        raise FileNotFoundError(
            f"Fichier OAuth introuvable : {CLIENT_SECRETS_PATH.name}. "
            "Ajoute le fichier client_secret.json à la racine du projet."
        )

    if force_account_selection:
        ACCOUNT_STATE_PATH.unlink(missing_ok=True)

    creds = None if force_account_selection else load_saved_credentials()
    if not creds:
        flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRETS_PATH), SCOPES)
        kwargs = {"prompt": "select_account"} if force_account_selection else {}
        creds = flow.run_local_server(port=0, **kwargs)
        TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")

    return creds


def logout_google() -> None:
    TOKEN_PATH.unlink(missing_ok=True)
    ACCOUNT_STATE_PATH.unlink(missing_ok=True)


class YouTubeClient:
    def __init__(self, credentials: Credentials):
        self.credentials = credentials
        self.youtube = build("youtube", "v3", credentials=credentials, cache_discovery=False)

    def fetch_my_profile(self) -> dict | None:
        response = self.youtube.channels().list(
            part="snippet",
            mine=True,
            maxResults=1,
        ).execute()
        record_quota("channels.list", 1)
        items = response.get("items", [])
        if not items:
            return None

        item = items[0]
        snippet = item.get("snippet", {})
        thumbnails = snippet.get("thumbnails", {})
        avatar = (
            thumbnails.get("high", {})
            or thumbnails.get("medium", {})
            or thumbnails.get("default", {})
            or {}
        ).get("url")
        return {
            "id": item.get("id"),
            "name": snippet.get("title") or "Compte YouTube",
            "avatarUrl": avatar,
        }

    def fetch_all_subscriptions(self) -> list[dict]:
        subscriptions: list[dict] = []
        page_token = None

        while True:
            response = self.youtube.subscriptions().list(
                part="snippet",
                mine=True,
                maxResults=50,
                pageToken=page_token,
            ).execute()
            record_quota("subscriptions.list", 1)

            for item in response.get("items", []):
                snippet = item.get("snippet", {})
                resource = snippet.get("resourceId", {})
                thumbs = snippet.get("thumbnails", {})
                thumbnail = (
                    thumbs.get("medium", {}) or thumbs.get("default", {}) or {}
                ).get("url")
                subscriptions.append(
                    {
                        "subscription_id": item.get("id"),
                        "channel_id": resource.get("channelId"),
                        "title": snippet.get("title", "Chaîne inconnue"),
                        "description": snippet.get("description", ""),
                        "thumbnail_url": thumbnail,
                        "published_at": snippet.get("publishedAt"),
                    }
                )

            page_token = response.get("nextPageToken")
            if not page_token:
                break

        return [item for item in subscriptions if item.get("channel_id")]

    def fetch_channels_details(self, channel_ids: list[str]) -> dict[str, dict]:
        details: dict[str, dict] = {}
        for start in range(0, len(channel_ids), 50):
            chunk = channel_ids[start : start + 50]
            response = self.youtube.channels().list(
                part="statistics,contentDetails,brandingSettings",
                id=",".join(chunk),
                maxResults=50,
            ).execute()
            record_quota("channels.list", 1)

            for item in response.get("items", []):
                stats = item.get("statistics", {})
                content = item.get("contentDetails", {})
                branding = item.get("brandingSettings", {})
                image = branding.get("image", {})
                details[item["id"]] = {
                    "subscribers": int(stats.get("subscriberCount", 0)),
                    "videos": int(stats.get("videoCount", 0)),
                    "uploads_playlist": content.get("relatedPlaylists", {}).get("uploads"),
                    "banner_url": image.get("bannerExternalUrl"),
                }
        return details

    def fetch_recent_uploads(self, playlist_id: str | None, max_results: int = 10) -> list[dict]:
        if not playlist_id:
            return []

        response = self.youtube.playlistItems().list(
            part="contentDetails,snippet",
            playlistId=playlist_id,
            maxResults=min(50, max(1, max_results)),
        ).execute()
        record_quota("playlistItems.list", 1)

        uploads: list[dict] = []
        for item in response.get("items", []):
            snippet = item.get("snippet", {})
            content = item.get("contentDetails", {})
            resource = snippet.get("resourceId", {})
            thumbnails = snippet.get("thumbnails", {})
            thumbnail = (
                thumbnails.get("maxres", {})
                or thumbnails.get("standard", {})
                or thumbnails.get("high", {})
                or thumbnails.get("medium", {})
                or thumbnails.get("default", {})
                or {}
            ).get("url")
            published_at = content.get("videoPublishedAt") or snippet.get("publishedAt")
            video_id = content.get("videoId") or resource.get("videoId")
            if not video_id or not published_at:
                continue
            uploads.append(
                {
                    "id": video_id,
                    "title": snippet.get("title") or "Vidéo YouTube",
                    "thumbnailUrl": thumbnail,
                    "publishedAt": published_at,
                }
            )
        return uploads

    def fetch_recent_upload_dates(self, playlist_id: str | None, max_results: int = 10) -> list[str]:
        return [item["publishedAt"] for item in self.fetch_recent_uploads(playlist_id, max_results)]

    def unsubscribe(self, subscription_id: str) -> None:
        if not subscription_id:
            raise ValueError("ID d'abonnement manquant.")
        self.youtube.subscriptions().delete(id=subscription_id).execute()
        record_quota("subscriptions.delete", 50)


def resolve_account_profile(credentials: Credentials, refresh: bool = False) -> dict | None:
    if not refresh:
        cached = load_account_profile()
        if cached:
            return cached

    profile = YouTubeClient(credentials).fetch_my_profile()
    if profile:
        save_account_profile(profile)
    return profile
