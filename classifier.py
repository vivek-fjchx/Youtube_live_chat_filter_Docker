from transformers import pipeline

MODEL_NAME = "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli"

classifier = None

def get_classifier():
    global classifier
    if classifier is None:
        print("[Classifier] Loading model lazily...")
        classifier = pipeline(
            "zero-shot-classification",
            model=MODEL_NAME
        )
        print("[Classifier] Model ready [OK]")
    return classifier


def is_question(text: str, threshold: float = 0.75) -> bool:
    clf = get_classifier()
    result = clf(text, candidate_labels=["question", "statement"])

    top_label = result["labels"][0]
    top_score = result["scores"][0]

    print(f"[Classifier] '{text[:60]}' → {top_label} ({top_score:.2f})")
    return top_label == "question" and top_score >= threshold