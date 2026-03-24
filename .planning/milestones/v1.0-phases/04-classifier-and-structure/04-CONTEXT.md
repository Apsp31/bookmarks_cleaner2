# Phase 4: Classifier and Structure - Context

**Gathered:** 2026-03-23 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Assign a category to every bookmark using a layered classification pipeline (domain rules map → OG/meta metadata already captured in Phase 3), then build a proposed `BookmarkNode` tree organised into a sensible 3-level-max folder hierarchy derived from the actual collection. No additional HTTP fetches. Output is a `classifiedTree` session field that Phase 5 uses for the before/after editor and final export.

</domain>

<decisions>
## Implementation Decisions

### Classification Data Source
- **D-01:** Classification uses two sources in priority order: (1) a built-in domain→category rules map keyed by `new URL(url).hostname`, then (2) `BookmarkNode.metadata` fields (`og:title`, `og:description`, `<meta name="description">`) already captured by Phase 3's link checker.
- **D-02:** No additional HTTP fetches in Phase 4. For HEAD-only successes where `metadata` is absent (D-18 in Phase 3 CONTEXT), the domain rules map is the sole classifier — if it also misses, the bookmark lands in "Other".
- **D-03:** Domain rules map is a plain JS object/Map (or JSON file) with ~50–100 well-known hostnames. Examples from requirements: `github.com → Development`, `youtube.com → Video`, `reddit.com → Community`. Map covers the most common domains; OG metadata handles the long tail.

### Taxonomy Design
- **D-04:** Top-level category set is **not** a fixed imposed list — it is derived from the actual classification results. After all bookmarks are classified, categories with 0 members are dropped; the hierarchy reflects what's actually in the collection.
- **D-05:** A sensible starter set of category labels (informed by REQUIREMENTS.md examples and PROJECT.md): `Development`, `Video`, `Social / Community`, `News`, `Shopping`, `Tools`, `Reference`, `Design`, `Finance`, `Learning`. Phase 4 uses these as the target labels from the domain rules map and OG-based classification.
- **D-06:** Bookmarks where neither domain rules nor metadata yields a confident category are placed in `Other`. "Other" only appears in the proposed hierarchy if at least one bookmark lands there.
- **D-07:** Sub-categories (level 2 and 3) emerge from the collection, not from a predefined tree. For example, if the classifier produces enough `Development` bookmarks with OG metadata suggesting `GitHub`, `Documentation`, `Tools` sub-themes, the hierarchy builder groups them accordingly. Simple keyword matching on the category/metadata fields is sufficient for v1.
- **D-08:** Max folder depth is 3 levels (root → category → sub-category) — hard constraint from PROJECT.md Constraints. The hierarchy builder must not produce deeper nesting.
- **D-09:** Single-bookmark categories are kept as-is in the proposed hierarchy (not collapsed). Phase 5 lets the user reorganise manually.

### Session State Extension
- **D-10:** `src/session.js` gains a `classifiedTree` field (initially `null`), following the immutable-stage pattern.
- **D-11:** Export priority chain in `src/routes/export.js` extended to: `classifiedTree → checkedTree → cleanTree → tree`.
- **D-12:** `BookmarkNode.category` field (already stubbed in `src/shared/types.js`) is populated during classification. This field carries the assigned top-level category label.

### Route and Module Boundaries
- **D-13:** New module `src/classifier.js` implements the classification pipeline: domain rules lookup → OG/meta extraction from `node.metadata` → fallback to "Other". Independently testable, no Express dependency.
- **D-14:** New module `src/hierarchyBuilder.js` takes the classified tree (nodes annotated with `category`) and produces a new `BookmarkNode` tree organised by category folders. Max depth enforced here.
- **D-15:** New route `src/routes/classify.js` exports a `Router` with `POST /classify` — reads `session.checkedTree` (or `cleanTree` fallback), runs classification + hierarchy building, writes `session.classifiedTree`, returns `classifiedTree` as JSON. Mounted at `/api` in `server.js`.
- **D-16:** TDD first: write unit tests for `classifier.js` (domain rules, OG fallback, unknown fallback) and `hierarchyBuilder.js` (max depth, empty category pruning, single-item categories) before implementation.

### Frontend Trigger
- **D-17:** A "Classify Bookmarks" button triggers `POST /api/classify`. The response `classifiedTree` is stored in Alpine state and rendered in the existing tree panel (reusing `renderTree()`). No new UI components needed — Phase 5 delivers the full before/after view.
- **D-18:** Simple loading state during classification (same pattern as "Run Cleanup" in Phase 2: disable button, show spinner text). No SSE needed — classification is in-memory and fast (no network I/O).

