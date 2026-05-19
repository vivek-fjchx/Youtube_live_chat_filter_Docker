import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import time
from classifier import is_question
from prefilter import prefilter
from deduplicator import is_duplicate
from ranker import add_to_buffer, group_and_rank, set_buffer_context

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    text: str
    username: Optional[str] = "anonymous"
    timestamp: Optional[int] = None

class IngestPayload(BaseModel):
    messages: List[ChatMessage]

class ContextPayload(BaseModel):
    topic: str

class StreamPayload(BaseModel):
    video_id: str
    access_token: str
    refresh_token: str

# ─── State ────────────────────────────────────────────────────────────────────

ranked_questions: list[dict] = []
answered_canonicals: set[str] = set()

# ─── Pipeline function ────────────────────────────────────────────────────────

def process_messages(messages: list[dict]):
    global ranked_questions

    cleaned = prefilter(messages)
    questions = []
    for msg in cleaned:
        if is_question(msg["text"]) and not is_duplicate(msg["text"]):
            questions.append(msg)

    add_to_buffer(questions)
    ranked_questions = group_and_rank()
    ranked_questions = [
        q for q in ranked_questions
        if q["canonical"] not in answered_canonicals
    ]
    print(f"[Pipeline] {len(messages)} → {len(questions)} questions → {len(ranked_questions)} ranked")

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.post("/set_context")
async def update_context(payload: ContextPayload):
    set_buffer_context(payload.topic)
    return {"status": "ok", "topic": payload.topic}


@app.post("/ingest_chat")
async def ingest_chat(payload: IngestPayload):
    if not payload.messages:
        raise HTTPException(status_code=400, detail="Empty payload")

    raw = [m.dict() for m in payload.messages]
    process_messages(raw)

    return {
        "status": "ok",
        "received": len(raw),
        "ranked": len(ranked_questions)
    }


@app.get("/ranked")
async def get_ranked():
    return {"questions": ranked_questions}


@app.post("/mark_answered")
async def mark_answered(payload: dict):
    canonical = payload.get("canonical")
    if canonical:
        answered_canonicals.add(canonical)
        global ranked_questions
        ranked_questions = [
            q for q in ranked_questions
            if q["canonical"] not in answered_canonicals
        ]
    return {"status": "ok"}


@app.get("/health")
async def health():
    return {"status": "alive"}


# ─── OAuth + YouTube ingestion ────────────────────────────────────────────────

RENDER_URL = os.environ.get("RENDER_URL", "http://localhost:8000")


@app.get("/auth/login")
async def auth_login():
    from youtube_ingestion import get_oauth_flow
    flow = get_oauth_flow(f"{RENDER_URL}/auth/callback")
    auth_url, _ = flow.authorization_url(prompt="consent")
    return {"auth_url": auth_url}


@app.get("/auth/callback")
async def auth_callback(code: str):
    from youtube_ingestion import get_oauth_flow
    flow = get_oauth_flow(f"{RENDER_URL}/auth/callback")
    flow.fetch_token(code=code)
    credentials = flow.credentials
    return {
        "status": "authenticated",
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token
    }


@app.post("/start_stream")
async def start_stream(payload: StreamPayload):
    from youtube_ingestion import start_polling, set_ingest_callback
    from google.oauth2.credentials import Credentials

    set_ingest_callback(process_messages)

    credentials = Credentials(
        token=payload.access_token,
        refresh_token=payload.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get("GOOGLE_CLIENT_ID"),
        client_secret=os.environ.get("GOOGLE_CLIENT_SECRET")
    )
    start_polling(credentials, payload.video_id)
    return {"status": "polling started", "video_id": payload.video_id}
