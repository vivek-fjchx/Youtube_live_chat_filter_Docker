import os
import time
import threading
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/youtube.readonly"]
POLL_INTERVAL_SECONDS = 60  # poll every 60s

# In-memory token store (per session)
user_credentials: dict = {}

# Callback to push messages into main pipeline
_ingest_callback = None

def set_ingest_callback(fn):
    global _ingest_callback
    _ingest_callback = fn


def get_oauth_flow(redirect_uri: str) -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": os.environ.get("GOOGLE_CLIENT_ID"),
                "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )


def get_live_chat_id(youtube, video_id: str) -> str | None:
    response = youtube.videos().list(
        part="liveStreamingDetails",
        id=video_id
    ).execute()

    items = response.get("items", [])
    if not items:
        return None
    return items[0].get("liveStreamingDetails", {}).get("activeLiveChatId")


def poll_chat(credentials: Credentials, video_id: str):
    """Poll YouTube live chat every 60s and push to pipeline."""
    youtube = build("youtube", "v3", credentials=credentials)
    live_chat_id = get_live_chat_id(youtube, video_id)

    if not live_chat_id:
        print(f"[YT Ingestion] No active live chat for video {video_id}")
        return

    print(f"[YT Ingestion] Starting poll for chat ID: {live_chat_id}")
    next_page_token = None

    while True:
        try:
            params = {
                "liveChatId": live_chat_id,
                "part": "snippet,authorDetails",
                "maxResults": 200
            }
            if next_page_token:
                params["pageToken"] = next_page_token

            response = youtube.liveChatMessages().list(**params).execute()
            next_page_token = response.get("nextPageToken")

            messages = []
            for item in response.get("items", []):
                snippet = item.get("snippet", {})
                author = item.get("authorDetails", {})

                msg_type = snippet.get("type")
                if msg_type != "textMessageEvent":
                    continue

                messages.append({
                    "text": snippet.get("displayMessage", "").strip(),
                    "username": author.get("displayName", "anonymous"),
                    "timestamp": int(time.time() * 1000)
                })

            if messages and _ingest_callback:
                print(f"[YT Ingestion] Fetched {len(messages)} messages")
                _ingest_callback(messages)

        except Exception as e:
            print(f"[YT Ingestion] Poll error: {e}")

        time.sleep(POLL_INTERVAL_SECONDS)


def start_polling(credentials: Credentials, video_id: str):
    """Start polling in a background thread."""
    thread = threading.Thread(
        target=poll_chat,
        args=(credentials, video_id),
        daemon=True
    )
    thread.start()
    print(f"[YT Ingestion] Polling thread started for video: {video_id}")