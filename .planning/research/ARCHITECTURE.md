# Architecture Research

**Domain:** Local Node.js web app — bookmark file processor with browser review UI
**Researched:** 2026-03-23
**Confidence:** HIGH (patterns are well-established; library choices verified against current npm/GitHub state)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Frontend)                        │
├──────────────────────────────┬──────────────────────────────────┤
│  Left Panel                  │  Right Panel                     │
│  ┌────────────────────────┐  │  ┌────────────────────────────┐  │
│  │  Original Tree         │  │  │  Proposed Tree (editable)  │  │
│  │  (read-only display)   │  │  │  drag/rename/merge/delete  │  │
│  └────────────────────────┘  │  └────────────────────────────┘  │
├──────────────────────────────┴──────────────────────────────────┤
│  Progress Bar + Status (SSE stream from server)                  │
│  Upload area │ Export button │ Undo/Redo controls               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST + SSE (HTTP)
┌──────────────────────────▼──────────────────────────────────────┐
│                     Node.js / Express Server                     │
├─────────────┬────────────┬─────────────┬────────────────────────┤
│  Pipeline   │  Session   │  Link       │  Classifier            │
│  Controller │  Store     │  Checker    │  (domain rules →       │
│             │  (in-mem)  │  (p-limit   │   OG meta → API)       │
│             │            │   queue)    │                        │
├─────────────┴────────────┴─────────────┴────────────────────────┤
│  Parser  │  Deduplicator  │  Folder Merger  │  Restructurer      │
└─────────────────────────────────────────────────────────────────┘
                           │
                    (URL health checks
                     to the internet)
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| **Parser** | Convert Netscape Bookmark HTML → internal BookmarkNode tree | `netscape-bookmark-tree` npm package + thin adapter |
| **Deduplicator** | Remove exact-URL duplicates; detect duplicate folder subtrees | Pure function, recursive tree walk |
| **Folder Merger** | Fuzzy-match folder names (Jaro-Winkler ≥ 0.85 threshold); merge matching siblings | `natural` or `fastest-levenshtein` for distance; heuristic merge decision |
| **Link Checker** | HEAD/GET every URL; collect HTTP status + redirect target + page metadata (OG title, description) | `p-limit` for concurrency control (20 concurrent); 10s timeout per URL |
| **Classifier** | Assign a category to each bookmark: domain rules → OG metadata → fallback API | Layered strategy; domain map as JSON config; `uClassify` REST API as last resort |
| **Restructurer** | Build proposed folder hierarchy (max 3 levels) from classified bookmarks | Groups bookmarks by category; balances folder width |
| **Pipeline Controller** | Orchestrate stages in order; emit progress events; hold session state | Express route handler; EventEmitter or async generator for SSE |
| **Session Store** | Hold original tree + proposed tree + user edits in memory for the session | Plain JS object keyed by session ID; single-user local tool so one session is fine |
| **API Layer** | REST endpoints for upload, edit commands, export; SSE endpoint for progress | Express.js routes |
| **Frontend Tree View** | Render both trees; diff highlights; drag-drop editing of proposed tree | Vanilla TypeScript + `sortable-tree` for drag-drop |
| **Exporter** | Serialize the final edited BookmarkNode tree back to Netscape Bookmark HTML | Template string or DOM serializer; no external library needed |

---

## Recommended Project Structure

```
bookmark-cleaner/
├── src/
│   ├── server/
│   │   ├── index.ts              # Express app entry point
│   │   ├── routes/
│   │   │   ├── upload.ts         # POST /api/upload (multipart)
│   │   │   ├── progress.ts       # GET /api/progress (SSE)
│   │   │   ├── tree.ts           # GET /api/tree (current state)
│   │   │   ├── edit.ts           # POST /api/edit (tree mutations)
│   │   │   └── export.ts         # GET /api/export (download)
│   │   ├── pipeline/
│   │   │   ├── index.ts          # Orchestrator — runs stages in order
│   │   │   ├── parser.ts         # Netscape HTML → BookmarkNode tree
│   │   │   ├── deduplicator.ts   # Remove exact-URL and subtree duplicates
│   │   │   ├── folder-merger.ts  # Fuzzy folder name consolidation
│   │   │   ├── link-checker.ts   # Concurrent URL health + metadata fetch
│   │   │   ├── classifier.ts     # Category assignment (layered strategy)
│   │   │   └── restructurer.ts   # Build proposed hierarchy
│   │   ├── session.ts            # In-memory session store
│   │   └── exporter.ts           # BookmarkNode tree → Netscape HTML string
│   ├── shared/
│   │   └── types.ts              # BookmarkNode, PipelineProgress, EditCommand types
│   └── client/
│       ├── index.html
│       ├── main.ts               # Entry: mount panels, wire SSE, handle events
│       ├── components/
│       │   ├── tree-panel.ts     # Renders a BookmarkNode tree as collapsible list
│       │   ├── diff-highlight.ts # Annotates right panel nodes (added/removed/moved)
│       │   └── progress-bar.ts   # SSE-driven progress display
│       └── state/
│           ├── store.ts          # Client-side state (proposed tree + edit history)
│           └── commands.ts       # Edit command types + undo stack
├── public/                       # Served static files (built client bundle)
├── domain-rules.json             # domain → category map (e.g. "github.com" → "Dev")
├── package.json
└── tsconfig.json
```

