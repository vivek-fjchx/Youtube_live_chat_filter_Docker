import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API = "https://youtubelivechatfilterdocker-production.up.railway.app";

interface RankedQuestion {
  canonical: string;
  viewer_count: number;
  mean_timestamp: number;
  contributors: string[];
}

export default function App() {
  const [questions, setQuestions] = useState<RankedQuestion[]>([]);
  const [answeredQuestions, setAnsweredQuestions] = useState<RankedQuestion[]>([]);
  const [topic, setTopicInput] = useState("");
  const [currentTopic, setCurrentTopic] = useState("");
  const [videoId, setVideoId] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("");
  const [pulse, setPulse] = useState(false);
  const answeredRef = useRef<HTMLDivElement>(null);

  // ── Restore tokens from localStorage on first load ───────────────────────
  const [accessToken, setAccessToken] = useState<string>(
    () => localStorage.getItem("sf_access_token") ?? ""
  );
  const [refreshToken, setRefreshToken] = useState<string>(
    () => localStorage.getItem("sf_refresh_token") ?? ""
  );

  // Persist tokens to localStorage whenever they change
  useEffect(() => {
    if (accessToken) localStorage.setItem("sf_access_token", accessToken);
    if (refreshToken) localStorage.setItem("sf_refresh_token", refreshToken);
  }, [accessToken, refreshToken]);

  // Read tokens injected by the OAuth redirect (overrides stored ones)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const at = params.get("access_token");
    const rt = params.get("refresh_token");
    const err = params.get("error");
    if (at && rt) {
      setAccessToken(at);
      setRefreshToken(rt);
      setStatus("Authenticated — enter your video ID to begin.");
      window.history.replaceState({}, "", "/");
    } else if (err) {
      setStatus(`Auth error: ${decodeURIComponent(err)}`);
      window.history.replaceState({}, "", "/");
    } else if (localStorage.getItem("sf_access_token")) {
      setStatus("Authenticated — enter your video ID to begin.");
    }
  }, []);

  // Poll ranked questions while streaming
  useEffect(() => {
    if (!streaming) return;
    const fetchQ = async () => {
      try {
        const res = await axios.get(`${API}/ranked`);
        setQuestions(res.data.questions);
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
      } catch (err) {
        console.error(err);
      }
    };
    fetchQ();
    const interval = setInterval(fetchQ, 15000);
    return () => clearInterval(interval);
  }, [streaming]);

  // ── Auth ─────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    const res = await axios.get(`${API}/auth/login`);
    window.location.href = res.data.auth_url;
  };

  // ── End session: stop streaming, return to setup card (tokens kept) ──────
  const handleEndSession = () => {
    setStreaming(false);
    setQuestions([]);
    setAnsweredQuestions([]);
    setCurrentTopic("");
    setTopicInput("");
    setVideoId("");
    setStatus("Authenticated — enter your video ID to begin.");
  };

  // ── Disconnect account: wipe tokens → show login screen ──────────────────
  const handleDisconnect = () => {
    localStorage.removeItem("sf_access_token");
    localStorage.removeItem("sf_refresh_token");
    setAccessToken("");
    setRefreshToken("");
    setStreaming(false);
    setQuestions([]);
    setAnsweredQuestions([]);
    setCurrentTopic("");
    setVideoId("");
    setStatus("");
  };

  const handleStartStream = async () => {
    if (!videoId || !accessToken) return;
    await axios.post(`${API}/start_stream`, {
      video_id: videoId,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    setStreaming(true);
    setStatus(`Live · ${videoId}`);
  };

  const handleSetTopic = async () => {
    if (!topic.trim()) return;
    await axios.post(`${API}/set_context`, { topic });
    setCurrentTopic(topic);
    setTopicInput("");
  };

  const deleteQuestion = async (canonical: string) => {
    await axios.post(`${API}/mark_answered`, { canonical });
    setQuestions((prev) => prev.filter((x) => x.canonical !== canonical));
  };

  const markAnswered = async (q: RankedQuestion) => {
    await axios.post(`${API}/mark_answered`, { canonical: q.canonical });
    setQuestions((prev) => prev.filter((x) => x.canonical !== q.canonical));
    setAnsweredQuestions((prev) => [q, ...prev]);
    setTimeout(() => {
      answeredRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #0d0f14;
          --surface: #13161e;
          --surface2: #1a1e2a;
          --border: rgba(255,255,255,0.07);
          --border-bright: rgba(255,255,255,0.13);
          --red: #ff3b3b;
          --red-dim: rgba(255,59,59,0.12);
          --green: #22c55e;
          --green-dim: rgba(34,197,94,0.1);
          --yellow: #f59e0b;
          --blue: #3b82f6;
          --text: #f0f2f7;
          --text-muted: #6b7280;
          --text-mid: #9ca3af;
          --font-serif: 'Instrument Serif', Georgia, serif;
          --font-sans: 'DM Sans', system-ui, sans-serif;
        }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-sans);
          min-height: 100vh;
          overflow-x: hidden;
        }

        /* TOPBAR */
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          height: 56px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .topbar-left { display: flex; align-items: center; gap: 14px; }
        .logo-mark {
          width: 30px; height: 30px;
          background: var(--red);
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px;
        }
        .logo-text {
          font-family: var(--font-serif);
          font-size: 17px;
          letter-spacing: -0.01em;
          color: var(--text);
        }
        .live-pill {
          display: flex; align-items: center; gap: 6px;
          background: var(--red-dim);
          border: 1px solid rgba(255,59,59,0.3);
          border-radius: 100px;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 600;
          color: var(--red);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .live-pill.visible { opacity: 1; }
        .live-dot {
          width: 6px; height: 6px;
          background: var(--red);
          border-radius: 50%;
          animation: blink 1.2s ease-in-out infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .topbar-right { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-muted); }
        .video-id-tag {
          background: var(--surface2);
          border: 1px solid var(--border-bright);
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 12px;
          color: var(--text-mid);
          font-family: monospace;
        }
        .btn-end-session {
          padding: 5px 13px;
          background: rgba(255,59,59,0.12);
          border: 1px solid rgba(255,59,59,0.35);
          border-radius: 8px;
          color: var(--red);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: var(--font-sans);
          letter-spacing: 0.02em;
          transition: background 0.15s;
        }
        .btn-end-session:hover { background: rgba(255,59,59,0.2); }

        /* TOPIC BAR */
        .topic-bar {
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          padding: 10px 28px;
          display: flex;
          align-items: center;
          gap: 14px;
          font-size: 13px;
        }
        .topic-label { color: var(--text-muted); white-space: nowrap; font-weight: 500; }
        .topic-value {
          color: var(--yellow);
          font-style: italic;
          font-family: var(--font-serif);
          font-size: 15px;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .topic-input {
          background: var(--surface2);
          border: 1px solid var(--border-bright);
          border-radius: 8px;
          padding: 7px 12px;
          font-size: 13px;
          color: var(--text);
          font-family: var(--font-sans);
          outline: none;
          width: 280px;
          transition: border-color 0.2s;
        }
        .topic-input::placeholder { color: var(--text-muted); }
        .topic-input:focus { border-color: rgba(245,158,11,0.4); }
        .btn-topic {
          padding: 7px 14px;
          background: rgba(245,158,11,0.12);
          border: 1px solid rgba(245,158,11,0.3);
          border-radius: 8px;
          color: var(--yellow);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          font-family: var(--font-sans);
          transition: background 0.2s;
          white-space: nowrap;
        }
        .btn-topic:hover { background: rgba(245,158,11,0.2); }

        /* SPLIT LAYOUT */
        .split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          height: calc(100vh - 56px - 44px);
          overflow: hidden;
        }

        .panel {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-right: 1px solid var(--border);
        }
        .panel:last-child { border-right: none; }

        .panel-header {
          padding: 16px 22px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .panel-title {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .panel-title-icon { font-size: 15px; }
        .count-badge {
          background: var(--surface2);
          border: 1px solid var(--border-bright);
          border-radius: 100px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-mid);
          min-width: 24px;
          text-align: center;
        }
        .count-badge.active {
          background: var(--red-dim);
          border-color: rgba(255,59,59,0.3);
          color: var(--red);
        }
        .count-badge.answered {
          background: var(--green-dim);
          border-color: rgba(34,197,94,0.25);
          color: var(--green);
        }

        .panel-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
          scrollbar-width: thin;
          scrollbar-color: var(--surface2) transparent;
        }

        /* QUESTION CARD */
        .qcard {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 10px;
          transition: border-color 0.2s, transform 0.15s;
          animation: slideIn 0.25s ease;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .qcard:hover { border-color: var(--border-bright); }
        .qcard.answered-card {
          border-color: rgba(34,197,94,0.15);
          opacity: 0.75;
        }
        .qcard.answered-card:hover { opacity: 1; border-color: rgba(34,197,94,0.3); }

        .card-meta {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .rank-num {
          width: 22px; height: 22px;
          background: var(--surface2);
          border: 1px solid var(--border-bright);
          border-radius: 5px;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-mid);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .rank-num.top { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.3); color: var(--blue); }

        .meta-pill {
          display: flex; align-items: center; gap: 4px;
          padding: 2px 8px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 500;
        }
        .pill-viewers { background: var(--green-dim); color: var(--green); border: 1px solid rgba(34,197,94,0.2); }
        .pill-time { background: rgba(107,114,128,0.1); color: var(--text-muted); border: 1px solid var(--border); }
        .pill-answered { background: var(--green-dim); color: var(--green); border: 1px solid rgba(34,197,94,0.25); }

        .q-text {
          font-size: 14px;
          line-height: 1.55;
          color: var(--text);
          margin-bottom: 12px;
        }
        .answered-card .q-text { color: var(--text-mid); }

        .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .contributors {
          font-size: 11.5px;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
        }
        .contributors span { color: var(--blue); }

        .btn-answer {
          flex-shrink: 0;
          padding: 5px 12px;
          background: var(--green-dim);
          border: 1px solid rgba(34,197,94,0.25);
          border-radius: 7px;
          color: var(--green);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: var(--font-sans);
          transition: background 0.15s, transform 0.1s;
          letter-spacing: 0.02em;
        }
        .btn-answer:hover { background: rgba(34,197,94,0.18); transform: scale(1.02); }
        .btn-answer:active { transform: scale(0.98); }

        .btn-delete {
          flex-shrink: 0;
          padding: 5px 8px;
          background: transparent;
          border: 1px solid rgba(255,59,59,0.2);
          border-radius: 7px;
          color: var(--red);
          font-size: 13px;
          cursor: pointer;
          font-family: var(--font-sans);
          transition: background 0.15s, transform 0.1s;
          opacity: 0.6;
          line-height: 1;
        }
        .btn-delete:active { transform: scale(0.95); }
        .btn-delete:hover { background: var(--red-dim); opacity: 1; transform: scale(1.05); }

        .empty-state {
          padding: 48px 24px;
          text-align: center;
          color: var(--text-muted);
        }
        .empty-icon { font-size: 36px; margin-bottom: 10px; opacity: 0.4; }
        .empty-text { font-size: 13px; line-height: 1.6; }

        /* PULSE */
        @keyframes pulse-border {
          0% { box-shadow: 0 0 0 0 rgba(255,59,59,0.25); }
          70% { box-shadow: 0 0 0 6px rgba(255,59,59,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,59,59,0); }
        }
        .panel.pulsing .panel-header { animation: pulse-border 0.6s ease; }

        /* SETUP SCREEN */
        .setup-screen {
          display: flex;
          align-items: center;
          justify-content: center;
          height: calc(100vh - 56px);
          padding: 24px;
        }
        .setup-card {
          background: var(--surface);
          border: 1px solid var(--border-bright);
          border-radius: 16px;
          padding: 40px 44px;
          max-width: 480px;
          width: 100%;
          text-align: center;
        }
        .setup-icon { font-size: 42px; margin-bottom: 16px; }
        .setup-title {
          font-family: var(--font-serif);
          font-size: 26px;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }
        .setup-sub { font-size: 14px; color: var(--text-muted); margin-bottom: 30px; line-height: 1.6; }
        .setup-input {
          width: 100%;
          background: var(--surface2);
          border: 1px solid var(--border-bright);
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 14px;
          color: var(--text);
          font-family: var(--font-sans);
          outline: none;
          margin-bottom: 12px;
          transition: border-color 0.2s;
        }
        .setup-input::placeholder { color: var(--text-muted); }
        .setup-input:focus { border-color: var(--red); }
        .btn-primary {
          width: 100%;
          padding: 12px;
          background: var(--red);
          border: none;
          border-radius: 10px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: var(--font-sans);
          letter-spacing: 0.02em;
          transition: opacity 0.15s, transform 0.1s;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:active { transform: scale(0.99); }
        .setup-status {
          margin-top: 14px;
          font-size: 13px;
          color: var(--green);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .btn-disconnect {
          margin-top: 12px;
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 12px;
          cursor: pointer;
          font-family: var(--font-sans);
          text-decoration: underline;
          transition: color 0.15s;
        }
        .btn-disconnect:hover { color: var(--red); }

        /* SCROLLBAR */
        .panel-scroll::-webkit-scrollbar { width: 5px; }
        .panel-scroll::-webkit-scrollbar-track { background: transparent; }
        .panel-scroll::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 10px; }
      `}</style>

      {/* TOPBAR */}
      <div className="topbar">
        <div className="topbar-left">
          <div className="logo-mark">▶</div>
          <span className="logo-text">StreamFilter</span>
          <div className={`live-pill ${streaming ? "visible" : ""}`}>
            <div className="live-dot" />
            Live
          </div>
        </div>
        <div className="topbar-right">
          {streaming && videoId && (
            <div className="video-id-tag">{videoId}</div>
          )}
          <span>{streaming ? `${questions.length} active · ${answeredQuestions.length} answered` : "Not streaming"}</span>
          {streaming && (
            <button id="btn-end-session" className="btn-end-session" onClick={handleEndSession}>
              End Session
            </button>
          )}
        </div>
      </div>

      {!streaming ? (
        <div className="setup-screen">
          <div className="setup-card">
            <div className="setup-icon">🎬</div>
            <h1 className="setup-title">Creator Dashboard</h1>
            <p className="setup-sub">
              Filter your live chat in real-time. Only genuine questions from your
              audience — ranked by viewer interest — reach you.
            </p>
            {!accessToken ? (
              <>
                <button id="btn-connect-youtube" className="btn-primary" onClick={handleLogin}>
                  Connect YouTube Account
                </button>
                {status && <div className="setup-status">{status}</div>}
              </>
            ) : (
              <>
                {status && <div className="setup-status" style={{ marginBottom: 16 }}>&#10003; {status}</div>}
                <input
                  id="input-video-id"
                  className="setup-input"
                  placeholder="YouTube Video ID (e.g. dQw4w9WgXcQ)"
                  value={videoId}
                  onChange={(e) => setVideoId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleStartStream()}
                />
                <button
                  id="btn-start-stream"
                  className="btn-primary"
                  onClick={handleStartStream}
                  disabled={!videoId}
                  style={{ opacity: videoId ? 1 : 0.45 }}
                >
                  Start Filtering Chat →
                </button>
                <button
                  id="btn-disconnect-account"
                  className="btn-disconnect"
                  onClick={handleDisconnect}
                >
                  Disconnect account
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* TOPIC BAR */}
          <div className="topic-bar">
            <span className="topic-label">Topic</span>
            <span className="topic-value">
              {currentTopic || "All questions passing through — set a topic to filter"}
            </span>
            <input
              className="topic-input"
              placeholder="e.g. friction and laws of motion"
              value={topic}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSetTopic()}
            />
            <button className="btn-topic" onClick={handleSetTopic}>
              Update
            </button>
          </div>

          {/* SPLIT PANELS */}
          <div className="split">
            {/* LEFT: Incoming questions */}
            <div className={`panel ${pulse ? "pulsing" : ""}`}>
              <div className="panel-header">
                <div className="panel-title">
                  <span className="panel-title-icon">📥</span>
                  Incoming Questions
                </div>
                <span className={`count-badge ${questions.length > 0 ? "active" : ""}`}>
                  {questions.length}
                </span>
              </div>
              <div className="panel-scroll">
                {questions.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">💬</div>
                    <p className="empty-text">
                      Waiting for questions from chat…
                      <br />Polling every 15 seconds.
                    </p>
                  </div>
                ) : (
                  questions.map((q, i) => (
                    <div key={q.canonical} className="qcard">
                      <div className="card-meta">
                        <div className={`rank-num ${i === 0 ? "top" : ""}`}>
                          {i + 1}
                        </div>
                        <div className="meta-pill pill-viewers">
                          👥 {q.viewer_count} {q.viewer_count === 1 ? "viewer" : "viewers"}
                        </div>
                        <div className="meta-pill pill-time">
                          {formatTime(q.mean_timestamp)}
                        </div>
                      </div>
                      <p className="q-text">{q.canonical}</p>
                      <div className="card-footer">
                        <span className="contributors">
                          <span>
                            {q.contributors
                              .slice(0, 3)
                              .map((c) => `@${c}`)
                              .join(", ")}
                          </span>
                          {q.contributors.length > 3 &&
                            ` +${q.contributors.length - 3} more`}
                        </span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn-delete"
                            onClick={() => deleteQuestion(q.canonical)}
                            title="Delete question"
                          >
                            🗑
                          </button>
                          <button
                            className="btn-answer"
                            onClick={() => markAnswered(q)}
                          >
                            Mark Answered ✓
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT: Answered questions */}
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <span className="panel-title-icon">✅</span>
                  Answered
                </div>
                <span className={`count-badge ${answeredQuestions.length > 0 ? "answered" : ""}`}>
                  {answeredQuestions.length}
                </span>
              </div>
              <div className="panel-scroll" ref={answeredRef}>
                {answeredQuestions.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🎯</div>
                    <p className="empty-text">
                      Questions you've addressed will appear here.
                    </p>
                  </div>
                ) : (
                  answeredQuestions.map((q, i) => (
                    <div key={`${q.canonical}-${i}`} className="qcard answered-card">
                      <div className="card-meta">
                        <div className="meta-pill pill-answered">✓ Answered</div>
                        <div className="meta-pill pill-time">
                          {formatTime(q.mean_timestamp)}
                        </div>
                        <div className="meta-pill pill-viewers">
                          👥 {q.viewer_count}
                        </div>
                      </div>
                      <p className="q-text">{q.canonical}</p>
                      <div className="card-footer">
                        <span className="contributors">
                          <span>
                            {q.contributors
                              .slice(0, 3)
                              .map((c) => `@${c}`)
                              .join(", ")}
                          </span>
                          {q.contributors.length > 3 &&
                            ` +${q.contributors.length - 3} more`}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
