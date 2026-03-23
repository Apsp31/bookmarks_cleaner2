# Phase 3: Link Checker - Research

**Researched:** 2026-03-23
**Domain:** HTTP link validation, Server-Sent Events, two-level concurrency control
**Confidence:** HIGH

## Summary

Phase 3 adds concurrent dead-link detection with real-time SSE progress streaming. The implementation is well-constrained by CONTEXT.md decisions: p-limit for two-level concurrency, EventSource for progress, and clearly-defined per-status-code semantics. All primary libraries (p-limit, cheerio, Node built-in fetch) are already decided; none need evaluation.

The main implementation complexity is the HTTP engine's interacting constraints: global concurrency ceiling, per-domain ceiling, HEAD-first with GET fallback, 401/403 vs 429 vs real-dead disambiguation, and OG metadata capture on 2xx HTML responses. The SSE stream itself is straightforward once the engine is working.

One critical dependency gap exists: p-limit is not yet installed (`package.json` lists it only as a note in CLAUDE.md, not in `dependencies`). The first implementation task must `npm install p-limit`.

**Primary recommendation:** Build the link-check engine (`src/linkChecker.js`) as a testable module first, then wire SSE progress on top. Don't interleave the engine and transport concerns.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Transport — Real-Time Progress**
- D-01: Progress stream delivered via SSE over `GET /api/check-links` — not polling, not WebSockets.
- D-02: Frontend uses browser-native `EventSource`; no additional library required.

**Session State**
- D-03: `src/session.js` gains a `checkedTree` field. Immutable-stage pattern maintained — original `tree` and `cleanTree` are never mutated.
- D-04: Export route priority chain extended to: `checkedTree` → `cleanTree` → `tree`.

**Link Status Semantics**
- D-05: 2xx → `'ok'` (alive, kept).
- D-06: Non-2xx, timeout, DNS failure → `'dead'` (removed via `checkedTree`).
- D-07: 429 → `'uncertain'` (flag, keep in output).
- D-08: 401 / 403 → `'ok'` (protected page exists).
- D-09: HEAD returns 405 → fall back to GET silently.

**Concurrency Control**
- D-10: `p-limit` 7.3.0 added as runtime dependency.
- D-11: Global limiter capped at 20; per-domain limiter Map capped at 2 per domain.
- D-12: Per-domain limiters keyed by `new URL(url).hostname`, created lazily.

**Timeout Budget**
- D-13: HEAD timeout: 5 seconds (`AbortSignal.timeout(5000)`).
- D-14: GET fallback timeout: 8 seconds (`AbortSignal.timeout(8000)`).
- D-15: Both timeouts exhausted → `'dead'`.

**OG/Meta Capture for Phase 4**
- D-16: For 2xx HTML responses, extract `og:title`, `og:description`, `og:image`, `<meta name="description">` into a `metadata` sub-object on `BookmarkNode`.
- D-17: Only extracted string fields stored — no full body buffering.
- D-18: GET requests capture metadata; HEAD-only successes do not.
- D-19: `Content-Type` must include `text/html` before parsing body.

**New Route**
- D-20: `src/routes/check.js` exports Router with `GET /check-links` (SSE endpoint), mounted at `/api`.

### Claude's Discretion
- SSE event format (field names, event types: `event: progress`, `event: done`, etc.)
- ETA calculation algorithm (simple linear extrapolation is sufficient)
- Error event format for unrecoverable checker failures
- Whether to expose `DELETE /api/check-links` to abort an in-progress check

### Deferred Ideas (OUT OF SCOPE)
- Retry with exponential backoff on 429
- `DELETE /api/check-links` abort endpoint
- Soft-404 detection (200 with "not found" content)
- Resume after browser reload
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LINK-01 | App checks every bookmark URL via HTTP (HEAD-first, GET fallback) and marks confirmed dead links (non-2xx, timeout, DNS failure) | D-05 to D-15 define exact engine logic; Node built-in `fetch` + `AbortSignal.timeout` confirmed sufficient |
| LINK-02 | Confirmed dead links are removed from the output tree | D-03/D-04 define `checkedTree` immutable stage; deep-clone walk with linkStatus filter is the pattern |
| LINK-03 | Rate-limited URLs (429) flagged as "could not verify" and kept | D-07 defines `'uncertain'` status; render badge in link row |
| LINK-04 | URLs returning 401 or 403 treated as alive | D-08 defines explicit `'ok'` for 401/403 before any non-2xx dead logic |
| LINK-05 | User sees real-time progress: checked/total, current URL, ETA | D-01/D-02 define SSE + EventSource; linear extrapolation for ETA |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `fetch` | built-in (Node 24.14.0 on this machine) | HTTP link checking | No dependency; `AbortSignal.timeout()` built-in since Node 17.3; confirmed stable |
| p-limit | 7.3.0 | Concurrency control — global and per-domain limiters | ESM-only; canonical solution for capping concurrent async ops; **NOT yet installed** |
| cheerio | 1.2.0 | OG/meta tag extraction from 2xx HTML response bodies | Already installed; already used in `src/parser.js` |
| Node.js `node:test` | built-in | Test framework | Already used in all existing test files; no framework install needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Express SSE (manual) | — | SSE response headers + event writing | No library needed; SSE is plain HTTP with specific headers |
| `EventSource` (browser) | native | Consume SSE stream in Alpine.js component | No npm package; browser-native since wide baseline |

