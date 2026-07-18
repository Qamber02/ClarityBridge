import React from "react";
import ReactDOM from "react-dom/client";
import { Radio, Mic, PauseCircle, Send, SquarePlus } from "lucide-react";
import { configureZoomApp, getRtmsSessions, onMeetingEnded, onRtmsStatusChange, startRtms, stopRtms, type RtmsSession, type ZoomRuntime } from "./zoomSdk";
import "./styles.css";

type Mode = "general" | "interview" | "sales";

type TranscriptSegment = {
  text: string;
  start_time: number;
  end_time: number;
  speaker?: string;
};

type AnalysisResponse = {
  session_id: string;
  metrics: {
    average_wpm: number;
    pace_variance: number;
    filler_word_count: number;
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

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type SpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const fillerPattern = /\b(um+|uh+|like|you know|so|actually|basically)\b/gi;

function wordCount(text: string) {
  return text.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g)?.length ?? 0;
}

function App() {
  const [segments, setSegments] = React.useState<TranscriptSegment[]>([]);
  const [mode, setMode] = React.useState<Mode>("general");
  const [manualText, setManualText] = React.useState("");
  const [startedAt, setStartedAt] = React.useState<number | null>(null);
  const [isListening, setIsListening] = React.useState(false);
  const [report, setReport] = React.useState<AnalysisResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [zoomRuntime, setZoomRuntime] = React.useState<ZoomRuntime | null>(null);
  const [rtmsSessions, setRtmsSessions] = React.useState<RtmsSession[]>([]);
  const [rtmsBusy, setRtmsBusy] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognition | null>(null);
  const segmentsRef = React.useRef<TranscriptSegment[]>([]);
  const fillerCountRef = React.useRef(0);
  const modeRef = React.useRef<Mode>("general");

  const elapsedSeconds = React.useMemo(() => {
    if (segments.length === 0) return 0;
    return Math.max(...segments.map((segment) => segment.end_time));
  }, [segments]);
  const totalWords = React.useMemo(() => segments.reduce((total, segment) => total + wordCount(segment.text), 0), [segments]);
  const liveWpm = elapsedSeconds > 0 ? Math.round((totalWords / elapsedSeconds) * 60) : 0;
  const fillerCount = React.useMemo(() => segments.reduce((total, segment) => total + (segment.text.match(fillerPattern)?.length ?? 0), 0), [segments]);
  const paceState = liveWpm <= 160 ? "steady" : liveWpm <= 200 ? "fast" : "rushed";
  const rtmsSupported = zoomRuntime?.supportedApis.includes("startRTMS") && zoomRuntime.supportedApis.includes("getRTMSStatus");
  const latestRtmsStatus = rtmsSessions[rtmsSessions.length - 1]?.status ?? "stopped";

  React.useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  React.useEffect(() => {
    fillerCountRef.current = fillerCount;
  }, [fillerCount]);

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  React.useEffect(() => {
    let mounted = true;

    async function bootZoom() {
      const runtime = await configureZoomApp();
      if (!mounted) return;
      setZoomRuntime(runtime);

      if (runtime.configured) {
        onRtmsStatusChange((event) => setRtmsSessions((current) => [...current, event]));
        onMeetingEnded(() => {
          if (segmentsRef.current.length > 0) {
            void submitAnalysis(segmentsRef.current, fillerCountRef.current, modeRef.current);
          }
        });
        if (runtime.supportedApis.includes("getRTMSStatus")) {
          const sessions = await getRtmsSessions().catch(() => []);
          if (mounted) setRtmsSessions(sessions);
        }
      }
    }

    void bootZoom();

    return () => {
      mounted = false;
    };
  }, []);

  function appendSegment(text: string) {
    const cleanText = text.trim();
    if (!cleanText) return;
    const start = startedAt ?? Date.now();
    setStartedAt(start);
    const endTime = Math.max(1, (Date.now() - start) / 1000);
    const duration = Math.max(1.2, wordCount(cleanText) / 2.4);
    setSegments((current) => [
      ...current,
      {
        text: cleanText,
        start_time: Math.max(0, endTime - duration),
        end_time: endTime,
        speaker: "You",
      },
    ]);
  }

  function addManualSegment() {
    appendSegment(manualText);
    setManualText("");
  }

  function toggleListening() {
    setError(null);
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Browser speech recognition is unavailable. Add transcript text manually for the demo flow.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) appendSegment(result[0].transcript);
      }
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  async function submitAnalysis(transcriptSegments: TranscriptSegment[], submittedFillerCount: number, selectedMode: Mode) {
    setError(null);
    setReport(null);
    try {
      const response = await fetch(`${API_BASE_URL}/analyze-session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript_segments: transcriptSegments,
          filler_word_count: submittedFillerCount,
          mode: selectedMode,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      setReport(await response.json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Analysis failed");
    }
  }

  async function analyze() {
    await submitAnalysis(segments, fillerCount, mode);
  }

  async function toggleRtms() {
    setError(null);
    setRtmsBusy(true);
    try {
      if (latestRtmsStatus === "started" || latestRtmsStatus === "resumed" || latestRtmsStatus === "connecting") {
        await stopRtms();
      } else {
        await startRtms();
      }
      const sessions = await getRtmsSessions().catch(() => []);
      setRtmsSessions(sessions);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "RTMS action failed. Check Zoom RTMS scopes and account settings.");
    } finally {
      setRtmsBusy(false);
    }
  }

  return (
    <main className="panel-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ClarityBridge</p>
          <h1>Live Pace</h1>
        </div>
        <select value={mode} onChange={(event) => setMode(event.target.value as Mode)} aria-label="Mode">
          <option value="general">General</option>
          <option value="interview">Interview</option>
          <option value="sales">Sales</option>
        </select>
      </header>

      <section className={`meter ${paceState}`}>
        <span>{liveWpm}</span>
        <small>WPM</small>
      </section>

      <section className="stats">
        <div>
          <span>{fillerCount}</span>
          <small>fillers</small>
        </div>
        <div>
          <span>{segments.length}</span>
          <small>segments</small>
        </div>
      </section>

      <section className="controls">
        <button onClick={toggleRtms} disabled={!rtmsSupported || rtmsBusy}>
          <Radio size={18} />
          {latestRtmsStatus === "started" || latestRtmsStatus === "resumed" || latestRtmsStatus === "connecting" ? "Stop RTMS" : "Start RTMS"}
        </button>
        <button onClick={toggleListening} className="primary">
          {isListening ? <PauseCircle size={18} /> : <Mic size={18} />}
          {isListening ? "Stop" : "Listen"}
        </button>
        <button onClick={analyze} disabled={segments.length === 0}>
          <Send size={18} />
          Analyze
        </button>
      </section>

      <section className="zoom-status">
        <strong>{zoomRuntime?.configured ? "Zoom connected" : "Browser fallback"}</strong>
        <span>{zoomRuntime?.configured ? `${zoomRuntime.runningContext} · RTMS ${latestRtmsStatus}` : zoomRuntime?.error ?? "Checking Zoom context..."}</span>
      </section>

      <section className="manual-entry">
        <textarea value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder="Paste or type a transcript line" />
        <button onClick={addManualSegment} disabled={!manualText.trim()}>
          <SquarePlus size={18} />
          Add
        </button>
      </section>

      {error ? <p className="error">{error}</p> : null}

      <section className="transcript">
        {segments.slice(-5).map((segment, index) => (
          <p key={`${segment.end_time}-${index}`}>{segment.text}</p>
        ))}
      </section>

      {report ? (
        <section className="report">
          <strong>{report.report.clarity_score}</strong>
          <span>{report.report.pace_summary}</span>
          <p>{report.report.mode_specific_tip}</p>
        </section>
      ) : null}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
