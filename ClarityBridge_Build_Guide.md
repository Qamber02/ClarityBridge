# ClarityBridge — Complete Build Guide (Zoom Real-Time Edition)

**Course:** ACT AI Final Course Project
**Deadline:** Monday, 27 July 2026, 11:59 PM PKT
**Author:** Qamber

---

## 1. One-Line Pitch

Help people be understood faster in Zoom calls — without changing their accent. ClarityBridge lives in the Zoom meeting sidebar, tracks your speaking pace and filler words live using Zoom's own transcript stream, and gives you a full clarity report after the call.

---

## 2. What You're Actually Building

Two pieces, both realistic in 9 days:

1. **Zoom App (sidebar panel)** — runs inside an active Zoom meeting, shows a live pace meter (green/yellow/red) and filler-word counter, built on Zoom's real-time transcript/caption stream. No audio DSP, no virtual mic, no custom model.
2. **Post-call Confidence Coach** — after the meeting, pulls the transcript (or Cloud Recording), runs it through Whisper (backup path) + an LLM, and generates a clarity score + specific coaching tips. This is your web dashboard, deployed publicly.

Why this works for grading: it's a genuine live-in-Zoom demo (impressive, memorable) backed by a deployed public web app (satisfies the "deployed live at a public URL" requirement, since Zoom Apps alone don't count as that).

---

## 3. Architecture

```
Zoom Meeting
   │
   ├─ Zoom Apps SDK (sidebar iframe)
   │     └─ Real-time caption/transcript events
   │           └─ Rolling WPM calculator (JS, client-side)
   │                 └─ Live pace meter UI (green/yellow/red)
   │                 └─ Filler word flagger (regex on live transcript)
   │
   └─ On meeting end → transcript log sent to backend
         │
         └─ FastAPI backend
               ├─ Whisper (fallback transcription if needed)
               ├─ LLM call (clarity scoring, stress/pause suggestions)
               └─ Stores report → Supabase
                     │
                     └─ React dashboard (Cloudflare Pages)
                           displays Confidence Coach report
```

---

## 4. Tech Stack

| Layer | Tool |
|---|---|
| Zoom sidebar panel | Zoom Apps SDK, vanilla JS or React |
| Dashboard frontend | React + TypeScript, Cloudflare Pages |
| Backend | FastAPI (Python) |
| Transcription fallback | OpenAI Whisper API or local whisper.cpp |
| Coaching analysis | Any LLM API (Claude/GPT) via structured JSON prompt |
| Database | Supabase (auth + reports table) |
| Auth | Zoom OAuth (for account connect) + Supabase auth for dashboard |

---

## 5. Day-by-Day Plan (9 Days)

**Day 1 — Zoom App registration + skeleton**
- Register a Zoom App at marketplace.zoom.us (free, instant)
- Set up a basic Zoom Apps SDK sidebar panel that loads inside a test meeting
- Confirm you can receive live transcript/caption events via the SDK

**Day 2 — Live pace meter**
- Build rolling WPM calculator from transcript timestamps (words / time window)
- Color-coded UI: green (normal pace), yellow (fast), red (too fast for room)
- Test live in an actual Zoom call with a teammate or second device

**Day 3 — Filler word + pause flagging (live)**
- Regex/keyword match for common filler words ("um", "like", "you know", "so")
- Live counter in sidebar
- Store the running transcript + timestamps in memory for the session

**Day 4 — Backend + Confidence Coach pipeline**
- FastAPI endpoint: receive end-of-meeting transcript
- LLM prompt: generate clarity score, pace summary, stress/pause suggestions, filler word breakdown (see Section 7 prompt below)
- Return structured JSON report

**Day 5 — Dashboard frontend**
- React dashboard: list of past sessions, click into a report
- Display clarity score, WPM graph over time, filler word list, suggestions
- Wire up to FastAPI backend

**Day 6 — Supabase integration**
- Auth (simple email or Zoom OAuth passthrough)
- Store reports per user
- Connect dashboard to real data instead of mock data

