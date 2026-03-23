# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## link-check-sse-error — SSE "Link check failed" error fires immediately due to stale server process
- **Date:** 2026-03-23
- **Error patterns:** link check failed, EventSource error, SSE, check-links, 404, stale server, routes not registered
- **Root cause:** Stale server process started before src/routes/check.js was created. The running server had no /check-links route registered so requests returned 404 HTML, which EventSource treats as a fatal error and fires the 'error' event.
- **Fix:** No source code changes required. Restart the development server so it loads the new routes.
- **Files changed:**
---