### Structure Rationale

- **`src/server/pipeline/`:** Each pipeline stage is a pure(ish) function that takes a tree and returns a new tree. This makes them independently testable and reorderable without touching the orchestrator.
- **`src/shared/types.ts`:** Single source of truth for `BookmarkNode` and API types shared between server and client — no duplication, no drift.
- **`src/client/state/`:** Separating client state from rendering components keeps the edit/undo logic testable without a DOM.
- **`domain-rules.json`:** Externalised so users can extend the domain→category map without touching code.

---

## Core Data Model

The internal `BookmarkNode` type is the canonical representation used throughout the entire pipeline. It is defined once in `shared/types.ts` and used on both server and client.

```typescript
// shared/types.ts

export interface BookmarkNode {
  id: string;            // Stable UUID assigned at parse time
  type: 'folder' | 'link';
  title: string;
  url?: string;          // Only present when type === 'link'
  addDate?: number;      // Unix timestamp from original file
  children?: BookmarkNode[];  // Only present when type === 'folder'

  // Populated by pipeline stages — undefined until that stage runs
  linkStatus?: 'ok' | 'dead' | 'redirect' | 'pending';
  redirectUrl?: string;
  category?: string;
  metadata?: {
    ogTitle?: string;
    ogDescription?: string;
    favicon?: string;
  };

  // UI annotations — populated after diff computation
  diffStatus?: 'added' | 'removed' | 'moved' | 'unchanged';
}

// Edit commands (client → server, also used for undo stack)
export type EditCommand =
  | { type: 'MOVE_NODE'; nodeId: string; targetParentId: string; index: number }
  | { type: 'RENAME_NODE'; nodeId: string; newTitle: string }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'MERGE_FOLDERS'; sourceId: string; targetId: string }
  | { type: 'ADD_FOLDER'; parentId: string; title: string };

// Progress event emitted over SSE
export interface PipelineProgress {
  stage: 'parsing' | 'deduplicating' | 'link-checking' | 'classifying' | 'restructuring' | 'done';
  pct: number;           // 0–100
  message: string;
  detail?: string;       // e.g. URL currently being checked
}
```

**Why this shape:**
- `id` is assigned at parse time and never changes — the UI uses it as a stable React/DOM key throughout editing.
- `diffStatus` is computed once after the pipeline completes by walking both trees, then stored on the proposed tree nodes. This keeps diff logic out of the render loop.
- `EditCommand` as a discriminated union enables a typed undo stack on the client with no library dependency.

---

## Architectural Patterns

### Pattern 1: Immutable Pipeline Stages

**What:** Each pipeline stage is a function `(tree: BookmarkNode) => BookmarkNode` that returns a new tree without mutating the input.

**When to use:** All pipeline stages (deduplication, link checking, classification, restructuring).

**Trade-offs:** Slightly more memory (two full trees exist briefly during each stage). The benefit is that the original tree is always intact for the side-by-side UI — no defensive copying needed.

**Example:**
```typescript
// pipeline/deduplicator.ts
export function deduplicate(root: BookmarkNode): BookmarkNode {
  const seenUrls = new Set<string>();
  function walk(node: BookmarkNode): BookmarkNode | null {
    if (node.type === 'link') {
      if (!node.url || seenUrls.has(node.url)) return null;
      seenUrls.add(node.url);
      return node;
    }
    const children = (node.children ?? [])
      .map(walk)
      .filter((n): n is BookmarkNode => n !== null);
    return { ...node, children };
  }
  return walk(root) ?? root;
}
```

