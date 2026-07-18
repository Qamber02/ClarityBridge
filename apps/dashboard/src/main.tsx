import React from "react";
import ReactDOM from "react-dom/client";
import { RefreshCcw } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./styles.css";

type Session = {
  session_id: string;
  mode: "general" | "interview" | "sales";
  metrics: {
    average_wpm: number;
    pace_variance: number;
    filler_word_count: number;
    filler_breakdown: Record<string, number>;
    wpm_series: { time: number; wpm: number }[];
  };
  report: {
    clarity_score: number;
    pace_summary: string;
    stress_pause_suggestions: string[];
    filler_word_feedback: string;
    mode_specific_tip: string;
  };
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function App() {
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const selected = sessions.find((session) => session.session_id === selectedId) ?? sessions[0];

  async function loadSessions() {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/sessions`);
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as Session[];
      setSessions(data);
      setSelectedId((current) => current ?? data[0]?.session_id ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load sessions");
    }
  }

  React.useEffect(() => {
    void loadSessions();
  }, []);

  return (
    <main className="dashboard-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">ClarityBridge</p>
          <h1>Confidence Coach</h1>
        </div>
        <button onClick={loadSessions} aria-label="Refresh sessions">
          <RefreshCcw size={18} />
          Refresh
        </button>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <div className="layout">
        <aside className="session-list">
          {sessions.length === 0 ? <p>No reports yet. Submit a session from the Zoom panel.</p> : null}
          {sessions.map((session) => (
            <button
              key={session.session_id}
              className={session.session_id === selected?.session_id ? "session active" : "session"}
              onClick={() => setSelectedId(session.session_id)}
            >
              <span>{session.mode}</span>
              <strong>{session.report.clarity_score}</strong>
            </button>
          ))}
        </aside>

        {selected ? (
          <section className="report-view">
            <div className="score-band">
              <div>
                <span>Score</span>
                <strong>{selected.report.clarity_score}</strong>
              </div>
              <p>{selected.report.pace_summary}</p>
            </div>

            <section className="chart-panel">
              <h2>WPM Over Time</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={selected.metrics.wpm_series}>
                  <XAxis dataKey="time" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="wpm" stroke="#2f744a" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </section>

            <section className="insights">
              <div>
                <h2>Metrics</h2>
                <p>Average pace: {selected.metrics.average_wpm} WPM</p>
                <p>Pace variance: {selected.metrics.pace_variance}</p>
                <p>Fillers: {selected.metrics.filler_word_count}</p>
              </div>
              <div>
                <h2>Coach</h2>
                <p>{selected.report.filler_word_feedback}</p>
                <p>{selected.report.mode_specific_tip}</p>
              </div>
            </section>

            <section className="suggestions">
              <h2>Suggestions</h2>
              {selected.report.stress_pause_suggestions.map((suggestion) => (
                <p key={suggestion}>{suggestion}</p>
              ))}
            </section>
          </section>
        ) : null}
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