### Claude's Discretion
- Exact domain rules map entries beyond the ~10 examples from requirements (fill to ~50–100 common domains)
- OG-to-category keyword matching heuristics (title/description scanning for category keywords)
- Sub-category naming within a top-level category
- Whether to persist `classifiedTree` to the session or recompute on each classify call

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Classification — CLASS-01, CLASS-02 (exact acceptance criteria)
- `.planning/REQUIREMENTS.md` §Structure — STRUCT-01, STRUCT-02 (hierarchy constraints)
- `.planning/ROADMAP.md` §Phase 4 — Success criteria

### Prior phase context (locked decisions)
- `.planning/phases/03-link-checker/03-CONTEXT.md` — D-16/D-17/D-18/D-19: OG metadata capture spec, what's in `BookmarkNode.metadata`, when metadata is absent
- `.planning/phases/02-core-cleanup/02-CONTEXT.md` — D-07: immutable-stage pattern, session field naming conventions
- `.planning/phases/01-foundation/01-CONTEXT.md` — router-per-file, ESM, Alpine.js + vanilla JS constraint

### Source files to read before implementing
- `src/shared/types.js` — `BookmarkNode` typedef: `category` field stub, `metadata` field, `linkStatus`
- `src/session.js` — current session state to extend with `classifiedTree`
- `src/linkChecker.js` — how `metadata` is populated (lines 48–64 per subagent analysis)
- `src/routes/export.js` — current priority chain to extend
- `server.js` — where new `classify.js` route is mounted

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/types.js`: `BookmarkNode.category` field already stubbed for Phase 4 population; `BookmarkNode.metadata` holds `{og:title, og:description, og:image, description}` for HTML pages
- `src/session.js`: Module-level singleton — extend with `classifiedTree: null`
- `src/routes/export.js`: Priority chain pattern to extend with `classifiedTree`
- `public/app.js`: `renderTree()` vanilla JS renderer is reusable; Alpine state needs `classifiedTree` and `isClassifying` fields

### Established Patterns
- **Immutable stages**: Classification reads `checkedTree`, produces new `classifiedTree` — never mutates inputs
- **Router-per-file**: `src/routes/classify.js` exports a `Router`, mounted in `server.js`
- **Logic-in-module**: Business logic in `src/classifier.js` + `src/hierarchyBuilder.js`, not inline in routes
- **TDD**: Prior phases wrote unit tests first (Phase 1: parser tests; Phase 2: dedup/normalisation tests; Phase 3: checkUrl/buildCheckedTree mocked tests)
- **ESM throughout**: `import`/`export`, `"type": "module"` in `package.json`

### Integration Points
- `server.js`: `import classifyRouter from './src/routes/classify.js'` and `app.use('/api', classifyRouter)`
- `src/session.js`: Add `classifiedTree: null` field
- `src/routes/export.js`: Check `session.classifiedTree` first in priority chain
- `public/app.js`: Add `classifiedTree`, `isClassifying` Alpine state; trigger via `POST /api/classify`; render with existing `renderTree()`

</code_context>

<specifics>
## Specific Ideas

- REQUIREMENTS.md CLASS-01 cites: github.com→Development, youtube.com→Video, reddit.com→Community as canonical examples — domain rules map must cover at least these.
- PROJECT.md "Constraints" section explicitly states max 3 levels deep — enforced in `hierarchyBuilder.js` as a hard cap, not just a guideline.
- No extra fetches: Phase 3's D-18 (03-CONTEXT.md) notes HEAD-only successes have no metadata. Phase 4 must gracefully degrade to domain-rules-only for these (already captured in D-02 above).

</specifics>

<deferred>
## Deferred Ideas

- **uClassify text API fallback** (CLASS-04 in v2 requirements): Free text classification API for bookmarks unclassified by domain rules or OG metadata. Explicitly deferred to v2 in REQUIREMENTS.md.
- **Configurable similarity threshold** (CLASS-05): v2 requirement.
- **Dynamic taxonomy inference from bookmark text** (LLM-powered): Out of scope per REQUIREMENTS.md Out of Scope table — "LLM-powered categorization: API cost, rate limits, and latency for 1000+ bookmarks".
- **Re-classification trigger**: If user edits the proposed structure in Phase 5, should classification re-run? This is Phase 5 scope.

None — discussion stayed within Phase 4 scope.
</deferred>

---

*Phase: 04-classifier-and-structure*
*Context gathered: 2026-03-23*