### Alternatives Considered
| Recommended | Alternative | Tradeoff |
|-------------|-------------|----------|
| Built-in `fetch` + `AbortSignal.timeout` | `got` with retry | `got` adds a dep; manual retry logic is sufficient for one-shot link checking |
| Manual SSE (plain Express response) | `sse` npm package | The SSE protocol is 4 headers + a text format; a library adds no value here |
| `EventSource` (native) | `eventsource` npm polyfill | Polyfill is for Node.js clients; browser frontend uses native |

**Installation (missing dependency):**
```bash
npm install p-limit
```

**Version verification:** p-limit 7.3.0 confirmed via CLAUDE.md canonical sources (GitHub + npm registry). Node 24.14.0 running on this machine — satisfies `>=20` constraint.

---

## Architecture Patterns

### Module Boundary: Engine vs. Transport
The link-check engine must be separate from the SSE route so it can be unit-tested without HTTP.

```
src/
├── linkChecker.js       # Pure async engine: checkUrl(), checkAll(urls, onProgress)
├── routes/
│   └── check.js         # SSE route: consumes linkChecker.checkAll, streams events
```

`checkAll` accepts an `onProgress` callback that the route turns into SSE writes. This decouples the engine from Express.

### Pattern 1: Two-Level p-limit Concurrency

**What:** A global limiter caps total concurrent requests; a per-domain limiter map (lazy-created) caps requests per hostname.

**When to use:** Every URL fetch must be wrapped by BOTH limiters — outer (global) then inner (domain).

```javascript
// Source: CONTEXT.md D-10, D-11, D-12 + p-limit docs
import pLimit from 'p-limit';

const globalLimit = pLimit(20);
const domainLimiters = new Map();

function getDomainLimiter(hostname) {
  if (!domainLimiters.has(hostname)) {
    domainLimiters.set(hostname, pLimit(2));
  }
  return domainLimiters.get(hostname);
}

async function checkUrl(url) {
  const hostname = new URL(url).hostname;
  const domainLimit = getDomainLimiter(hostname);
  // Wrap with domain limiter first (inner), then global (outer)
  return globalLimit(() => domainLimit(() => _fetchUrl(url)));
}
```

### Pattern 2: HEAD-first with GET Fallback

**What:** Try HEAD first (faster, no body); fall back to GET on 405 or network error. Capture OG metadata on GET 2xx HTML responses.

**When to use:** All URL checks. GET fallback is triggered ONLY by 405 or thrown errors — not by non-2xx status codes (those are definitive).

```javascript
// Source: CONTEXT.md D-09, D-13, D-14, D-18, D-19
async function _fetchUrl(url) {
  let response;
  try {
    response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });
    if (response.status === 405) {
      throw new Error('HEAD not allowed');
    }
  } catch (headErr) {
    // Network error or 405 — fall back to GET
    try {
      response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
    } catch (getErr) {
      return { status: 'dead', error: getErr.message };
    }
  }
  return resolveStatus(response, url);
}
```

### Pattern 3: Status Code Resolution

```javascript
// Source: CONTEXT.md D-05 through D-09
function resolveStatus(response, originalUrl) {
  const code = response.status;
  if (code === 429) return { status: 'uncertain' };
  if (code === 401 || code === 403) return { status: 'ok', finalUrl: response.url };
  if (code >= 200 && code < 300) {
    // Capture OG metadata if HTML and GET response (has body)
    return { status: 'ok', finalUrl: response.url, response };
  }
  return { status: 'dead' };
}
```

### Pattern 4: SSE Event Format (Claude's Discretion — Recommended)

