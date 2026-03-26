# Phase 8: Drag-and-Drop - Research

**Researched:** 2026-03-26
**Domain:** Native HTML5 Drag and Drop API, Alpine.js imperative DOM integration, pure tree mutation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use native HTML5 Drag API (`draggable="true"`, `dragstart`/`dragover`/`drop`/`dragend` events). No SortableJS, no `@alpinejs/sort` — both ruled out. Reason: `renderTree()` uses imperative DOM (not Alpine `x-for` lists), making library integration awkward and the known `@alpinejs/sort` + nested list DOM sync bug (Alpine #4157) would corrupt the tree.
- **D-02:** Show a 2px horizontal insertion line at valid drop positions — top half of a folder row = insert before that folder, bottom half = insert after. No folder highlight or shading on hover.
- **D-03:** The whole `div.tree-folder-header` row is draggable. No separate grab-handle icon.
- **D-04:** An `isDraggingNode: null | string` state property tracks the node ID currently being dragged. While non-null, the `contextmenu` event handler is suppressed on `div.tree-folder-header`. Cleared on `dragend` and `drop`.
- **D-05:** Extend `/api/edit` with `op: 'reorder'` (`{op: 'reorder', nodeId, parentFolderId, newIndex}`). New `reorderNode(root, nodeId, parentFolderId, newIndex)` pure function in `src/shared/treeOps.js`.
- **D-06:** Reorder ops saved to `session.classifiedTree` on the server (same as delete/move/keep). No localStorage or sessionStorage.
- **D-07:** Folder rows only — `draggable="true"` on `div.tree-folder-header` elements only. Link rows non-draggable. Same-parent constraint enforced at drop time by comparing `parentFolderId`.

### Claude's Discretion

- CSS for the insertion line (height, color, z-index, position: absolute vs border trick)
- Whether drag ghost image is customised or uses browser default
- Exact `getBoundingClientRect()` midpoint logic for top/bottom zone calculation
- `stopPropagation` strategy for nested folder dragover events

### Deferred Ideas (OUT OF SCOPE)

- Cross-parent folder drag (context menu move op covers this)
- Drag bookmark (link) rows between folders
- Touch/mobile drag support
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DND-01 | User can drag folders to reorder them within the same parent level in the review tree UI | Native drag API on `div.tree-folder-header`; `renderTree()` options-callback pattern accommodates drag handlers; `reorderNode` pure function enables immutable state update |
| DND-02 | Drop targets are visually highlighted during drag; invalid targets are not highlighted | `dragover` event + `getBoundingClientRect()` midpoint for insertion line position; `preventDefault()` on valid targets only; same-parent check gates drop acceptance |
| DND-03 | Reorder persists to session (survives page refresh during the review workflow) | `/api/edit` `op: 'reorder'` saves to `session.classifiedTree`; client refetches on page load via existing pattern |
| DND-04 | Drag interactions do not conflict with existing right-click context menu | `isDraggingNode` Alpine state property suppresses `contextmenu` handler while drag is active; cleared on `dragend`/`drop` |
</phase_requirements>

---

## Summary

Phase 8 adds same-parent folder drag-and-drop reordering to the right review panel. All implementation decisions were locked in the context session. The domain is native HTML5 Drag API wired into an imperative DOM tree renderer (`renderTree()`) — no library is needed and none is permitted.

The key technical challenge is the nested-tree `dragover` event bubble: a `dragover` on a child folder will bubble up through all ancestor folder headers, causing spurious insertion lines at each ancestor level. The correct mitigation is `e.stopPropagation()` inside the `dragover` handler so each folder row only responds to drags directly over itself. This must be tested with 2–3 levels of nesting.

The second challenge is insertion-line positioning: the indicator must be an absolutely-positioned overlay element (not a CSS border on the row itself) because changing the row's border-top or border-bottom shifts layout and causes jitter during drag. A `div.drop-indicator` element with `position: absolute; height: 2px; pointer-events: none` positioned via `top` relative to the nearest `position: relative` ancestor avoids layout reflow.

**Primary recommendation:** Wire drag events through `renderTree()` options callbacks (same pattern as `onContextMenu`), implement `reorderNode` as a pure function parallel to `moveNode`, and use a single detached `div.drop-indicator` element repositioned on each `dragover` rather than per-row indicator elements.

---

## Standard Stack

### Core (no new dependencies required)

| Technology | Version | Purpose | Why Sufficient |
|------------|---------|---------|---------------|
| Native HTML5 Drag API | Browser built-in | Drag source + drop target events | Already decided (D-01); all modern browsers support it; no npm install needed |
| Alpine.js 3.x (CDN) | Already loaded | State tracking (`isDraggingNode`, `dropTargetInfo`) | Already in use; `x-data` component methods handle drag callbacks |
| Node.js built-in (no new dep) | — | Server-side `reorderNode` in `treeOps.js` | Pure JS function; no library needed |

No new npm packages are required for this phase.

### What NOT to Add

| Avoid | Why |
|-------|-----|
| SortableJS | Ruled out (D-01) — incompatible with imperative DOM in `renderTree()` |
| `@alpinejs/sort` | Ruled out (D-01) — known bug Alpine #4157 with nested lists |
| Any drag library | Plain HTML5 drag API is sufficient for same-parent reorder of ~10–50 items |

---

## Architecture Patterns

### Pattern 1: Options-Callback for Drag Events (existing pattern, extend it)

`renderTree(node, container, depth, options)` already accepts callbacks via the `options` object (`onContextMenu`, `onMerge`, `onToggleReclassify`, etc.). Drag handlers follow the same convention.

**What to add to `getTreeOptions()`:**
```javascript
// Source: existing pattern in public/app.js lines 431-459
opts.onDragStart = (node, e) => this.handleDragStart(node, e);
opts.onDragOver  = (node, e, el) => this.handleDragOver(node, e, el);
opts.onDrop      = (node, e) => this.handleDrop(node, e);
opts.onDragEnd   = ()         => this.handleDragEnd();
```

**What to add in `renderTree()` for folder headers (gated on `options.onDragStart`):**
```javascript
if (options.onDragStart) {
  header.setAttribute('draggable', 'true');
  header.dataset.nodeId = node.id;
  header.addEventListener('dragstart', (e) => options.onDragStart(node, e));
  header.addEventListener('dragover',  (e) => options.onDragOver(node, e, header));
  header.addEventListener('drop',      (e) => options.onDrop(node, e));
  header.addEventListener('dragend',   ()  => options.onDragEnd());
}
```

Gating on `options.onDragStart` means the classified (right) panel gets drag behaviour while the left read-only panel does not — matching the existing `reviewMode` gating pattern.

### Pattern 2: Single Shared Drop Indicator Element

Create one `div#drop-indicator` in the Alpine component (or as a detached DOM element) rather than one per row. On `dragover`, compute its `top` position and make it visible. On `dragleave`/`dragend`/`drop`, hide it.

**Why:** Per-row indicator elements multiply with tree size, require cleanup on re-render, and fight layout. A single absolutely-positioned overlay element avoids these problems entirely.

```javascript
// Initialise once (e.g. in init())
this._dropIndicator = document.createElement('div');
this._dropIndicator.id = 'drop-indicator';
this._dropIndicator.style.cssText =
  'position:fixed;height:2px;background:#4a90d9;pointer-events:none;display:none;z-index:1000;left:0;right:0';
document.body.appendChild(this._dropIndicator);
```

Position on `dragover`:
```javascript
const rect = targetHeader.getBoundingClientRect();
const midY = rect.top + rect.height / 2;
const insertBefore = e.clientY < midY;
const lineY = insertBefore ? rect.top : rect.bottom;
this._dropIndicator.style.top = lineY + 'px';
this._dropIndicator.style.display = 'block';
```

Cleanup on `dragend` / `drop`:
```javascript
this._dropIndicator.style.display = 'none';
```

### Pattern 3: Pure `reorderNode` Function (mirrors existing treeOps pattern)

All existing treeOps functions (`deleteNode`, `moveNode`, `markKeep`) are pure — they take a root and return a new root without mutating. `reorderNode` must follow the same contract.

```javascript
// src/shared/treeOps.js — new export
export function reorderNode(root, nodeId, parentFolderId, newIndex) {
  function reorder(node) {
    if (node.type !== 'folder') return node;
    if (node.id === parentFolderId) {
      const children = (node.children ?? []).slice();
      const fromIndex = children.findIndex(c => c.id === nodeId);
      if (fromIndex === -1) return node; // node not in this parent — no-op
      const [item] = children.splice(fromIndex, 1);
      const adjustedIndex = Math.max(0, Math.min(newIndex, children.length));
      children.splice(adjustedIndex, 0, item);
      return { ...node, children };
    }
    return { ...node, children: (node.children ?? []).map(reorder) };
  }
  return reorder(root);
}
```

**Key insight:** `newIndex` is the target index in the parent's children array **after the source node has been removed**. The client must compute this correctly: if dragging from position 0 to after position 3 in a 5-item list, the splice-then-insert means the effective `newIndex` is 2 (positions shift after removal).

### Pattern 4: `/api/edit` Extension for `op: 'reorder'`

`edit.js` follows a simple if/else chain. Add:

```javascript
// src/routes/edit.js
} else if (op === 'reorder') {
  const { parentFolderId, newIndex } = req.body;
  if (!parentFolderId || newIndex === undefined || newIndex === null) {
    return res.status(400).json({ error: 'parentFolderId and newIndex are required for reorder.' });
  }
  updated = reorderNode(structuredClone(session.classifiedTree), nodeId, parentFolderId, Number(newIndex));
```

Import `reorderNode` alongside the existing imports at the top of `edit.js`.

### Pattern 5: Alpine State Additions

Add to the `bookmarkApp` data object:

```javascript
draggingNodeId: null,      // string | null — ID of the folder being dragged
draggingParentId: null,    // string | null — parent folder ID of the drag source
dropTargetNodeId: null,    // string | null — ID of the folder row currently under cursor
dropInsertBefore: null,    // boolean | null — true = insert before target, false = after
```

Add to `resetApp()`:
```javascript
this.draggingNodeId = null;
this.draggingParentId = null;
this.dropTargetNodeId = null;
this.dropInsertBefore = null;
```

### Pattern 6: Context Menu Suppression (DND-04)

The `contextmenu` event on `div.tree-folder-header` is already wired via `options.onContextMenu`. The `openContextMenu` Alpine method must check the drag guard:

```javascript
openContextMenu(node, event) {
  if (this.draggingNodeId !== null) return; // Suppress during active drag
  event.preventDefault();
  this.showMoveMenu = false;
  this.contextMenu = { visible: true, x: event.clientX, y: event.clientY, node };
},
```

### Anti-Patterns to Avoid

- **Mutating `dragover` indicator via row CSS borders:** Changing `border-top`/`border-bottom` on the hovered row causes layout reflow and jitter on every `mousemove` during drag. Use an absolutely-positioned overlay instead.
- **Attaching `dragover` to the container instead of each row:** Container-level `dragover` fires even when the mouse is between rows (not over any specific row), making insertion-point calculation ambiguous. Row-level handlers with `stopPropagation` are precise.
- **Not calling `e.preventDefault()` in `dragover`:** The browser will show a "not allowed" cursor and the `drop` event will never fire if `dragover` does not call `preventDefault()`. This is the most common pitfall.
- **Using `dragenter` for insertion line position:** `dragenter` fires once when entering an element; `dragover` fires continuously. Position calculation must use `dragover` so the line updates as the cursor moves within the row's top/bottom halves.
- **Not cleaning up on `dragend`:** If the user drops outside a valid target, `drop` never fires. `dragend` always fires on the source element — it is the correct place to clear state and hide the indicator.
- **newIndex off-by-one:** When computing `newIndex` to send to the server: the source item is removed from the list first, then inserted. If dragging from index `i` to after item at index `j` (where `j > i`), the adjusted index is `j` (not `j+1`) because removal of item `i` shifts everything above it down by one.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop reorder | Custom pointer-event tracking (mousemove + mouseup) | Native HTML5 Drag API | Built-in, no deps, handles ghost image, cursor states, accessibility affordances |
| Concurrency / debouncing | Manual timers for rapid drop events | N/A — only one drop fires | The `drop` event fires once; no debounce needed for the API call |
| Parent ID lookup at drop time | Complex tree traversal in the event handler | Store `parentFolderId` in `data-*` attribute on the header or in Alpine state during `dragstart` | Trivial to capture at dragstart when you have the node reference |

---

## Common Pitfalls

### Pitfall 1: `dragover` Must Call `preventDefault()` or `drop` Never Fires

**What goes wrong:** The `drop` event fires only if `dragover` on the same element called `e.preventDefault()`. Without it, the browser treats the element as a "not a drop target" and the cursor shows the forbidden symbol.
**Why it happens:** HTML5 drag default behaviour prevents drop except on `<input>` and `<textarea>`. All other elements must opt in.
**How to avoid:** In every `dragover` handler, call `e.preventDefault()` — but only on valid drop targets (same parent). For invalid targets (different parent), do NOT call `preventDefault()`, which naturally shows the "no drop" cursor.
**Warning signs:** Drop event never fires; `dragleave` fires immediately after `dragover`.

### Pitfall 2: Nested Tree `dragover` Bubble Causes Multiple Insertion Lines

**What goes wrong:** Dragging over a deeply-nested folder fires `dragover` on that folder AND all its ancestors (event bubble). Each ancestor's handler repositions the indicator, causing flicker or showing the line at the wrong level.
**Why it happens:** DOM events bubble by default. The tree nests `div.tree-folder-header` elements inside `div.tree-children` inside other `div.tree-node` wrappers — the hierarchy is real in the DOM.
**How to avoid:** Call `e.stopPropagation()` in the `dragover` handler. Only the innermost element the cursor is directly over should handle the event.
**Warning signs:** Insertion line appears at a parent level when cursor is over a child folder.

### Pitfall 3: `dragend` vs `drop` — Only One Fires Per Gesture

**What goes wrong:** Developer cleans up state in `drop` but not `dragend`, or vice versa. When the user drops outside a valid target, `drop` never fires but `dragend` always does. If only `drop` clears `draggingNodeId`, the context menu stays suppressed indefinitely.
**How to avoid:** Clear drag state in `dragend`. The `drop` handler can call its own cleanup too, but `dragend` is the safety net.
**Warning signs:** Context menu stops working after a cancelled drag.

### Pitfall 4: `newIndex` Off-by-One After Source Removal

**What goes wrong:** Client sends `newIndex: 3` meaning "insert at position 3 in the original array." But `reorderNode` removes the source first, shifting indices. If source was at index 1 and target is index 3, after removal the array has one fewer item, and the intended slot is now index 2.
**How to avoid:** `reorderNode` in treeOps handles this correctly if the implementation splices out first, then inserts at `newIndex`. The client computes `newIndex` as the index in the **original** array and the server function adjusts. Document this contract clearly in the function JSDoc.
**Alternative:** Client can compute `newIndex` in the post-removal array and send that. Either is fine — just be consistent and test both directions (drag up and drag down).

### Pitfall 5: Same-Parent Constraint Enforcement Gap

**What goes wrong:** `dragover` accepts the drop even when the dragged folder and the drop target have different parents. The `reorderNode` function would then silently no-op (node not found in parent's children).
**How to avoid:** At `dragstart`, store the parent folder ID in Alpine state (`this.draggingParentId`). In `dragover`, compare `draggingParentId` with the target's parent ID. Only call `e.preventDefault()` (accept the drop) when parent IDs match.
**Implementation note:** `parentFolderId` must be threaded into `renderTree()` for each node. Pass it as part of the drag callback parameters or as a `data-parent-id` attribute on the header.

### Pitfall 6: `draggable="true"` on a Child Element Interferes with Text Selection

**What goes wrong:** Setting `draggable="true"` on `div.tree-folder-header` also makes the text content inside it draggable. On some browsers, clicking to select text starts a drag instead.
**Why it happens:** `draggable="true"` captures all mouse press-and-move gestures.
**How to avoid:** This is acceptable for this use case — the folder titles are not user-editable text fields. However, be aware that the rename feature (if added later) would conflict with drag. No action needed for Phase 8 scope.

---

## Code Examples

### Verified Drag Event Wiring Pattern (from MDN HTML5 DnD spec)

```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
// Opt in the element as a drag source
header.setAttribute('draggable', 'true');

header.addEventListener('dragstart', (e) => {
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', node.id); // for cross-frame compat
  options.onDragStart(node, e);
});

// Opt in the element as a drop target (MUST call preventDefault)
header.addEventListener('dragover', (e) => {
  e.preventDefault();          // Without this, drop never fires
  e.stopPropagation();         // Without this, parent handlers also fire
  e.dataTransfer.dropEffect = 'move';
  options.onDragOver(node, e, header);
});

header.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  options.onDrop(node, e);
});

header.addEventListener('dragend', () => {
  options.onDragEnd();
});
```

### Verified Midpoint Zone Calculation

```javascript
// Top half = insert before, bottom half = insert after
handleDragOver(targetNode, e, targetHeader) {
  const rect = targetHeader.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  this.dropInsertBefore = e.clientY < midY;
  this.dropTargetNodeId = targetNode.id;

  // Position the indicator
  const lineY = this.dropInsertBefore ? rect.top : rect.bottom;
  this._dropIndicator.style.top = lineY + 'px';
  this._dropIndicator.style.left = rect.left + 'px';
  this._dropIndicator.style.width = rect.width + 'px';
  this._dropIndicator.style.display = 'block';
},
```

### `reorderNode` Pure Function (full implementation)

```javascript
// src/shared/treeOps.js
export function reorderNode(root, nodeId, parentFolderId, newIndex) {
  function reorder(node) {
    if (node.type !== 'folder') return node;
    if (node.id === parentFolderId) {
      const children = (node.children ?? []).slice();
      const fromIndex = children.findIndex(c => c.id === nodeId);
      if (fromIndex === -1) return { ...node, children: children.map(reorder) };
      const [item] = children.splice(fromIndex, 1);
      const clampedIndex = Math.max(0, Math.min(newIndex, children.length));
      children.splice(clampedIndex, 0, item);
      return { ...node, children };
    }
    return { ...node, children: (node.children ?? []).map(reorder) };
  }
  return reorder(root);
}
```

Note: `newIndex` here is the intended position in the **post-removal** array. The client must send the index adjusted for removal. Example: dragging from index 0 to after index 3 in a 5-element list → after removing index 0, the list has 4 elements and the correct `newIndex` is 3 (end of list effectively).

### Computing `newIndex` on the Client

```javascript
handleDrop(targetNode, e) {
  e.stopPropagation();
  this._dropIndicator.style.display = 'none';

  if (!this.draggingNodeId || !this.draggingParentId) return;
  if (targetNode.id === this.draggingNodeId) { this.handleDragEnd(); return; } // drop on self

  // Get parent's current children from classifiedTree
  const parentFolder = this.findNode(this.classifiedTree, this.draggingParentId);
  if (!parentFolder || parentFolder.type !== 'folder') { this.handleDragEnd(); return; }

  const children = parentFolder.children ?? [];
  const fromIndex = children.findIndex(c => c.id === this.draggingNodeId);
  const targetIndex = children.findIndex(c => c.id === targetNode.id);
  if (targetIndex === -1) { this.handleDragEnd(); return; }

  // Determine raw intended position
  let intendedIndex = this.dropInsertBefore ? targetIndex : targetIndex + 1;

  // Adjust for removal: if source is before the target, removal shifts everything down by 1
  const newIndex = intendedIndex > fromIndex ? intendedIndex - 1 : intendedIndex;

  this.reorderOp(this.draggingNodeId, this.draggingParentId, newIndex);
  this.handleDragEnd();
},
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SortableJS for tree DnD | Native HTML5 Drag API with imperative DOM | Decision locked in context session | No new dependency; better control over nested tree behaviour |
| Per-row indicator borders | Single shared `div#drop-indicator` overlay | Common pattern in VS Code, Linear, Finder UX | No layout jitter; single element to manage |

---

## Open Questions

1. **`parentFolderId` threading into `renderTree` callbacks**
   - What we know: `renderTree()` receives `node` in each callback. The node does not carry its own `parentFolderId` — nodes only know their children, not their parent.
   - What's unclear: The cleanest way to pass parent context into the drag callbacks without restructuring `renderTree()`.
   - Recommendation: Add a `parentId` parameter to each recursive `renderTree` call (defaulting to `null` at depth 0). Pass it as part of the `onDragStart(node, e, parentId)` callback signature. Alternatively, store `data-parent-id` on the header element at render time — this is readable in the `dragstart` event handler without changing the callback signature. The `data-*` attribute approach is lower coupling and avoids changing the function signature.

2. **Indicator width/positioning for deep nesting**
   - What we know: The insertion line should visually span the width of the folder row, which is indented based on depth.
   - What's unclear: Whether `position:fixed` with `getBoundingClientRect().left/width` values produces correct visual alignment across all nesting depths.
   - Recommendation: Use `position:fixed` with explicit `left` and `width` from `getBoundingClientRect()` on the header element. This is viewport-relative and correct regardless of scroll position or indent depth.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 8 is a code-only change with no external dependencies beyond what is already installed. No new npm packages are required. The test runner (`node --test`) is built into Node.js >=20 which is already required by `package.json`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config file | None — run via `npm test` → `node --test test/**/*.test.js` |
| Quick run command | `node --test test/treeOps.test.js` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DND-01 | `reorderNode` moves a node to new index within same parent | unit | `node --test test/treeOps.test.js` | ❌ Wave 0 (new tests in existing file) |
| DND-01 | `reorderNode` is a no-op when nodeId not found in parentFolderId's children | unit | `node --test test/treeOps.test.js` | ❌ Wave 0 |
| DND-01 | `reorderNode` clamps newIndex to valid range (0..length) | unit | `node --test test/treeOps.test.js` | ❌ Wave 0 |
| DND-02 | Drop on invalid target (different parent) does not trigger insertion line | manual | — | manual-only: requires browser drag gesture |
| DND-02 | Insertion line appears at top of row when cursor in upper half | manual | — | manual-only: requires browser drag gesture |
| DND-03 | `POST /api/edit {op:'reorder'}` updates `session.classifiedTree` and returns updated tree | unit/integration | `node --test test/treeOps.test.js` + manual API test | ❌ Wave 0 (treeOps unit) |
| DND-04 | Context menu suppressed while `draggingNodeId` is non-null | manual | — | manual-only: Alpine state interaction |

### Sampling Rate

- **Per task commit:** `node --test test/treeOps.test.js`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/treeOps.test.js` — add `reorderNode` describe block (file exists, needs new tests appended)
- [ ] No new test file needed — extend the existing `test/treeOps.test.js` pattern

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies to Phase 8 |
|-----------|-------------------|
| No framework lock-in, no build step | Confirmed — native drag API only, no new libraries |
| No API key required for core flow | Not applicable (no classification in this phase) |
| Folder depth max 3 levels | Not applicable (reorder does not change depth) |
| Self-contained, no data leaves machine | Confirmed — reorder is local session mutation only |
| No SortableJS / @alpinejs/sort | Confirmed locked — D-01 |
| No React/Vue/Svelte (no build step) | Confirmed — frontend remains Alpine.js CDN |
| No jQuery / jsTree | Confirmed — not considered |
| Express 5.2.1 for routes | `edit.js` extends existing Express router — no change to framework |
| `"type": "module"` in package.json | `reorderNode` exported with `export function` — ESM compliant |
| Node.js >=20 | No change — already required |

---

## Sources

### Primary (HIGH confidence)

- MDN Web Docs — HTML Drag and Drop API: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API — verified `dragover`/`dragstart`/`drop`/`dragend` event contract; confirmed `preventDefault()` requirement in `dragover`
- Existing codebase — `src/shared/treeOps.js` — verified pure-function contract (`deleteNode`, `moveNode`, `markKeep`) which `reorderNode` must match
- Existing codebase — `public/app.js` lines 431-460 — verified `getTreeOptions()` options-callback pattern that drag handlers extend
- Existing codebase — `src/routes/edit.js` — verified if/else op dispatch pattern that `op: 'reorder'` extends
- CONTEXT.md decisions D-01 through D-07 — all architectural choices are locked

### Secondary (MEDIUM confidence)

- Alpine.js discussion #4157 — `@alpinejs/sort` + nested list DOM sync bug (referenced in CONTEXT.md as the reason for ruling out the plugin; not independently re-verified but accepted as a project decision)

### Tertiary (LOW confidence)

- None — all findings are either from the locked CONTEXT.md decisions or directly from the codebase/MDN spec.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; uses existing MDN-documented browser APIs
- Architecture: HIGH — patterns directly extend the existing codebase's established options-callback and pure-function treeOps contracts
- Pitfalls: HIGH — `dragover`/`preventDefault` and event bubble issues are documented MDN behaviour; off-by-one for reorder is provable from the splice contract

**Research date:** 2026-03-26
**Valid until:** 2026-06-26 (browser drag API is extremely stable; no expiry concern)
