from optimum.onnxruntime import ORTModelForSequenceClassification
from transformers import AutoTokenizer, pipeline
from optimum.onnxruntime.configuration import AutoQuantizationConfig
from optimum.onnxruntime import ORTQuantizer
import os

MODEL_NAME = "facebook/bart-large-mnli"
QUANTIZED_PATH = "./quantized_classifier"

def load_or_quantize():
    if os.path.exists(QUANTIZED_PATH):
        print("[Classifier] Loading quantized model from cache...")
        model = ORTModelForSequenceClassification.from_pretrained(QUANTIZED_PATH)
        tokenizer = AutoTokenizer.from_pretrained(QUANTIZED_PATH)
    else:
        print("[Classifier] Exporting and quantizing model to INT8 (first run only)...")

        # Export to ONNX first
        model = ORTModelForSequenceClassification.from_pretrained(
            MODEL_NAME,
            export=True
        )
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

        # Quantize to INT8
        quantizer = ORTQuantizer.from_pretrained(model)
        qconfig = AutoQuantizationConfig.avx512_vnni(is_static=False, per_channel=False)
        quantizer.quantize(
            save_dir=QUANTIZED_PATH,
            quantization_config=qconfig
        )

        # Reload quantized
        model = ORTModelForSequenceClassification.from_pretrained(QUANTIZED_PATH)
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        tokenizer.save_pretrained(QUANTIZED_PATH)

        print("[Classifier] Quantization complete ✅")

    return pipeline(
        "zero-shot-classification",
        model=model,
        tokenizer=tokenizer
    )


print("[Classifier] Loading model...")
classifier = load_or_quantize()
print("[Classifier] Model ready ✅")


def is_question(text: str, threshold: float = 0.75) -> bool:
    result = classifier(text, candidate_labels=["question", "statement"])
    top_label = result["labels"][0]
    top_score = result["scores"][0]

    print(f"[Classifier] '{text[:60]}' → {top_label} ({top_score:.2f})")
    return top_label == "question" and top_score >= threshold
