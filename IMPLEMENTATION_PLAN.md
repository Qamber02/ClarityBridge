# ClarityBridge Implementation Plan

## Review Notes

The original plan is directionally strong for the course demo: it has a clear MVP, a memorable live Zoom surface, and a deployable dashboard. The main risk is the assumption that a Zoom Apps sidebar can directly consume real-time transcript events. Current Zoom documentation routes live audio/video/transcript data through Realtime Media Streams (RTMS), which requires Zoom Developer Pack credits. Zoom meeting transcripts also require host/admin enablement and are not always available by default.

Sources checked:
- Zoom RTMS overview: https://godevelopers.zoom.us/docs/rtms/meetings/
- Zoom Apps data access: https://developers.zoom.us/docs/zoom-apps/data-access/
- Zoom transcript support requirements: https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0085675

## Improved Execution Plan

1. Build the analysis backend around normalized transcript segments first.
2. Build the Zoom sidebar UI as a transcript-source adapter, not as the source of truth.
3. Use browser speech recognition as the Day-1 live demo fallback.
4. Add Zoom RTMS later only if the account has Developer Pack credits and transcript scopes enabled.
5. Keep Supabase persistence optional during local development so analysis and demo flow are not blocked by credentials.

## Current MVP Scope

- `backend/`: FastAPI analysis API with WPM, filler counts, coaching suggestions, optional persistence hook.
- `apps/zoom-panel/`: Zoom-sidebar-style React app with live transcript capture fallback and end-of-session analysis.
- `apps/dashboard/`: React dashboard for session list and report detail views.

## Validation Plan

- Run backend compile checks and focused unit tests for analysis metrics.
- Run TypeScript checks and production builds after dependencies are installed.
- Verify the live flow locally: start backend, start sidebar panel, capture or add transcript text, submit session, open dashboard report.

## Deferred Work

- RTMS app registration and webhook/stream worker.
- Supabase auth and durable report reads.
- Cloudflare Pages and backend deployment wiring.
- Demo recording and final README polish.