### Pattern 2: SSE for Pipeline Progress (not WebSocket)

**What:** The `/api/progress` endpoint is a long-lived HTTP response with `Content-Type: text/event-stream`. The pipeline emits typed JSON events over this stream as each stage progresses.

**When to use:** This specific scenario — one-directional server-to-client progress where the client never needs to send mid-stream messages.

**Why SSE over WebSocket:** WebSocket is bidirectional and adds handshake complexity. SSE is plain HTTP (works through proxies, no library needed on client), auto-reconnects, and is the correct primitive for this use case. The "start pipeline" action is a separate POST — the SSE stream only carries progress back.

**Trade-offs:** SSE is unidirectional. If you later need the client to cancel mid-pipeline, you close the SSE connection client-side and add a `DELETE /api/session` endpoint — no bidirectional protocol needed.

**Example (server):**
```typescript
// routes/progress.ts
router.get('/api/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: PipelineProgress) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  session.pipeline.on('progress', send);
  req.on('close', () => session.pipeline.off('progress', send));
});
```

**Example (client):**
```typescript
const es = new EventSource('/api/progress');
es.onmessage = (e) => {
  const progress: PipelineProgress = JSON.parse(e.data);
  updateProgressBar(progress);
  if (progress.stage === 'done') es.close();
};
```

### Pattern 3: Concurrent Link Checking with p-limit

**What:** URL checking runs N connections in parallel (recommended: 20) using `p-limit`. Each check is a HEAD request with 10s timeout, falling back to GET if HEAD returns 405.

**When to use:** Any time you're checking 100+ URLs — unconstrained concurrency will exhaust file descriptors and trigger rate limiting on target servers.

**Trade-offs:** At concurrency=20, 1000 URLs takes roughly 10-20 minutes depending on response times. Lower concurrency is more polite to servers; higher risks getting IP-blocked.

```typescript
import pLimit from 'p-limit';

const limit = pLimit(20);

async function checkAll(nodes: BookmarkNode[], onProgress: (n: number) => void) {
  let done = 0;
  const tasks = nodes.map(node =>
    limit(async () => {
      node.linkStatus = await checkUrl(node.url!);
      onProgress(++done);
    })
  );
  await Promise.all(tasks);
}
```

### Pattern 4: Command-Based Client State with Undo Stack

**What:** User edits to the proposed tree are expressed as `EditCommand` objects. The client maintains an array of applied commands. Each command is also sent to the server so server state stays in sync.

**When to use:** Any UI where users need undo/redo.

**Trade-offs:** Requires the server to apply commands deterministically. The alternative (sending the full tree on every edit) is simpler but wasteful and makes conflict detection harder.

```typescript
// state/store.ts
interface Store {
  proposedTree: BookmarkNode;
  undoStack: EditCommand[];
  redoStack: EditCommand[];
}

function applyCommand(tree: BookmarkNode, cmd: EditCommand): BookmarkNode {
  // Returns new tree with command applied — pure function
}
```

---

## Data Flow

### Upload and Pipeline Flow

```
User drops file
    │
    ▼
POST /api/upload (multipart/form-data)
    │
    ▼
Parser → raw BookmarkNode tree (originalTree)
    │
    ├── session.store({ originalTree })
    │
    ▼
Deduplicator → deduped tree
    │
    ▼
Folder Merger (fuzzy name match) → merged tree
    │
    ▼
Link Checker (concurrent, with progress SSE) → annotated tree
    │   [each URL result emitted over SSE]
    ▼
Classifier → categorised tree
    │
    ▼
Restructurer → proposedTree (new hierarchy)
    │
    ├── session.store({ proposedTree })
    │
    ▼
SSE: { stage: 'done', pct: 100 }
    │
    ▼
Client: GET /api/tree → { originalTree, proposedTree }
    │
    ▼
Render both panels + compute diffStatus annotations
```

### Edit Flow (User Modifies Proposed Tree)

```
User drags node in right panel
    │
    ▼
EditCommand created (MOVE_NODE)
    │
    ├── applied locally to client store (optimistic)
    ├── pushed to undoStack
    │
    ▼
POST /api/edit { command }
    │
    ▼
Server applies command to proposedTree in session store
    │
    ▼
200 OK (or 409 conflict → client reverts)
```

