# from sentence_transformers import SentenceTransformer
# import numpy as np
# 
# print("[Deduplicator] Loading embedding model...")
# 
# model = None
# 
# def get_model():
#     global model
#     if model is None:
#         print("[Deduplicator] Loading model lazily...")
#         from sentence_transformers import SentenceTransformer
#         model = SentenceTransformer("all-MiniLM-L6-v2")
#     return model
#   # lightweight, ~80MB
# print("[Deduplicator] Model ready [OK]")
# 
# # In-memory store of embeddings for seen questions
# stored_embeddings = []
# SIMILARITY_THRESHOLD = 0.85
# 
# 
# def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
#     return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
# 
# 
# def is_duplicate(text: str) -> bool:
#     """
#     Returns True if text is semantically similar to any already stored question.
#     If not duplicate, stores its embedding for future checks.
#     """
#     embedding = get_model().encode(text, convert_to_numpy=True)
# 
#     for stored in stored_embeddings:
#         score = cosine_similarity(embedding, stored)
#         if score >= SIMILARITY_THRESHOLD:
#             print(f"[Deduplicator] Duplicate detected (score={score:.2f}): '{text[:60]}'")
#             return True
# 
#     # Not a duplicate — store it
#     stored_embeddings.append(embedding)
#     return False

def is_duplicate(text: str) -> bool:
    """
    Stub implementation. Similarity check is disabled to allow 
    ranker.py's LLM to handle grouping and popularity ranking.
    """
    return False