**What:** Three event types: `progress` (per URL), `done` (final summary), `error` (unrecoverable failure).

```
event: progress
data: {"checked":42,"total":500,"currentUrl":"https://example.com","eta":87}

event: done
data: {"deadCount":17,"uncertainCount":3,"checkedTree":{...}}

event: error
data: {"message":"No bookmarks loaded"}
```

**SSE response setup in Express:**
```javascript
// Source: MDN SSE specification + Express docs
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.flushHeaders(); // send headers immediately before any data

function sendEvent(res, eventName, data) {
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
}
```

**Alpine.js EventSource consumer:**
```javascript
// Source: MDN EventSource API
const es = new EventSource('/api/check-links');
es.addEventListener('progress', (e) => {
  const d = JSON.parse(e.data);
  this.checked = d.checked;
  this.total = d.total;
  this.currentUrl = d.currentUrl;
  this.eta = d.eta;
});
es.addEventListener('done', (e) => {
  const d = JSON.parse(e.data);
  this.checkedTree = d.checkedTree;
  this.status = 'checked';
  es.close();
});
es.addEventListener('error', () => {
  this.errorMsg = 'Link check failed';
  es.close();
});
```

### Pattern 5: ETA Calculation (Linear Extrapolation)

```javascript
// Claude's discretion — simple linear extrapolation
function calcEta(checked, total, elapsedMs) {
  if (checked === 0) return null;
  const rate = checked / elapsedMs; // URLs per ms
  const remaining = total - checked;
  return Math.round(remaining / rate / 1000); // seconds
}
```

### Pattern 6: Building checkedTree (Deep Clone + Filter)

After all URLs are checked, produce `checkedTree` by deep-cloning the source tree and removing nodes with `linkStatus === 'dead'`. Folders with zero surviving children are also pruned (empty folders).

```javascript
function buildCheckedTree(tree, linkStatuses) {
  // linkStatuses: Map<url, 'ok'|'dead'|'uncertain'>
  function walk(node) {
    if (node.type === 'link') {
      const st = linkStatuses.get(node.url) ?? 'ok';
      if (st === 'dead') return null;
      return { ...node, linkStatus: st };
    }
    if (node.type === 'folder') {
      const children = (node.children || [])
        .map(walk)
        .filter(Boolean);
      return { ...node, children };
      // Note: keep empty folders at this stage; Phase 5 CLASS-03 removes empties
    }
    return node;
  }
  return walk(tree);
}
```

Note: The REQUIREMENTS.md says dead links are removed from output. Empty folder pruning after dead-link removal is CLASS-03 (Phase 5), so `checkedTree` should keep folders even if they become empty after dead-link removal — consistent with the immutable-stage pattern.

### Anti-Patterns to Avoid

- **Mutating `session.tree` or `session.cleanTree`:** Immutable-stage pattern. Only `checkedTree` is written by this phase.
- **Attaching full response body to node:** D-17 restricts to string fields only. Don't buffer raw HTML.
- **Using GET for all URLs from the start:** HEAD is faster (no body transfer). Only fall back to GET on 405 or thrown network error — not on non-2xx status codes.
- **Triggering GET fallback on non-2xx from HEAD:** A 404 from HEAD is a definitive dead signal — no need to confirm with GET.
- **Checking URLs not of type `link`:** Walk the source tree and collect only `node.type === 'link'` nodes with a `url` property before building the check queue.
- **Starting SSE after all checks complete:** `res.flushHeaders()` must be called immediately so the browser's `EventSource` connection establishes. Otherwise the browser sees a long silence and may time out.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent async rate-limiting | Manual queue with counter | `p-limit` 7.3.0 | Handles backpressure, promise rejection propagation, and cleanup correctly |
| Per-domain rate-limiting | Second manual queue | Second `p-limit` instance per hostname (lazy Map) | Same library, different instance — minimal code, correct semantics |
| OG tag extraction from HTML | Custom regex | `cheerio` (already installed) | Handles malformed HTML, multiple tag formats; already a dependency |
| SSE protocol | Custom streaming format | Plain `res.write()` with `text/event-stream` headers | SSE IS a plain text protocol — no library needed, but also no reinvention |

**Key insight:** p-limit's two-instance pattern (global + per-domain) fully satisfies the two-level concurrency requirement with ~10 lines of setup code. Any hand-rolled queue will have subtle bugs around promise rejection and early termination.

---

## Common Pitfalls

