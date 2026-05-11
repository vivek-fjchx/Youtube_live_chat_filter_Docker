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

# ─── State ────────────────────────────────────────────────────────────────────

ranked_questions: list[dict] = []
answered_canonicals: set[str] = set()

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
    cleaned = prefilter(raw)

    questions = []
    for msg in cleaned:
        if is_question(msg["text"]) and not is_duplicate(msg["text"]):
            questions.append(msg)

    add_to_buffer(questions)

    global ranked_questions
    ranked_questions = group_and_rank()
    ranked_questions = [
        q for q in ranked_questions
        if q["canonical"] not in answered_canonicals
    ]

    print(f"[Backend] {len(raw)} raw → {len(cleaned)} clean → {len(questions)} questions → {len(ranked_questions)} ranked")
    return {
        "status": "ok",
        "received": len(raw),
        "after_filter": len(cleaned),
        "final_questions": len(questions),
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