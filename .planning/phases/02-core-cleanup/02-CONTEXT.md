# Phase 2: Core Cleanup - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Deduplicate bookmarks and detect/propose folder merges — pure in-memory pipeline logic. No network calls, no classification. Output is a cleaned `BookmarkNode` tree ready for Phase 3's link checker. Phase 5 delivers the full before/after editor; Phase 2 adds only the minimal UI needed to review and confirm dedup results and folder merge proposals.

</domain>

<decisions>
## Implementation Decisions

### Cleanup Trigger
- **D-01:** Cleanup is manually triggered — user clicks a "Run Cleanup" button after the file is loaded and they've reviewed the raw tree. Does not auto-run on upload.

### Duplicate Bookmark Resolution
- **D-02:** When a URL appears multiple times after normalization, keep the **first occurrence** in a depth-first top-down tree walk. Simple and deterministic.
- **D-03:** URL normalization before comparison must handle all seven patterns from DEDUP-02: strip UTM/tracking params (`utm_*`, `fbclid`, `gclid`), normalize `www` prefix, strip trailing slash, normalize `http`/`https` — verified by unit tests.

### Folder Merge Confirmation UI
- **D-04:** Show ⚠️ badges **inline in the existing tree** next to folders with similar names. Each flagged pair gets per-row `[→ Merge into X]` and `[Keep separate]` buttons. Additionally, provide a **bulk "Approve all merges"** option so users with many candidates don't click every row.
- **D-05:** Fully duplicated folder subtrees (DEDUP-04) use the same inline pattern — flag in tree with merge/keep buttons and a bulk approve option.
- **D-06:** Fuzzy matching threshold for folder name similarity: use `fastest-levenshtein` distance; flag pairs where `distance(a, b) / max(a.length, b.length) ≤ 0.25` (i.e., ≤25% edit distance ratio). This is a fixed threshold for v1 (configurable threshold is v2 per REQUIREMENTS.md CLASS-05).

### Session Architecture
- **D-07:** Add `cleanTree` to the session store (`session.cleanTree`). The `Run Cleanup` API endpoint reads `session.tree`, applies dedup and proposes merges, and writes the deduped result to `session.cleanTree`. The export route exports `cleanTree` when present, falling back to `tree`. `session.tree` is never mutated — it remains the original parsed tree for the Phase 5 before/after view.
- **D-08:** After the `/api/cleanup` call, the API response includes: `cleanTree`, `stats` (duplicates removed count, duplicate subtrees found), and `mergeCandidates[]` (each with folder IDs, names, and similarity score). Merge confirmation is a separate `/api/merge` call.

### Claude's Discretion
- Exact fuzzy matching logic for subtree duplication (hash-based content fingerprint is fine)
- CSS styling of ⚠️ inline badges and merge/keep buttons
- Whether the "Run Cleanup" button appears in the stats bar or as a new action row

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Deduplication — DEDUP-01, DEDUP-02, DEDUP-03, DEDUP-04 (exact acceptance criteria)
- `.planning/PROJECT.md` — constraints, out-of-scope boundaries

### Stack
- `.planning/research/STACK.md` — `fastest-levenshtein` for folder name comparison (edit distance), ESM module pattern, Node >=20 requirement

### Prior Phase Decisions
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-11 (immutable tree stages, BookmarkNode type), D-07 (ESM, `"type": "module"`), D-08 (Express 5, router-per-file pattern)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/types.js` — `BookmarkNode` typedef; cleanup pipeline produces a new tree of the same type
- `src/session.js` — singleton session store; extend with `cleanTree: null` and `mergeCandidates: []`
- `src/parser.js` — `parseBookmarkHtml()` returns root `BookmarkNode`; cleanup takes this as input
- `src/routes/export.js` — reads `session.tree` today; update to prefer `session.cleanTree` when present
- `public/app.js` — `renderTree()` vanilla JS renderer; will need to support ⚠️ badge rendering for merge candidates; Alpine component needs new state (`cleanupStats`, `mergeCandidates`)

### Established Patterns
- Stages return new trees, never mutate (D-11 from Phase 1) — dedup must follow this
- ESM modules throughout (`import`/`export`, `"type": "module"`)
- Router-per-file pattern — cleanup and merge endpoints get their own route files mounted at `/api`
- Alpine.js component state for UI; vanilla JS for DOM rendering (tree renderer)

### Integration Points
- New route: `POST /api/cleanup` — reads `session.tree`, writes `session.cleanTree` + `session.mergeCandidates`, returns stats + merge candidates
- New route: `POST /api/merge` — applies confirmed merges to `session.cleanTree`, returns updated tree
- `src/routes/export.js` — add fallback: export `session.cleanTree ?? session.tree`
- `public/app.js` — new `status` states needed: `'cleaning'` and `'cleaned'`; `renderTree()` needs a flag to render in "merge review" mode with ⚠️ badges

</code_context>

<specifics>
## Specific Ideas

- Inline ⚠️ badges with per-row `[→ Merge into X]` and `[Keep separate]` buttons, plus a bulk "Approve all merges" option — user wants control per item AND a fast path for bulk approval.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 2 scope.

</deferred>

---

*Phase: 02-core-cleanup*
*Context gathered: 2026-03-23*