### Pitfall 1: GET Fallback Triggered on Non-2xx HEAD
**What goes wrong:** Code checks `if (!response.ok)` after HEAD and falls back to GET, but a 404 from HEAD is a definitive dead signal — GET will also 404, wasting the timeout budget.
**Why it happens:** Conflating "fallback on failure" with "fallback on non-2xx."
**How to avoid:** Only trigger GET fallback on `response.status === 405` or a thrown error (network failure, timeout). All other status codes from HEAD are definitive.
**Warning signs:** Link checks taking ~13s each for large batches of dead links.

### Pitfall 2: SSE Headers Sent Too Late
**What goes wrong:** `res.flushHeaders()` not called before the async check loop starts. Browser `EventSource` waits indefinitely, then fires `onerror` after its own timeout.
**Why it happens:** Developers write the loop first, stream results after.
**How to avoid:** Set SSE headers and call `res.flushHeaders()` as the first thing in the route handler, before any async work.
**Warning signs:** Browser DevTools shows the SSE request as "pending" for a long time, then fails.

### Pitfall 3: p-limit Not Installed
**What goes wrong:** Server crashes with `Cannot find package 'p-limit'` on startup.
**Why it happens:** p-limit is in CLAUDE.md's recommended stack but was never added to `package.json`. Current `package.json` only lists cheerio, express, fastest-levenshtein, multer.
**How to avoid:** Wave 0 task: `npm install p-limit` before any other implementation.
**Warning signs:** `node_modules/p-limit` directory does not exist.

### Pitfall 4: EventSource Connection Closed by Client Before Done
**What goes wrong:** User navigates away or reloads; the in-progress check loop keeps running but can't write to the closed response, causing unhandled `write after end` errors.
**Why it happens:** No `req.on('close')` handler.
**How to avoid:** Set a cancellation flag on `req.on('close', ...)`. Check the flag in the progress callback before writing SSE events.
**Warning signs:** `Error [ERR_HTTP_HEADERS_SENT]` in server logs after browser reload.

### Pitfall 5: Redirect Loop / Infinite Redirect
**What goes wrong:** fetch follows redirects by default. A redirect loop exhausts the timeout, leaving the URL stuck until AbortSignal fires.
**Why it happens:** `redirect: 'follow'` (the default) follows indefinitely unless Node's built-in limit kicks in.
**How to avoid:** Node's built-in fetch has a 20-redirect limit by default — this is acceptable. The timeout budget (5s/8s) provides the hard outer bound. No special handling needed.
**Warning signs:** Many URLs timing out consistently (suggests redirect loops in the bookmark set).

### Pitfall 6: `new URL(url)` Throws on Invalid URLs
**What goes wrong:** Bookmarks occasionally contain malformed URLs (missing protocol, spaces, etc.). `new URL(url)` throws, crashing the worker.
**Why it happens:** Bookmark files from browsers can contain data: URLs, javascript: URLs, or user-typed garbage.
**How to avoid:** Wrap `new URL(url)` in a try/catch. If it throws, mark the bookmark `'dead'` immediately without fetching.
**Warning signs:** Unhandled promise rejections mentioning `TypeError: Invalid URL`.

### Pitfall 7: Metadata Capture on HEAD-Success Paths
**What goes wrong:** A URL succeeds via HEAD (no body). Code tries to parse cheerio from an empty body, getting no metadata.
**Why it happens:** D-18 is clear — HEAD responses have no body. But a bug could pass an empty string to cheerio.
**How to avoid:** Only attempt OG extraction when a GET response is available AND `Content-Type` includes `text/html` (D-19). HEAD-success paths skip metadata entirely.

---

## Code Examples

### SSE Route Skeleton (src/routes/check.js)
```javascript
// Source: CONTEXT.md D-01, D-20 + SSE specification
import { Router } from 'express';
import { session } from '../session.js';
import { checkAll } from '../linkChecker.js';

const router = Router();

router.get('/check-links', async (req, res) => {
  if (!session.tree) {
    return res.status(400).json({ error: 'No bookmarks loaded.' });
  }

  // SSE headers — must be set before any async work
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let cancelled = false;
  req.on('close', () => { cancelled = true; });

  function send(eventName, data) {
    if (!cancelled) res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const sourceTree = session.cleanTree ?? session.tree;
    const result = await checkAll(sourceTree, (progress) => send('progress', progress));
    session.checkedTree = result.checkedTree;
    send('done', { deadCount: result.deadCount, uncertainCount: result.uncertainCount });
  } catch (err) {
    send('error', { message: err.message });
  } finally {
    res.end();
  }
});

export default router;
```

