# Phase 8: Drag-and-Drop - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can drag folders to reorder them within the same parent level in the right review panel. Visual insertion line feedback during drag. Reordered position persists across page refresh. Right-click context menu must not conflict with drag interactions.

Scope is strictly same-parent folder reordering — cross-parent folder moves are already handled by the context menu (move op). Bookmark (link) rows are not draggable.
</domain>

<decisions>
## Implementation Decisions

### Drag API
- **D-01:** Use native HTML5 Drag API (`draggable="true"`, `dragstart`/`dragover`/`drop`/`dragend` events). No SortableJS, no `@alpinejs/sort` — both ruled out in prior phases. Reason: `renderTree()` uses imperative DOM (not Alpine `x-for` lists), making library integration awkward and the known `@alpinejs/sort` + nested list DOM sync bug (Alpine #4157) would corrupt the tree.

### Drop Indicator
- **D-02:** Show a 2px horizontal insertion line at valid drop positions — top half of a folder row = insert before that folder, bottom half = insert after. No folder highlight or shading on hover. This matches the VS Code / Finder / Linear pattern and unambiguously means "insert between" rather than "drop into."

### Drag Trigger
- **D-03:** The whole `div.tree-folder-header` row is draggable (Claude's discretion). No separate grab-handle icon. The header is already the click and contextmenu target — adding `draggable="true"` there keeps the DOM simple.

### Context Menu Conflict (DND-04)
- **D-04:** An `isDraggingNode: null | string` state property in the Alpine component tracks the node ID currently being dragged. While non-null, the `contextmenu` event handler on `div.tree-folder-header` is suppressed. Cleared on `dragend` and `drop`. This prevents accidental context menu popups when finishing a drag near a folder row.

### Reorder API
- **D-05:** Extend `/api/edit` with a new `op: 'reorder'` operation (`{op: 'reorder', nodeId, parentFolderId, newIndex}`). Consistent with the existing delete/move/keep pattern — same route, same editOp() client call, same treeOps.js pure-function approach. A new `reorderNode(root, nodeId, parentFolderId, newIndex)` function is added to `src/shared/treeOps.js`.

### Session Persistence (DND-03)
- **D-06:** Reorder ops are saved to `session.classifiedTree` on the server (same as delete/move/keep). On page refresh the client refetches from the server, so order is preserved for the duration of the review workflow. No localStorage or sessionStorage — the in-memory Node.js session already covers this.

### Drag Scope
- **D-07:** Folder rows only. `draggable="true"` is set only on `div.tree-folder-header` elements inside `renderTree()`. Link rows (`div.tree-node.tree-link`) remain non-draggable. Same-parent constraint enforced by comparing `parentFolderId` at drop time.

### Claude's Discretion
- CSS for the insertion line (height, color, z-index, position: absolute vs border trick)
- Whether drag ghost image is customised or uses browser default
- Exact `getBoundingClientRect()` midpoint logic for top/bottom zone calculation
- `stopPropagation` strategy for nested folder dragover events
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DND-01 through DND-04 (the four drag-and-drop requirements with acceptance criteria)

### Key Source Files
- `public/app.js` — `renderTree()` (line 15), `getTreeOptions()` (line 431), `rerenderTree()` (line 463), `editOp()` (line 557), Alpine `bookmarkApp` state (line 203). This is the primary file for all drag changes.
- `src/shared/treeOps.js` — Pure tree mutation functions (`deleteNode`, `moveNode`, `markKeep`). New `reorderNode` goes here.
- `src/routes/edit.js` — `/api/edit` POST handler. Needs `op: 'reorder'` case added.

### Test Patterns
- `test/treeOps.test.js` — Existing unit tests for treeOps pure functions. New `reorderNode` tests follow this pattern.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderTree(node, container, depth, options)` — accepts an `options` object with callbacks (onContextMenu, onMerge, onToggleReclassify, etc.). Drag callbacks (onDragStart, onDragOver, onDrop, onDragEnd) fit naturally into this options pattern.
- `getTreeOptions()` — builds and returns the options object passed to renderTree. Drag callbacks added here will be automatically passed on every `rerenderTree()` call.
- `editOp(op, targetFolderId)` — existing client helper for `/api/edit`. Can be extended or a parallel `reorderOp(nodeId, parentFolderId, newIndex)` helper can be added.
- `session.classifiedTree` in `src/session.js` — the single source of truth for the classified tree. Reorder op mutates this, same as existing ops.

### Established Patterns
- Options-callback pattern: drag event handlers are passed into `renderTree()` via `options` object, not wired inline. Keeps `renderTree` portable and testable.
- Pure-function treeOps: `reorderNode(root, nodeId, parentFolderId, newIndex)` must be pure (no mutation) — same contract as `deleteNode`, `moveNode`, `markKeep`.
- structuredClone before mutation: `edit.js` always `structuredClone(session.classifiedTree)` before passing to treeOps functions.
- Alpine `$nextTick` for DOM updates: `rerenderTree()` uses `this.$nextTick()` — follow this for any re-render after a successful reorder API call.

### Integration Points
- `renderTree()` in `public/app.js` — add `draggable="true"` on `div.tree-folder-header` when `options.onDragStart` is present. Wire dragstart/dragover/drop/dragend listeners.
- `getTreeOptions()` — add drag callbacks: `onDragStart`, `onDragOver`, `onDrop`. These reference Alpine component methods via `this`.
- `src/routes/edit.js` — add `else if (op === 'reorder')` branch calling `reorderNode(...)`.
- `src/shared/treeOps.js` — add and export `reorderNode`.
- Alpine state in `bookmarkApp` — add `draggingNodeId: null` (tracks ID of node being dragged) and `dropTargetInfo: null` (tracks current drag-over position for insertion line placement).
- `resetApp()` — add `draggingNodeId: null` and `dropTargetInfo: null` to reset.
</code_context>

<specifics>
## Specific Ideas

- Drop indicator looks like: `▶ 📁 Design` / `|——————————  ← insert here (2px line)` / `▶ 📁 Finance` — a horizontal line between rows, not a border or background highlight on the row itself.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

Cross-parent folder drag (drag bookmark between folders) is explicitly Out of Scope per REQUIREMENTS.md — covered by context menu move op.
</deferred>

---
*Phase: 08-drag-and-drop*
*Context gathered: 2026-03-26*
