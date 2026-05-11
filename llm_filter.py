'''import os
from google import genai

API_KEY_ENV_VARS = ["GOOGLE_API_KEY", "GENAI_API_KEY", "OPENAI_API_KEY", "API_KEY"]
api_key = next((os.environ.get(name) for name in API_KEY_ENV_VARS if os.environ.get(name)), None)

if api_key:
    client = genai.Client(api_key=api_key)
else:
    client = None
    print("[LLM] Warning: Missing API key. LLM relevance checks will be skipped.")

current_context = {"topic": ""}


def set_context(topic: str):
    current_context["topic"] = topic
    print(f"[LLM] Context updated → '{topic}'")


def is_relevant(question: str) -> bool:
    if not current_context["topic"].strip():
        return True

    if client is None:
        print(f"[LLM] No API key configured; skipping relevance check for question: '{question[:60]}'")
        return True

    prompt = f"""You are helping a live online educator filter audience questions.

Current lecture topic: {current_context["topic"]}

Question from audience: "{question}"

Is this question relevant to the current topic?
Reply with only: YES or NO"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-preview-04-17",
            contents=prompt
        )
        answer = response.text.strip().upper()[:3]
        print(f"[LLM] '{question[:60]}' → {answer} (topic: {current_context['topic']})")
        return answer == "YES"

   

    except Exception as e:
        # Catch-all — network timeout, unexpected errors
        print(f"[LLM] Unexpected error: {type(e).__name__}: {e} — letting question through")
        return True'''