### Export Flow

```
User clicks Export
    │
    ▼
GET /api/export
    │
    ▼
Server: serialize session.proposedTree → Netscape Bookmark HTML string
    │
    ▼
Response: Content-Disposition: attachment; filename="bookmarks-clean.html"
    │
    ▼
Browser downloads file
```

### State Management Summary

```
Server session store (source of truth)
    originalTree ──────────────────────► Left panel (read-only)
    proposedTree ──── GET /api/tree ───► Right panel initial render
                         ▲
                         │ POST /api/edit (each command)
                         │
    Client store (mirrors proposedTree)
        └── undoStack → undo sends inverse command
```

---

## Component Boundaries (What Talks to What)

| From | To | Protocol | Notes |
|------|----|----------|-------|
| Browser | Express API | REST (HTTP) | Upload, edit commands, export |
| Browser | Express SSE endpoint | EventSource | One-way progress stream |
| Pipeline Controller | Link Checker | In-process EventEmitter | Progress events for SSE relay |
| Link Checker | Internet URLs | HTTP/HTTPS | HEAD then GET fallback |
| Classifier | uClassify API | HTTPS REST | Optional; only for unrecognised domains |
| Exporter | Session Store | In-process function call | Reads `proposedTree`, returns string |
| Client Tree Panel | Client State Store | Direct call | Renders from store, dispatches commands |

**The pipeline stages communicate only through the `BookmarkNode` type** — no shared mutable state between stages. This is the most important boundary to maintain during implementation.

---

## Build Order (Phase Dependencies)

The components have hard dependencies that dictate build order:

```
1. shared/types.ts              ← Everything depends on this. Build first.
   └── BookmarkNode, EditCommand, PipelineProgress

2. Parser                       ← Nothing runs without a tree
   └── Requires: types.ts

3. Session Store + API skeleton ← Other stages need somewhere to put results
   └── Requires: types.ts

4. Exporter                     ← Can be built/tested before pipeline completes
   └── Requires: types.ts, Parser (to round-trip test)

5. Deduplicator + Folder Merger ← Pure functions, easily testable in isolation
   └── Requires: types.ts, Parser (for test fixtures)

6. Link Checker                 ← Longest-running stage; build next so it can be tested
   └── Requires: types.ts, p-limit

7. Classifier                   ← Depends on Link Checker (reuses fetched metadata)
   └── Requires: types.ts, Link Checker results

8. Restructurer                 ← Depends on Classifier (needs categories)
   └── Requires: types.ts, Classifier results

9. Pipeline Orchestrator        ← Wires stages 2–8 in sequence + emits SSE
   └── Requires: all pipeline stages

10. SSE Progress Endpoint       ← Thin Express route; requires Orchestrator
    └── Requires: Pipeline Orchestrator

11. Frontend Tree Panel (read-only) ← Unblocked after API/types exist
    └── Requires: types.ts, GET /api/tree

12. Frontend Edit Controls      ← Requires read-only panel + edit commands
    └── Requires: Tree Panel, POST /api/edit

13. Diff Highlight Annotation   ← Last because it needs both trees complete
    └── Requires: both panels rendered
```

**Recommended phase split:**
- **Phase 1:** types.ts + Parser + Exporter + round-trip test (bookmarks in → bookmarks out)
- **Phase 2:** Deduplicator + Folder Merger + Session Store + basic API skeleton + read-only tree display
- **Phase 3:** Link Checker + SSE progress endpoint + progress bar in UI
- **Phase 4:** Classifier + Restructurer + proposed tree display
- **Phase 5:** Edit controls (drag/rename/merge/delete) + undo + diff highlights + export button

---

## Scaling Considerations

This is a local single-user tool. Scaling is not a concern. However, there are practical size limits:

| Concern | Reality | Mitigation |
|---------|---------|------------|
| Memory | A 50,000-bookmark file as a JS object tree: ~50–100 MB | Fine for local use; Node.js default heap is 1.5 GB |
| Link checking time | 1,000 URLs at concurrency=20: ~10–20 min | Show progress; allow export of partial results |
| Link checking time | 10,000 URLs at concurrency=20: ~2–4 hours | Consider persisting results to disk (SQLite or JSON) so a crash doesn't lose progress |
| Browser rendering | 10,000 nodes in DOM simultaneously | Use virtual scrolling (only render visible nodes); collapse folders by default |