### Link Checker Engine Signature (src/linkChecker.js)
```javascript
// Source: CONTEXT.md D-10 through D-19
import pLimit from 'p-limit';
import * as cheerio from 'cheerio';

/**
 * Check all link nodes in the tree.
 * @param {import('./shared/types.js').BookmarkNode} tree
 * @param {(progress: {checked: number, total: number, currentUrl: string, eta: number|null}) => void} onProgress
 * @returns {Promise<{checkedTree: BookmarkNode, deadCount: number, uncertainCount: number}>}
 */
export async function checkAll(tree, onProgress) { /* ... */ }

/**
 * Check a single URL. Returns status and optional metadata.
 * @param {string} url
 * @returns {Promise<{status: 'ok'|'dead'|'uncertain', finalUrl?: string, metadata?: object}>}
 */
export async function checkUrl(url) { /* ... */ }
```

### Alpine.js Progress State (additions to bookmarkApp)
```javascript
// Source: CONTEXT.md D-02 + MDN EventSource
// New state fields:
isChecking: false,
checkProgress: { checked: 0, total: 0, currentUrl: '', eta: null },
deadCount: 0,
uncertainCount: 0,
checkedTree: null,

// New method:
async runLinkCheck() {
  this.isChecking = true;
  this.status = 'checking';
  const es = new EventSource('/api/check-links');
  es.addEventListener('progress', (e) => {
    this.checkProgress = JSON.parse(e.data);
  });
  es.addEventListener('done', (e) => {
    const d = JSON.parse(e.data);
    this.deadCount = d.deadCount;
    this.uncertainCount = d.uncertainCount;
    this.isChecking = false;
    this.status = 'checked';
    es.close();
    this.rerenderTree();
  });
  es.onerror = () => {
    this.errorMsg = 'Link check failed — please try again.';
    this.isChecking = false;
    this.status = 'cleaned'; // fall back to previous state
    es.close();
  };
},
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node-fetch` for HTTP in Node | Built-in `fetch` | Node 18 (stable) | No extra dependency |
| Polling for progress updates | SSE (EventSource) | Always supported; now idiomatic | Lower latency, no extra requests |
| Manual concurrency queues | `p-limit` | ~2018 onwards | 5-line setup vs. custom queue with edge cases |

**Deprecated/outdated:**
- `node-fetch`: redundant since Node 18 built-in fetch stabilized; don't add it.
- Polling `GET /api/check-status`: replaced by SSE; adds latency and server load.

---

## Open Questions

1. **Should `checkedTree` source from `cleanTree` or `tree` when both exist?**
   - What we know: D-03 says "post-link-check tree"; the source tree to check is whichever the user has progressed to.
   - What's unclear: If the user skips Phase 2 cleanup and goes straight to link check, `cleanTree` is null.
   - Recommendation: Source from `session.cleanTree ?? session.tree` — same fallback pattern as export. Document this explicitly in `check.js`.

2. **Redirect capture: `response.url` vs. original URL**
   - What we know: CONTEXT.md specifics note that `response.url` after fetch gives the final redirect URL. This is low-overhead (no extra code).
   - What's unclear: Whether to store `redirectUrl` on `BookmarkNode` now or defer to Phase 4.
   - Recommendation: Store `finalUrl: response.url` on the result object from `checkUrl()` when it differs from the input URL. Annotate the node with a `redirectUrl` field. Cost is near-zero and Phase 4 will benefit from the canonical URL for classification.

3. **Progress event frequency: every URL or batched?**
   - What we know: With 20 concurrent requests and potentially 1000+ URLs, a `progress` event per URL means 1000+ SSE writes.
   - What's unclear: Whether this is too chatty for the browser.
   - Recommendation: Emit `progress` on every completion — at 20 concurrent / ~200ms avg latency, that's ~100 events/second at peak, well within browser EventSource capacity. Keep it simple.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v24.14.0 | — |
| p-limit | Concurrency control | No — not installed | — | None; must install before implementation |
| cheerio | OG metadata extraction | Yes (already in package.json) | 1.0.16+ | — |
| Browser EventSource | Frontend SSE consumer | Yes (all modern browsers) | native | — |

