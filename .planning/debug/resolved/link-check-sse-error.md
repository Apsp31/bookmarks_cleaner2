---
status: resolved
trigger: "Clicking 'Check Links' triggers 'Link check failed. Please try again' — the EventSource error event fires instead of progress/done events."
created: 2026-03-23T00:00:00Z
updated: 2026-03-23T00:15:00Z
---

## Current Focus

hypothesis: CONFIRMED — stale server process running before check.js was created
test: Killed old server (PID 57971, started 21:39), started fresh, SSE works end-to-end
expecting: User confirms the fix works by restarting the server
next_action: User restarts server with `npm run dev` or `node server.js`

## Symptoms

expected: Progress bar appears, counter increments, eventually done event fires with dead link count
actual: "Link check failed. Please try again" error message shown immediately (or shortly after clicking Check Links)
errors: Browser shows "Link check failed. Please try again" (set in es.addEventListener('error', ...) handler in public/app.js)
reproduction: Upload bookmarks file → Run Cleanup → click "Check Links"
started: Just implemented in phase 03 plan 02 — never worked

## Eliminated

- hypothesis: Import errors in linkChecker.js (p-limit ESM, cheerio)
  evidence: `node --input-type=module` import test succeeds cleanly for both linkChecker.js and check.js
  timestamp: 2026-03-23T00:05:00Z

- hypothesis: Route registration bug in check.js or server.js
  evidence: Router inspection shows both /check-links and /check-result registered; minimal Express setup returns 400 (correct) not 404
  timestamp: 2026-03-23T00:08:00Z

- hypothesis: Middleware ordering issue (static file server, express.json intercepting)
  evidence: /api/export GET route works fine; the issue is specific to the running server instance, not routing logic
  timestamp: 2026-03-23T00:10:00Z

- hypothesis: SSE protocol bug (missing flushHeaders, wrong event format)
  evidence: End-to-end test after server restart shows correct SSE stream with progress + done events
  timestamp: 2026-03-23T00:14:00Z

## Evidence

- timestamp: 2026-03-23T00:03:00Z
  checked: Both GET endpoints in check.js on running server (port 3000)
  found: Both /api/check-links and /api/check-result return 404; POST endpoints (cleanup, merge, upload) return 200/400
  implication: Routes are not registered in the running server — stale process suspected

- timestamp: 2026-03-23T00:04:00Z
  checked: Import of linkChecker.js and check.js
  found: Both import cleanly with no errors
  implication: Not an import/ESM issue

- timestamp: 2026-03-23T00:07:00Z
  checked: check.js router in isolation (port 3002)
  found: GET /api/check-links returns 400 (correct: no session) — route IS registered and functional
  implication: Problem is in the running server instance, not the code

- timestamp: 2026-03-23T00:09:00Z
  checked: What process is listening on port 3000
  found: PID 57971, started at 21:39 — a stale server started before check.js was created. When we launch `node server.js` in tests, port 3000 is already bound so curl hits the OLD server.
  implication: This is the root cause. The old server has no checkRouter.

- timestamp: 2026-03-23T00:13:00Z
  checked: Full SSE flow after killing PID 57971 and restarting server
  found: Upload → cleanup → GET /api/check-links returns correct SSE stream: progress events then done event with deadCount
  implication: The code is correct. No fix needed to source files. Only action required is restarting the server.

## Resolution

root_cause: Stale server process (PID 57971) was started before src/routes/check.js was created and mounted in server.js. The running server had no /check-links route registered. Any request to /api/check-links hit the old server and received a 404 HTML response. The browser's EventSource treats a non-200 / non-text/event-stream response as a fatal connection error, which fires the 'error' event — producing "Link check failed. Please try again."
fix: No source code changes required. Restart the development server so it loads the new check.js routes.
verification: After killing PID 57971 and starting fresh: GET /api/check-links returns 400 (correct, no session); full flow (upload → cleanup → check-links) streams correct SSE events (progress × N, then done with deadCount).
files_changed: []