---

## Anti-Patterns

### Anti-Pattern 1: Mutating the Original Tree

**What people do:** Pass the parsed tree through each pipeline stage and mutate nodes in place.

**Why it's wrong:** The original tree must remain intact for the side-by-side UI. If stages mutate it, you either need to deep-clone upfront (expensive) or you cannot show the original.

**Do this instead:** Return new tree nodes from each stage (`{ ...node, linkStatus: 'dead' }`). Structural sharing means unchanged subtrees are the same object references — memory cost is minimal.

### Anti-Pattern 2: Storing Full Tree in Every Edit Response

**What people do:** After each edit command (drag, rename), return the entire `proposedTree` as the API response body.

**Why it's wrong:** A 10,000-node tree serialised to JSON on every drag interaction creates noticeable latency and makes undo hard to reason about.

**Do this instead:** Return `{ ok: true }` for successful edits. The client applies the command locally (optimistic update) and only re-fetches the full tree on hard reload or conflict.

### Anti-Pattern 3: WebSocket for One-Way Progress

**What people do:** Reach for WebSocket because "it's real-time."

**Why it's wrong:** WebSocket is a bidirectional protocol requiring a handshake upgrade. For server → client-only progress reporting, it adds complexity (library on server, reconnect logic) with no benefit.

**Do this instead:** SSE. It is plain HTTP, supported natively in every browser via `EventSource`, auto-reconnects, works through HTTP/1.1 proxies, and requires zero client libraries.

### Anti-Pattern 4: Running the Full Pipeline Synchronously Before Responding

**What people do:** `POST /api/upload` → run all 5 pipeline stages → return finished trees.

**Why it's wrong:** Link checking 1,000+ URLs takes minutes. A synchronous response will time out in any real HTTP client.

**Do this instead:** Return `202 Accepted` immediately after upload + parse. The pipeline runs in the background. The client opens the SSE stream to track progress and fetches the result tree only when it receives the `done` event.

### Anti-Pattern 5: One Flat List Instead of a Tree

**What people do:** Flatten the bookmark hierarchy into an array of links for processing simplicity.

**Why it's wrong:** Folder structure is the core output. The restructurer needs to produce a hierarchy, and the UI shows a tree. Flattening and re-nesting is error-prone and loses intermediate folder data needed for the merger.

**Do this instead:** Keep the `BookmarkNode` tree shape throughout the entire pipeline. Pass folder context along during recursive walks.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Target URLs (link check) | HEAD/GET with 10s timeout | Use `AbortController`; retry once on timeout; mark redirect chains |
| uClassify API | REST GET with URL-encoded text | Free tier: 1,000 classifications/day; only call for unrecognised domains; cache results |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Pipeline stages | Function call, returns new BookmarkNode tree | Synchronous except Link Checker (async) |
| Pipeline → SSE route | Node.js EventEmitter | Controller emits 'progress'; SSE route subscribes |
| API routes → Session Store | Direct import (single process) | Fine for local tool; would need Redis for multi-user |
| Client → Server (edits) | REST POST with EditCommand JSON body | Keep idempotent where possible |
| Client state → DOM | Direct function calls (no framework) | `sortable-tree` handles drag; custom code handles diff highlights |

---

## Sources

- [netscape-bookmark-tree (GitHub)](https://github.com/zmyjs/netscape-bookmark-tree) — tree structure verified from README
- [netscape-bookmarks-parser (JSR)](https://jsr.io/@grakeice/netscape-bookmark-parser) — actively maintained alternative
- [SSE vs WebSocket comparison (RxDB)](https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html) — protocol selection rationale
- [SSE with Express.js (amd.codes)](https://amd.codes/posts/real-time-updates-with-sse-and-express-js) — implementation pattern
- [better-sse (npm)](https://www.npmjs.com/package/better-sse) — zero-dependency SSE helper if needed
- [sortable-tree (GitHub)](https://github.com/marcantondahmen/sortable-tree) — vanilla TypeScript drag-drop tree
- [p-limit (npm)](https://www.npmjs.com/package/p-limit) — concurrency control for link checker
- [SSE comeback 2025 (portalZINE)](https://portalzine.de/sses-glorious-comeback-why-2025-is-the-year-of-server-sent-events/) — confirms SSE as current best practice

---
*Architecture research for: Local bookmark cleaner web app (Node.js + browser)*
*Researched: 2026-03-23*
