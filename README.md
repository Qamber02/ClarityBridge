# ClarityBridge

ClarityBridge helps speakers improve intelligibility in live calls without changing their accent. The current MVP includes a live sidebar-style panel, a FastAPI analysis backend, and a report dashboard.

## Project Shape

- `backend/` contains the FastAPI API and clarity analysis logic.
- `apps/zoom-panel/` contains the Zoom sidebar-style live pace and filler tracker.
- `apps/dashboard/` contains the post-call Confidence Coach dashboard.
- `IMPLEMENTATION_PLAN.md` captures the reviewed plan and Zoom transcript access correction.

## Local Setup

Backend:

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
npm install
npm run dev:zoom
npm run dev:dashboard
```

Default local URLs:

- Backend API: `http://localhost:8000`
- Dashboard: `http://localhost:5173`
- Zoom panel: `http://localhost:5174`

## Demo Flow

1. Start the backend.
2. Start the Zoom panel.
3. Use browser speech recognition or manually add transcript lines.
4. Click `Analyze`.
5. Open the dashboard and click `Refresh`.

## Zoom Integration Note

The reviewed plan keeps the Zoom sidebar as the meeting UI. For real Zoom transcript data, current Zoom documentation points to Realtime Media Streams (RTMS), which may require Developer Pack credits. The implemented MVP uses normalized transcript segments, so an RTMS adapter can be added without rewriting the analysis backend or dashboard.
