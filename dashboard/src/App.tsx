import { useState, useEffect } from "react";
import axios from "axios";

const API = "http://localhost:8000";

interface RankedQuestion {
  canonical: string;
  viewer_count: number;
  mean_timestamp: number;
  contributors: string[];
}

export default function App() {
  const [questions, setQuestions] = useState<RankedQuestion[]>([]);
  const [topic, setTopic] = useState("");
  const [topicInput, setTopicInput] = useState("");

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await axios.get(`${API}/ranked`);
        setQuestions(res.data.questions);
      } catch (err) {
        console.error("Failed to fetch questions", err);
      }
    };

    fetchQuestions();
    const interval = setInterval(fetchQuestions, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSetTopic = async () => {
    if (!topicInput.trim()) return;
    await axios.post(`${API}/set_context`, { topic: topicInput });
    setTopic(topicInput);
    setTopicInput("");
  };

  const markAnswered = async (canonical: string) => {
    await axios.post(`${API}/mark_answered`, { canonical });
    setQuestions((prev) => prev.filter((q) => q.canonical !== canonical));
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🎯 Creator Dashboard</h1>
        <p style={styles.subtitle}>Live question filter — only genuine doubts reach you</p>
      </div>

      <div style={styles.topicBox}>
        <p style={styles.label}>
          Current Topic: <strong>{topic || "Not set — all questions passing through"}</strong>
        </p>
        <div style={styles.row}>
          <input
            style={styles.input}
            placeholder="e.g. friction and laws of motion"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSetTopic()}
          />
          <button style={styles.button} onClick={handleSetTopic}>
            Update Topic
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>📥 Ranked Questions ({questions.length})</h2>
        {questions.length === 0 && (
          <p style={styles.empty}>No questions yet — waiting for next batch...</p>
        )}
        {questions.map((q, i) => (
          <div key={i} style={styles.card}>
            {/* Rank badge */}
            <div style={styles.rankRow}>
              <span style={styles.rankBadge}>#{i + 1}</span>
              <span style={styles.viewerBadge}>👥 {q.viewer_count} viewer{q.viewer_count > 1 ? "s" : ""}</span>
              <span style={styles.timeBadge}>🕐 {formatTime(q.mean_timestamp)}</span>
            </div>

            <p style={styles.questionText}>{q.canonical}</p>

            <div style={styles.cardFooter}>
              <span style={styles.contributors}>
                Asked by: {q.contributors.slice(0, 3).map(c => `@${c}`).join(", ")}
                {q.contributors.length > 3 && ` +${q.contributors.length - 3} more`}
              </span>
              <button
                style={styles.answerBtn}
                onClick={() => markAnswered(q.canonical)}
              >
                ✅ Mark Answered
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 800, margin: "0 auto", padding: 24, fontFamily: "sans-serif" },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, margin: 0 },
  subtitle: { color: "#666", marginTop: 4 },
  topicBox: { background: "#f5f5f5", borderRadius: 8, padding: 16, marginBottom: 24 },
  label: { margin: "0 0 10px 0" },
  row: { display: "flex", gap: 8 },
  input: { flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14 },
  button: { padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 600, marginBottom: 12 },
  empty: { color: "#999", fontStyle: "italic" },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  rankRow: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 },
  rankBadge: { background: "#2563eb", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700 },
  viewerBadge: { background: "#f0fdf4", color: "#16a34a", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 600 },
  timeBadge: { background: "#fefce8", color: "#ca8a04", borderRadius: 4, padding: "2px 8px", fontSize: 12 },
  questionText: { margin: "0 0 10px 0", fontSize: 15, lineHeight: 1.5 },
  cardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  contributors: { color: "#888", fontSize: 12 },
  answerBtn: { padding: "6px 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 },
};