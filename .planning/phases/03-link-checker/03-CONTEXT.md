# Phase 3: Link Checker - Context

**Gathered:** 2026-03-23 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Concurrent dead-link detection with real-time SSE progress stream. Every bookmark URL is checked for liveness; confirmed dead links are removed; rate-limited and auth-protected URLs are kept with appropriate status flags; user sees live progress (checked/total, current URL, ETA) while the checker runs. Classification metadata (OG tags) is captured here for Phase 4 to consume — no second fetch.

</domain>

<decisions>
## Implementation Decisions

### Transport — Real-Time Progress
- **D-01:** Progress stream delivered via Server-Sent Events (SSE) over `GET /api/check-links` — not polling, not WebSockets.
- **D-02:** Frontend uses browser-native `EventSource` to consume the stream; no additional library required, consistent with CDN-only Alpine.js constraint.

### Session State
- **D-03:** Session store (`src/session.js`) gains a `checkedTree` field holding the post-link-check tree (dead links removed). The immutable-stage pattern is maintained — original `tree` and `cleanTree` are never mutated.
- **D-04:** Export route priority chain extended to: `checkedTree` → `cleanTree` → `tree` (same fallback pattern as Phase 2).

### Link Status Semantics
- **D-05:** 2xx responses → `'ok'` (alive, kept).
- **D-06:** Non-2xx, timeout, DNS failure → `'dead'` (removed from output tree via `checkedTree`).
- **D-07:** 429 (Too Many Requests) → `'uncertain'` (flag, keep in output — LINK-03).
- **D-08:** 401 / 403 → treated as `'ok'` (protected page exists — LINK-04).
- **D-09:** HEAD returns 405 Method Not Allowed → fall back to GET silently (not a failure).

### Concurrency Control
- **D-10:** p-limit 7.3.0 added as runtime dependency (`npm install p-limit`). ESM-only — compatible with existing `"type": "module"` in `package.json`.
- **D-11:** Two-level concurrency: global limiter capped at 20 concurrent requests; per-domain limiter Map (lazy-created per hostname) capped at 2 concurrent requests per domain.
- **D-12:** Per-domain limiters stored in a `Map<string, pLimit>` keyed by `new URL(url).hostname`. Created on first request to that domain.

### Timeout Budget
- **D-13:** HEAD request timeout: 5 seconds (`AbortSignal.timeout(5000)`).
- **D-14:** GET fallback timeout: 8 seconds (`AbortSignal.timeout(8000)`). GET is used when HEAD returns 405 or throws a network error (not for non-2xx status codes — those are definitive responses).
- **D-15:** Total per-URL budget is ~13s maximum (HEAD + GET). Bookmarks that exhaust both attempts with timeout/network error are marked `'dead'`.

### OG/Meta Capture for Phase 4
- **D-16:** For each URL returning a 2xx HTML response, the link checker parses the response body with cheerio and extracts: `og:title`, `og:description`, `og:image`, `<meta name="description">`. Stored as a `metadata` sub-object on the `BookmarkNode`.
- **D-17:** Only extracted string fields are stored — full response bodies are not buffered. This keeps the session memory bounded regardless of collection size.
- **D-18:** GET requests (whether primary or fallback) capture metadata. HEAD responses have no body — metadata capture skipped for HEAD-only successes (a subsequent GET would be needed; instead, Phase 4 falls back to domain-rules classification for those).
- **D-19:** `Content-Type` check before parsing: only parse response body if `content-type` includes `text/html`. Binary/JSON responses are skipped.

### New Route
- **D-20:** New route file `src/routes/check.js` exports a Router with `GET /check-links` (SSE endpoint). Mounted at `/api` in `server.js` following the router-per-file pattern.

### Claude's Discretion
- SSE event format (field names, event types — e.g., `data:`, `event: progress`, `event: done`)
- ETA calculation algorithm (simple linear extrapolation is sufficient)
- Error event format for unrecoverable checker failures
- Whether to expose a `DELETE /api/check-links` to abort an in-progress check

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Dead Link Checking — LINK-01 through LINK-05: full acceptance criteria
- `.planning/ROADMAP.md` §Phase 3 — Success criteria, UI hint

### Prior phase context (locked decisions that carry forward)
- `.planning/phases/01-foundation/01-CONTEXT.md` — immutable-stage tree pattern (D-11), session singleton, router-per-file pattern
- `.planning/phases/02-core-cleanup/02-CONTEXT.md` — `cleanTree` session field, export priority chain, p-limit intent

### Existing source files to read before implementing
- `src/session.js` — current session store structure to extend
- `src/shared/types.js` — `BookmarkNode` type with `linkStatus` field already defined
- `src/routes/export.js` — current export priority chain to extend with `checkedTree`
- `server.js` — where new `check.js` route is mounted

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/types.js`: `BookmarkNode.linkStatus` field (`'ok'|'dead'|'redirect'|'pending'`) already defined — link checker populates this field.
- `src/session.js`: Module-level singleton with `tree`, `cleanTree`, `originalFilename` fields — extend with `checkedTree` and a `linkMetadata` map or inline `metadata` per node.
- `cheerio` (already installed): Used in `src/parser.js` for HTML parsing — reuse for OG/meta extraction from fetched page bodies.
- `src/routes/export.js`: Priority-chain pattern (`cleanTree → tree`) to extend.

### Established Patterns
- **Router-per-file**: `src/routes/check.js` exports a `Router`, mounted in `server.js` at `/api`.
- **Immutable stage**: Each pipeline step produces a new tree; originals not mutated.
- **ESM throughout**: All source files use ES module syntax (`import`/`export`). p-limit ESM-only is compatible.

### Integration Points
- `server.js`: Mount `import checkRouter from './src/routes/check.js'` and `app.use('/api', checkRouter)`.
- `src/session.js`: Add `checkedTree: null` and optionally a per-URL metadata cache.
- `src/routes/export.js`: Update priority chain to check `session.checkedTree` first.
- `public/app.js`: Add Alpine.js state for link-check progress (`isChecking`, `checked`, `total`, `currentUrl`, `eta`) and `EventSource` logic.

</code_context>

<specifics>
## Specific Ideas

- STATE.md blocker note: "HTTP engine has interacting constraints (global concurrency, per-domain ceiling, soft-404 probe, 429 backoff, redirect capture). Research recommends a focused spike against a real 100-URL sample before full implementation." — The planner should consider splitting implementation into: (1) basic HEAD/GET engine with concurrency, (2) SSE progress wiring, (3) soft-404 handling if time permits.
- "Redirect capture" is not a Phase 3 requirement but the `BookmarkNode` type has `'redirect'` as a status value — capture final redirect URL as a `redirectUrl` field on the node so Phase 4 classification can use the canonical URL. This is low-overhead (just read `response.url` after fetch).

</specifics>

<deferred>
## Deferred Ideas

- **Retry with exponential backoff on 429**: Adds significant complexity; the simpler "mark as uncertain and keep" (LINK-03) is sufficient for v1. Could be added as a v2 enhancement.
- **Abort in-flight check**: A `DELETE /api/check-links` endpoint to cancel a running check. Useful UX but not required by LINK-01 through LINK-05.
- **Soft-404 detection** (pages returning 200 but with "not found" content): Not in requirements. Could be a v2 enhancement.
- **Resume after browser reload**: SSE streams are per-connection. Resuming an interrupted check is v2 scope.

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 03-link-checker*
*Context gathered: 2026-03-23*
