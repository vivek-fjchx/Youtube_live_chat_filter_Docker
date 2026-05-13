# YouTube Live Chat Filter

> Real-time NLP pipeline that filters YouTube live chat and delivers only genuine, unique, ranked questions to the creator via a clean dashboard.

---

## 🧱 Architecture

```
YouTube Live Chat
        ↓
Tampermonkey Script (DOM ingestion, exact dedup, 60s batching)
        ↓
FastAPI Backend (/ingest_chat)
        ↓
Prefilter Layer (rule-based noise removal)
        ↓
BERT Classifier (question vs statement)
        ↓
Semantic Deduplicator (Sentence Transformers + cosine similarity)
        ↓
4-Min Rolling Buffer + LLM Ranker (Gemma 3 27B via OpenRouter)
        ↓
Ranked Question Store
        ↓
React/TypeScript Creator Dashboard (/ranked)
```

---

## 📁 Project Structure

```
yt-chat-filter/
├── main.py              # FastAPI app — routes and pipeline orchestration
├── prefilter.py         # Rule-based noise filter
├── classifier.py        # BERT question classifier (facebook/bart-large-mnli)
├── deduplicator.py      # Sentence Transformer embeddings + cosine similarity dedup
├── ranker.py            # 4-min rolling buffer + LLM grouping + priority ranking
├── .env                 # API keys (never commit)
├── dashboard/           # React + TypeScript frontend
│   └── src/
│       └── App.tsx      # Creator dashboard UI
└── tampermonkey.js      # Browser script for YouTube chat ingestion
```

---

## ⚙️ Setup

### 1. Clone & create virtual environment
```bash
mkdir yt-chat-filter && cd yt-chat-filter
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux
```

### 2. Install dependencies
```bash
pip install fastapi uvicorn transformers torch sentence-transformers numpy openai python-dotenv
```

### 3. Configure environment variables
Create a `.env` file in the root:
```
OPENROUTER_API_KEY=your_openrouter_key_here
```
Get your free key at: **openrouter.ai**

### 4. Run the backend
```bash
uvicorn main:app --reload --port 8000
```

### 5. Run the frontend
```bash
cd dashboard
npm install
npm run dev
```
Dashboard available at: `http://localhost:5173`

### 6. Install Tampermonkey script
- Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
- Create a new script and paste contents of `tampermonkey.js`
- Open any YouTube live stream — script activates automatically

---

## 🔹 Component Details

### Tampermonkey Script
- Observes YouTube chat DOM via `MutationObserver`
- Local exact dedup via `Set`
- Batches messages every **60 seconds** → `POST /ingest_chat`

### Prefilter (`prefilter.py`)
Removes obvious noise before ML processing:
- Empty / whitespace messages
- Messages under 4 words
- Emoji-only messages
- Repeated character spam (`"heyyyy"`)
- Common noise words (`"hi"`, `"lol"`, `"🔥"`)

### BERT Classifier (`classifier.py`)
- Model: `facebook/bart-large-mnli` (zero-shot)
- Binary classification: **question vs statement**
- Confidence threshold: `0.75`
- Runs on CPU

### Semantic Deduplicator (`deduplicator.py`)
- Model: `all-MiniLM-L6-v2` (Sentence Transformers, ~80MB)
- Converts each question → embedding vector
- Cosine similarity check against all stored embeddings
- Threshold: `0.85` — above this → duplicate, discarded

### Ranker (`ranker.py`)
- Maintains a **4-minute TTL rolling buffer**
- On every batch: sends all buffered questions to **Gemma 3 27B** (via OpenRouter)
- LLM does two jobs in one call:
  1. Filters irrelevant questions based on current topic
  2. Groups semantically similar questions → picks clearest as canonical
- Ranking logic:
  - Primary: `viewer_count` DESC (how many asked the same thing)
  - Tiebreaker: `mean_timestamp` DESC (most recent wins)
- Fallback: if LLM fails → questions pass through ungrouped

---

## 🖥️ API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ingest_chat` | Receive batched messages from Tampermonkey |
| `GET` | `/ranked` | Fetch ranked unique questions |
| `POST` | `/set_context` | Update current lecture topic |
| `POST` | `/mark_answered` | Remove question from ranked list |
| `GET` | `/health` | Server health check |

---

## 🖥️ Creator Dashboard Features
- Live ranked question list (polls every 15s)
- Viewer count + timestamp per question
- Set/update lecture topic anytime mid-stream
- Mark questions as answered (removes from list instantly)

---

## 🔴 Out of Scope (MVP)
- Redis persistence (embeddings reset on server restart)
- PostgreSQL long-term storage
- WebSocket real-time push (currently polling)
- Multi-stream support
- Kafka / Spark streaming

---

## 🧠 Extension Ideas
- Redis for persistent embeddings + pub/sub push
- Apache Kafka for true real-time streaming ingestion
- PostgreSQL for session history and analytics
- "Top 5 doubts right now" clustering view
- Sentiment / hype detection

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Ingestion | Tampermonkey (JavaScript) |
| Backend | FastAPI, Python 3.13 |
| NLP | HuggingFace Transformers, Sentence-Transformers |
| LLM | Gemma 3 27B via OpenRouter API |
| Frontend | React, TypeScript, Vite |
| Environment | python-dotenv |
