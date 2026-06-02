import time
from openai import OpenAI
import json
import os
from dotenv import load_dotenv
load_dotenv()
current_context = {"topic": ""}

# Lazy client — only created when first needed so missing API key
# does NOT crash the app at startup (important for Railway / Render cold starts)
_client = None

def get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError(
                "OPENROUTER_API_KEY is not set. "
                "Add it to your Railway / Render environment variables."
            )
        _client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key
        )
    return _client

BUFFER_WINDOW_SECONDS = 4 * 60  # 4 minutes

# Rolling buffer: list of dicts with text, username, timestamp
rolling_buffer: list[dict] = []


def add_to_buffer(messages: list[dict]):
    """Add new messages to buffer and evict old ones."""
    now = int(time.time() * 1000)
    cutoff = now - (BUFFER_WINDOW_SECONDS * 1000)

    for msg in messages:
        rolling_buffer.append(msg)

    before = len(rolling_buffer)
    rolling_buffer[:] = [m for m in rolling_buffer if m.get("timestamp", 0) >= cutoff]
    evicted = before - len(rolling_buffer)

    if evicted:
        print(f"[Ranker] Evicted {evicted} old messages from buffer")


def set_buffer_context(topic: str):
    current_context["topic"] = topic
    print(f"[Ranker] Context updated → '{topic}'")


def group_and_rank() -> list[dict]:
    """
    Send buffer to LLM → filter irrelevant → group similar questions →
    rank by viewer_count then mean_timestamp.
    Returns ranked list of unique questions.
    """
    if not rolling_buffer:
        return []

    # Build input for LLM
    questions_input = "\n".join(
        [f"{i}: {m['text']}" for i, m in enumerate(rolling_buffer)]
    )

    topic_line = f"Current lecture topic: {current_context['topic']}\n\n" if current_context['topic'] else ""

    prompt = f"""You are helping rank live class questions for an online educator.

{topic_line}Here are questions from the live chat (index: question):
{questions_input}

First remove any questions irrelevant to the topic (if topic is set).
Then group semantically similar questions together.
For each group, pick the clearest version as the canonical question.

Respond ONLY with a JSON array, no explanation, no markdown, like this:
[
  {{
    "canonical": "clearest version of the question",
    "indices": [0, 3, 7]
  }}
]"""

    try:
        response = get_client().chat.completions.create(
            model="google/gemma-3-27b-it:free",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        groups = json.loads(raw)

    except Exception as e:
        print(f"[Ranker] LLM grouping failed: {e} — returning ungrouped")
        # Fallback: treat each message as its own group
        groups = [
            {"canonical": m["text"], "indices": [i]}
            for i, m in enumerate(rolling_buffer)
        ]

    # ─── Build ranked list ────────────────────────────────────────────────────
    ranked = []
    for group in groups:
        indices = group.get("indices", [])
        members = [rolling_buffer[i] for i in indices if i < len(rolling_buffer)]

        if not members:
            continue

        viewer_count = len(members)
        mean_timestamp = int(sum(m.get("timestamp", 0) for m in members) / viewer_count)

        ranked.append({
            "canonical": group["canonical"],
            "viewer_count": viewer_count,
            "mean_timestamp": mean_timestamp,
            "contributors": [m["username"] for m in members]
        })

    # ─── Sort: viewer_count DESC, tiebreak mean_timestamp DESC ───────────────
    ranked.sort(key=lambda x: (x["viewer_count"], x["mean_timestamp"]), reverse=True)

    print(f"[Ranker] {len(rolling_buffer)} buffered → {len(ranked)} unique ranked questions")
    return ranked