**Missing dependencies with no fallback:**
- `p-limit` is not in `package.json` and `node_modules/p-limit` does not exist. Wave 0 must run `npm install p-limit` before any other task.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | none — test runner invoked directly |
| Quick run command | `node --test test/linkChecker.test.js` |
| Full suite command | `node --test test/**/*.test.js` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LINK-01 | `checkUrl` returns `'dead'` for timeout (mock fetch) | unit | `node --test test/linkChecker.test.js` | No — Wave 0 |
| LINK-01 | `checkUrl` returns `'dead'` for DNS failure (ENOTFOUND) | unit | `node --test test/linkChecker.test.js` | No — Wave 0 |
| LINK-01 | `checkUrl` tries HEAD first, then GET on 405 | unit | `node --test test/linkChecker.test.js` | No — Wave 0 |
| LINK-02 | `buildCheckedTree` removes nodes with `status === 'dead'` | unit | `node --test test/linkChecker.test.js` | No — Wave 0 |
| LINK-03 | `checkUrl` returns `'uncertain'` for 429 | unit | `node --test test/linkChecker.test.js` | No — Wave 0 |
| LINK-04 | `checkUrl` returns `'ok'` for 401 and 403 | unit | `node --test test/linkChecker.test.js` | No — Wave 0 |
| LINK-05 | `onProgress` callback called with `checked`, `total`, `currentUrl` on each URL completion | unit | `node --test test/linkChecker.test.js` | No — Wave 0 |

**Note on mocking fetch:** Node's `node:test` module supports `mock.fn()` and module-level mocking via `mock.module()` (added in Node 22). Since the machine runs Node 24.14.0, `mock.module()` can replace `globalThis.fetch` per-test without additional libraries.

### Sampling Rate
- **Per task commit:** `node --test test/linkChecker.test.js`
- **Per wave merge:** `node --test test/**/*.test.js`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/linkChecker.test.js` — covers LINK-01 through LINK-05 with mocked fetch
- [ ] `src/linkChecker.js` — engine module (created in Wave 1, but test file scaffolded in Wave 0)

*(Existing test infrastructure: `test/parser.test.js`, `test/dedup.test.js`, `test/exporter.test.js`, `test/fuzzy.test.js`, `test/roundtrip.test.js` — all use `node:test`; pattern is established.)*

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 3 |
|-----------|-------------------|
| No API key required for core flow | Link checking is pure HTTP — no API key needed |
| No build step — CDN-only Alpine.js | EventSource is browser-native; no bundling needed |
| `"type": "module"` in package.json | p-limit ESM-only constraint already satisfied |
| Node >=20 required | p-limit 7.3.0 requires Node >=20; Node 24.14.0 on this machine |
| p-limit 7.3.0 + global ceiling 20, per-domain ceiling 2 | Two-level limiter Map pattern; must not deviate |
| HEAD-first, GET fallback | Confirmed in D-09, D-13, D-14 |
| 401/403 treated as alive; 429 kept as uncertain | Confirmed in D-07, D-08 |
| `AbortSignal.timeout(5000)` for HEAD, `AbortSignal.timeout(8000)` for GET | Built into Node 24 |
| Do not use `bookmarks-parser` or `node-bookmarks-parser` npm packages | Not relevant to link checker |
| Do not use `node-fetch` | Built-in fetch used instead |
| Do not use React/Vue/Svelte | Alpine.js CDN used for progress UI |
| GSD workflow enforcement | All changes via `/gsd:execute-phase` |

---

## Sources

### Primary (HIGH confidence)
- CONTEXT.md — locked decisions D-01 through D-20; all implementation decisions pre-made
- `src/session.js` — current session store shape (direct read, ground truth)
- `src/shared/types.js` — `BookmarkNode` typedef with `linkStatus` field (direct read)
- `src/routes/export.js` — current export priority chain `cleanTree ?? tree` (direct read)
- `server.js` — router mount pattern (direct read)
- `public/app.js` — existing Alpine component state and patterns (direct read)
- `package.json` — confirmed p-limit is absent from dependencies (direct read)
- CLAUDE.md — stack constraints (project instructions)
- MDN EventSource API — SSE browser protocol (well-established specification)
- Node.js docs — `AbortSignal.timeout()`, built-in fetch, `node:test` mock API

### Secondary (MEDIUM confidence)
- Node.js `node:test` mock.module() docs — available in Node 22+, machine runs 24.14.0

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already decided in CONTEXT.md and CLAUDE.md; p-limit absence confirmed by direct package.json read
- Architecture: HIGH — patterns derived from locked decisions and existing codebase conventions
- Pitfalls: HIGH for p-limit-not-installed (confirmed), HEAD-fallback logic (derived from D-09 spec), SSE header ordering (well-documented browser behavior); MEDIUM for redirect loop edge cases

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable libraries; SSE and fetch specs are not changing)
