# Phase 5: Editable UI - Context

**Gathered:** 2026-03-24 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can review the before/after tree, adjust the proposed structure, and export the final clean bookmark file. Delivers: side-by-side read-only original vs. editable proposed tree, right-click context menu (move/keep/delete), summary panel (dead links removed, duplicates removed, folders merged, total remaining), empty folder pruning, and final Netscape HTML export.

</domain>

<decisions>
## Implementation Decisions

### Before/After Layout Model
- **D-01:** The current single-panel `classified` screen in `public/index.html` is extended into a two-column layout (CSS grid or flexbox) — original structure on the left (read-only) and cleaned proposed structure on the right (interactive). Both columns are rendered via the existing `renderTree()` function called with separate Alpine `x-ref` containers (`leftPanel`, `rightPanel`).
- **D-02:** `renderTree()` signature already accepts any node as root — no changes to the renderer. Two separate calls with `this.tree` (left, read-only) and `this.classifiedTree` (right, interactive) cover the layout requirement.
- **D-03:** Left panel is strictly read-only — no event listeners attached; right panel receives all interactive event handlers (contextmenu, edit actions).

### Context Menu Editing & Mutation Model
- **D-04:** Right-click context menu is a single shared floating `<div>` positioned via JavaScript on `contextmenu` events — not per-node embedded elements. Standard approach to avoid embedding hidden elements into the tree DOM.
- **D-05:** Edit actions (move/keep/delete) sync to the server via a new `POST /api/edit` route following the router-per-file pattern (`src/routes/edit.js`). Route accepts an operation descriptor `{op: 'delete'|'move'|'keep', nodeId, targetFolderId?}` and returns the mutated `classifiedTree`. Server is source of truth; Alpine state is updated from the response.
- **D-06:** This sync is required because `src/routes/export.js` reads `session.classifiedTree` directly — client-only edits would be silently discarded on Export.
- **D-07:** "Keep" operation marks a bookmark with a `kept: true` flag on the node; it has no structural effect but may be used for visual indicator. Actual structural changes (move/delete) modify the tree shape.

### Summary Panel Data Source
- **D-08:** Summary panel aggregates from existing Alpine state — no new API endpoint needed:
  - Dead links removed: `this.deadCount` (set from SSE `done` event in Phase 3)
  - Duplicates removed: `this.cleanupStats.dupesRemoved` (from `/api/cleanup` in Phase 2)
  - Folders merged: derived from `this.mergeCandidates` length (Phase 2 data)
  - Total bookmarks remaining: traversal count of `this.classifiedTree`
- **D-09:** Summary panel is a static display panel, not interactive. Rendered via Alpine reactive state — updates automatically when `classifiedTree` changes.

### Empty Folder Pruning (CLASS-03)
- **D-10:** `pruneEmptyFolders(tree)` utility function is implemented in a new `src/shared/treeUtils.js` module, called inside `src/routes/export.js` before `exportToNetscape()`. This is the single choke point — catches any empties created by Phase 5 user edits (delete all bookmarks from a folder).
- **D-11:** `hierarchyBuilder.js` already guarantees no empty folders at classification time (D-04 in 04-CONTEXT.md). Pruning at export handles only the Phase 5 edit-induced case.
- **D-12:** Empty folder pruning is recursive — a folder containing only empty folders is also removed.

### Claude's Discretion
- Exact CSS layout values (column widths, panel heights, gap)
- Context menu visual styling (border, shadow, font)
- `kept: true` visual indicator design (icon, color)
- Node ID scheme for identifying nodes in edit operations (path-based, UUID, or index)
- Whether move operation uses drag-and-drop or a sub-menu of destination folders
- Test coverage scope for `src/routes/edit.js` and `src/shared/treeUtils.js`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Classification — CLASS-03 (empty folder removal acceptance criteria)
- `.planning/REQUIREMENTS.md` §UI — UI-01 (side-by-side view), UI-02 (context menu editing), UI-03 (summary panel)
- `.planning/ROADMAP.md` §Phase 5 — Success criteria (5 acceptance tests)

