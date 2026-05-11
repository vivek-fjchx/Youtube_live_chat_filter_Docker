import re

# ─── Spam / noise patterns ─────────────────────────────────────────────────────

SPAM_EXACT = {
    "hi", "hello", "hey", "lol", "lmao", "haha", "hehe",
    "nice", "cool", "ok", "okay", "yes", "no", "wow",
    "gg", "oof", "bruh", "bro", "🔥", "❤️", "👍", "😂"
}

SPAM_PATTERNS = [
    r"^(.)\1{3,}$",          # repeated single char: "heyyyy", "!!!!!!"
    r"^[\W\s]+$",            # only special chars / whitespace
    r"^[\U0001F300-\U0001FFFF\s]+$",  # emoji-only messages
]

# ─── Main filter function ──────────────────────────────────────────────────────

def prefilter(messages: list[dict]) -> list[dict]:
    clean = []
    for msg in messages:
        text = msg.get("text", "").strip()

        # 1. Empty
        if not text:
            continue

        # 2. Too short (less than 4 words)
        if len(text.split()) < 4:
            continue

        # 3. Exact spam match
        if text.lower() in SPAM_EXACT:
            continue

        # 4. Regex pattern match
        if any(re.match(p, text, re.UNICODE) for p in SPAM_PATTERNS):
            continue

        clean.append(msg)

    print(f"[Prefilter] {len(messages)} in → {len(clean)} out")
    return clean