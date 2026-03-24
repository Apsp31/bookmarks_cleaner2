# Phase 1: Foundation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Parse a Chrome bookmark HTML export, save a backup, and export a structurally intact file — establishing the file I/O contract. No cleaning, no link checking, no classification. Just: load → validate → export. Every subsequent phase builds on this round-trip confidence.

</domain>

<decisions>
## Implementation Decisions

### Upload Screen
- **D-01:** Landing page shows a drop zone plus a brief 2-3 line description of what the tool does (check links, merge folders, propose clean structure) — useful both for personal use and for sharing with others.
- **D-02:** Drop zone is the visual centrepiece — description is secondary text, not a feature list.

### Post-Load State
- **D-03:** After loading, show stats ("Loaded 1,234 bookmarks across 47 folders") plus a read-only collapsible tree of the original structure.
- **D-04:** The tree in Phase 1 is read-only and for orientation only — editing and before/after view are Phase 5. Keep it simple: folder nodes collapsible, leaf nodes show title + URL.

### Backup Delivery
- **D-05:** Immediately auto-download a copy of the original file to the user's Downloads folder when the file is loaded — browser-triggered download, no server persistence needed. Label it clearly (e.g., `bookmarks-backup-YYYY-MM-DD.html`).
- **D-06:** Show a visible confirmation after download: "Original saved to Downloads as bookmarks-backup-2026-03-23.html".

### Technical Decisions (from research — locked)
- **D-07:** ESM (`"type": "module"` in package.json), Node >=20 pinned — all imports use `import`, not `require`.
- **D-08:** Express 5.x for HTTP server. Single server file serves static frontend and API routes.
- **D-09:** Parse bookmark HTML with cheerio — DIY parser, no dedicated bookmark library (both npm options are unmaintained).
- **D-10:** Alpine.js loaded via CDN (no build step). Vanilla JS for DOM; no React/Vue/Svelte.
- **D-11:** `BookmarkNode` interface defined in `shared/types.js` — used on both server and client. Stages return new trees, never mutate.
- **D-12:** Round-trip test is a required success gate: parse original → export → re-parse export → assert identical bookmark and folder counts.

### Claude's Discretion
- Exact wording of the brief tool description on the landing page
- Drop zone visual styling (dashed border, icon, etc.)
- Tree expand/collapse UX details (expand-all button, initial collapse state)
- Server startup behaviour (auto-open browser vs. print URL) — use auto-open for convenience

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §File I/O — FILE-01, FILE-02, FILE-03 (exact acceptance criteria)
- `.planning/PROJECT.md` — project vision, constraints, out-of-scope boundaries

### Stack and Architecture
- `.planning/research/STACK.md` — library choices with versions and rationale (Express 5, Alpine.js, cheerio, p-limit, ESM)
- `.planning/research/ARCHITECTURE.md` — BookmarkNode data model, pipeline stage pattern, build order
- `.planning/research/PITFALLS.md` §Chrome format edge cases — unescaped `&` in titles, ADD_DATE format, DL/DT nesting, round-trip failure modes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. Phase 1 establishes all foundational patterns.

### Established Patterns
- None yet — Phase 1 defines the patterns all subsequent phases inherit (ESM module structure, Express route layout, BookmarkNode type, Alpine.js component pattern).

### Integration Points
- Phase 1 output: a working parse/export round-trip, a running Express server, a `BookmarkNode` tree in memory per session.
- Phase 2 will read the in-memory tree from Phase 1's session store and run deduplication on it.
- The `BookmarkNode` type defined here is the shared contract for all five phases.

</code_context>

<specifics>
## Specific Ideas

- Backup filename should include the date: `bookmarks-backup-YYYY-MM-DD.html` — makes it easy to find in Downloads.
- The basic tree shown post-load is orientation only; keep it simple. Full editable tree comes in Phase 5.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-23*
