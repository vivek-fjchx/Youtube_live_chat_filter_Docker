from transformers import pipeline

print("[Classifier] Loading model...")
classifier = pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli"
)
print("[Classifier] Model ready ✅")


def is_question(text: str, threshold: float = 0.75) -> bool:
    result = classifier(text, candidate_labels=["question", "statement"])
    top_label = result["labels"][0]
    top_score = result["scores"][0]

    print(f"[Classifier] '{text[:60]}' → {top_label} ({top_score:.2f})")
    return top_label == "question" and top_score >= threshold