### Prior phase context (locked decisions)
- `.planning/phases/04-classifier-and-structure/04-CONTEXT.md` — D-17/D-18: classifiedTree Alpine state, frontend trigger pattern, renderTree reuse
- `.planning/phases/03-link-checker/03-CONTEXT.md` — D-19/D-20: deadCount from SSE, checkedTree
- `.planning/phases/02-core-cleanup/02-CONTEXT.md` — D-07: immutable-stage pattern, cleanupStats shape, mergeCandidates
- `.planning/phases/01-foundation/01-CONTEXT.md` — router-per-file, ESM, Alpine.js + vanilla JS constraint, renderTree pattern

### Source files to read before implementing
- `public/index.html` — current `classified` screen block (single panel to extend to two columns)
- `public/app.js` — Alpine state fields, renderTree(), existing interaction handlers
- `src/session.js` — session fields to understand what data survives across requests
- `src/routes/export.js` — priority chain, where pruneEmptyFolders() is inserted
- `src/routes/classify.js` — router pattern to replicate for edit.js
- `src/shared/types.js` — BookmarkNode typedef (category, metadata, linkStatus fields)
- `src/hierarchyBuilder.js` — how classifiedTree is structured (to understand node shape for edit ops)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderTree()` (`public/app.js` lines 15-161): Accepts any BookmarkNode as root, renders into a target container element. Call twice for side-by-side layout — no changes needed to the function.
- `this.deadCount` (`public/app.js` line 209): Set from SSE `done` event; direct use in summary panel.
- `this.cleanupStats` (`public/app.js` line 183): Shape `{dupesRemoved, ...}` set from `/api/cleanup` response.
- `this.mergeCandidates` (`public/app.js` line 187): Array from `/api/cleanup`; length = folders merged count.
- `src/routes/classify.js`: Router-per-file template for `src/routes/edit.js`.
- `src/routes/export.js`: Insert `pruneEmptyFolders()` call before `exportToNetscape()`.

### Established Patterns
- **x-init on element**: Alpine reactive init uses `x-init` on the element, not `$nextTick` (established Phase 2 fix — 02-CONTEXT.md decision)
- **Immutable stages**: Edit route reads `session.classifiedTree`, returns new mutated copy — never mutates the original
- **Logic-in-module**: `pruneEmptyFolders()` in `src/shared/treeUtils.js`, not inline in the route
- **Router-per-file**: `src/routes/edit.js` exports a `Router`, mounted at `/api` in `server.js`
- **TDD**: Tests for `pruneEmptyFolders()` and edit operations before implementation

### Integration Points
- `server.js`: `import editRouter from './src/routes/edit.js'` and `app.use('/api', editRouter)`
- `src/routes/export.js`: `import { pruneEmptyFolders } from '../shared/treeUtils.js'`; call before `exportToNetscape()`
- `public/index.html`: Extend `classified` status block with second panel div and Alpine ref
- `public/app.js`: Add `leftPanelRef`/`rightPanelRef` x-ref handling; floating context menu state; summary panel data bindings

</code_context>

<specifics>
## Specific Ideas

- ROADMAP.md Phase 5 success criteria item 4 explicitly requires empty folders absent from the *exported file* (not necessarily hidden in the UI during editing) — pruning at export time (D-10) directly satisfies this.
- ROADMAP.md item 2: context menu specifically says "move it, mark it as keep, or delete it" — these are the three operations for `POST /api/edit`.
- ROADMAP.md item 3: summary panel data points are explicit: "dead links removed, duplicates removed, folders merged, and total bookmarks remaining" — all four map to existing Alpine state (D-08).

</specifics>

<deferred>
## Deferred Ideas

- **Drag-and-drop reordering**: More complex move UX — the context menu sub-menu of destination folders is sufficient for v1. Drag-and-drop is a future enhancement.
- **Undo/redo history**: User can undo edit operations. Out of scope for Phase 5 — requires edit history stack.
- **Re-classification trigger after edits**: If user moves bookmarks between folders, should classification scores update? Deferred — Phase 5 is structural editing only, not re-classification.
- **Inline rename of folders/bookmarks**: UI-02 specifies move/keep/delete only; rename is not in scope.

None — discussion stayed within Phase 5 scope.
</deferred>

---

*Phase: 05-editable-ui*
*Context gathered: 2026-03-24*