**Day 7 — Polish + Industry Modes**
- Add 2 modes (Interview Mode, Sales/Support Mode) — just different LLM prompt templates for coaching tone
- Fix UI bugs, responsive check

**Day 8 — Deploy everything**
- Frontend → Cloudflare Pages
- Backend → wherever you usually host FastAPI (Render/Fly/Azure, whatever you used for Cherág/Unhire)
- Test full flow end-to-end: join Zoom call with app → live pace meter works → end call → report appears on dashboard

**Day 9 — README + demo recording + buffer**
- Write full README (Section 8 below)
- Record a 2-3 min demo video showing live Zoom sidebar + dashboard report
- Buffer time for last bugs

---

## 6. Zoom Setup Steps (Do This First, Day 1)

1. Go to `marketplace.zoom.us` → Sign in → **Develop** → **Build App**
2. Choose **Zoom Apps** (not Meeting SDK — Zoom Apps is the sidebar-panel type you want)
3. Fill in basic info, set redirect URL to your dev/deployed frontend URL
4. Under **Features**, enable:
   - In-Client App features
   - Access to meeting transcript/caption APIs (check Zoom's current scope name for this — search their docs, scope naming changes)
5. Get your Client ID and Client Secret, store in `.env`, never commit them
6. Install the app on your own test account to start developing against a real meeting

Note: Zoom's exact API/scope names for live captions shift over time — check Zoom's current Apps SDK docs when you get there rather than trusting any specific scope name here.

---

## 7. Claude Code Prompts — Copy These Directly

Use these as your actual prompts to Claude Code for each piece. Feed them one at a time, in order, to your agents.

### Prompt 1 — Zoom App Skeleton
```
Set up a Zoom Apps SDK sidebar panel project. Use vanilla JS + the Zoom Apps SDK
(@zoom/appssdk). Create a minimal panel that:
1. Initializes the SDK inside a Zoom meeting
2. Subscribes to real-time meeting transcript/caption events
3. Logs each transcript segment with its timestamp to the console
Structure the project so it can be served locally for Zoom App testing, with
a config file for Client ID/Secret loaded from .env. Explain any Zoom scopes
I need to enable in the marketplace dashboard for this to work.
```

### Prompt 2 — Live Pace Meter
```
Add a rolling words-per-minute calculator to the Zoom App panel. Use a sliding
10-second window over incoming transcript segments to compute live WPM.
Render a color-coded meter component:
- green: 100-160 WPM
- yellow: 161-200 WPM
- red: 200+ WPM
Update it in real time as new transcript segments arrive. Keep the UI minimal
and readable inside a narrow sidebar panel.
```

### Prompt 3 — Filler Word Flagger
```
Add a filler word counter to the same panel. Match common filler words/phrases
(um, uh, like, you know, so, actually, basically) against each incoming
transcript segment, case-insensitive. Show a running count in the sidebar UI,
and keep a full session log of transcript segments with timestamps in memory
so it can be sent to the backend when the meeting ends.
```

### Prompt 4 — FastAPI Confidence Coach Backend
```
Build a FastAPI backend with one main endpoint POST /analyze-session that
accepts a JSON payload: { transcript_segments: [{text, start_time, end_time}],
filler_word_count: int, mode: "general" | "interview" | "sales" }.

The endpoint should:
1. Compute overall average WPM and pace variance from the segments
2. Call an LLM with a structured prompt that returns JSON containing:
   - clarity_score (0-100)
   - pace_summary (string)
   - stress_pause_suggestions (array of strings, e.g. "add a pause after
     'however' at 1:32")
   - filler_word_feedback (string)
   - mode-specific coaching tip based on the `mode` field
3. Return the combined analysis as JSON
4. Store the result in Supabase under a `sessions` table linked to the user

Include a Pydantic model for the request/response and proper error handling
for LLM call failures.
```

### Prompt 5 — React Dashboard
```
Build a React + TypeScript dashboard (Vite) with:
1. A login screen (Supabase auth, email based)
2. A sessions list page showing past ClarityBridge sessions with date and
   clarity score
3. A session detail page showing: clarity score as a large number/badge,
   a WPM-over-time line chart (use recharts), filler word count, and a list
   of coaching suggestions from the backend
4. Clean, minimal styling — this is a professional communication-coaching
   tool, not a toy app. Use a calm color palette (blues/greens), not neon.
Connect it to the FastAPI backend from Prompt 4.
```

### Prompt 6 — Industry Modes
```
Add a mode selector (General / Interview / Sales & Support) to both the Zoom
App panel and the dashboard. Pass the selected mode through to the
/analyze-session endpoint. On the backend, adjust the LLM coaching prompt
per mode:
- Interview: focus on confidence, hedging language, answer structure
- Sales & Support: focus on clarity under pressure, active listening cues,
  tone warmth
- General: current default behavior
```

---

## 8. README Template (Your Full Project Report)

```markdown
# ClarityBridge

Help people be understood faster in Zoom calls — without changing their accent.

## Problem
[2-3 sentences: non-native English speakers on international remote teams
are often misunderstood not because of accent, but because of pace, stress
patterns, and lack of pauses. Existing tools either do full accent conversion
(changes identity) or generic noise cleanup (Krisp) that doesn't address
intelligibility.]

## What ClarityBridge Does
- Live pace meter inside your Zoom sidebar during the call
- Live filler word tracking
- Post-call Confidence Coach report: clarity score, pace analysis, stress/pause
  suggestions, mode-specific coaching (Interview / Sales / General)

## Live Demo
- Dashboard: [your deployed URL]
- Zoom App: [install instructions / demo video link, since Zoom Apps aren't
  browsable via a plain URL]

## Demo Video
[link — record this, 2-3 min, show live sidebar + generated report]

## Architecture
[paste the diagram from Section 3]

## Tech Stack
[table from Section 4]

## How It Works
1. ...
2. ...

## What's Built (MVP) vs Future Vision
**Built:**
- Live Zoom sidebar pace + filler tracking
- Post-call AI coaching report
- Interview / Sales modes

**Future work (the full vision):**
- Real-time in-audio cadence reshaping (subtle pacing/pause adjustment in
  the actual voice signal, not just feedback)
- Virtual microphone integration for live delivery smoothing
- Custom-trained prosody/stress model instead of transcript-based heuristics
- Sub-40ms latency real-time DSP pipeline
- Support for Teams, Meet, Discord

## Competitive Advantage
Unlike accent-conversion tools, ClarityBridge preserves the speaker's natural
accent and identity, and focuses on pacing/clarity feedback rather than
pronunciation change.

## Setup / Run Locally
[standard instructions]

## Author
Qamber — BSCS, University of Turbat
```

---

## 9. Realistic Risk Notes (Don't Skip This)

- **Zoom's live caption/transcript API access can require account-level settings or paid plan features** — verify this on Day 1 before building around it. If it's gated, fall back to: record locally during the meeting via your OS mic (not Zoom's audio), run it through Whisper streaming instead. Same demo effect, no Zoom-side transcript dependency.
- **Zoom App review/publishing isn't required for a course demo** — you can run it in dev mode on your own account, install it locally, and demo live. No need to submit to Zoom Marketplace for approval.
- If the live sidebar proves unstable close to deadline, the fallback is: local mic recording + Whisper streaming for the "live" pace meter, still demoable as real-time, just not literally inside Zoom's data feed. Keep this as your Plan B, don't let it block the whole project.

---

## 10. Grading Alignment Checklist

- [ ] **Idea** — original, clearly scoped, "Future Work" section shows you understand the bigger vision without overclaiming
- [ ] **Completion** — live pace meter + filler tracking + Confidence Coach report all working end to end
- [ ] **Deployment** — dashboard live on Cloudflare Pages, backend live and reachable, public GitHub repo
- [ ] **Reporting** — README covers problem, architecture, tech stack, demo video, honest MVP vs future scope
