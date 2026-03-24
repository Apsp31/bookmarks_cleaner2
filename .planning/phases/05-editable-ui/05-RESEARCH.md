# Phase 5: Editable UI - Research

**Researched:** 2026-03-24
**Domain:** Alpine.js vanilla-JS UI extension, Express 5 route pattern, tree mutation algorithms
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Before/After Layout (D-01 to D-03)**
- The current single-panel `classified` screen in `public/index.html` is extended into a two-column layout (CSS grid or flexbox) — original structure on the left (read-only) and cleaned proposed structure on the right (interactive). Both columns are rendered via the existing `renderTree()` function called with separate Alpine `x-ref` containers (`leftPanel`, `rightPanel`).
- `renderTree()` signature already accepts any node as root — no changes to the renderer. Two separate calls with `this.tree` (left, read-only) and `this.classifiedTree` (right, interactive) cover the layout requirement.
- Left panel is strictly read-only — no event listeners attached; right panel receives all interactive event handlers (contextmenu, edit actions).

**Context Menu Editing & Mutation Model (D-04 to D-07)**
- Right-click context menu is a single shared floating `<div>` positioned via JavaScript on `contextmenu` events — not per-node embedded elements.
- Edit actions (move/keep/delete) sync to the server via a new `POST /api/edit` route following the router-per-file pattern (`src/routes/edit.js`). Route accepts `{op: 'delete'|'move'|'keep', nodeId, targetFolderId?}` and returns the mutated `classifiedTree`. Server is source of truth; Alpine state is updated from the response.
- This sync is required because `src/routes/export.js` reads `session.classifiedTree` directly — client-only edits would be silently discarded on Export.
- "Keep" operation marks a bookmark with a `kept: true` flag on the node; it has no structural effect but may be used for visual indicator.

**Summary Panel Data Source (D-08 to D-09)**
- Summary panel aggregates from existing Alpine state — no new API endpoint needed: `this.deadCount`, `this.cleanupStats.dupesRemoved`, `this.mergeCandidates` length, traversal count of `this.classifiedTree`.
- Summary panel is a static display panel, not interactive. Rendered via Alpine reactive state.

**Empty Folder Pruning (D-10 to D-12)**
- `pruneEmptyFolders(tree)` utility function implemented in new `src/shared/treeUtils.js`, called inside `src/routes/export.js` before `exportToNetscape()`.
- `hierarchyBuilder.js` already guarantees no empty folders at classification time. Pruning at export handles only the Phase 5 edit-induced case.
- Empty folder pruning is recursive — a folder containing only empty folders is also removed.

### Claude's Discretion
- Exact CSS layout values (column widths, panel heights, gap)
- Context menu visual styling (border, shadow, font)
- `kept: true` visual indicator design (icon, color)
- Node ID scheme for identifying nodes in edit operations (path-based, UUID, or index)
- Whether move operation uses drag-and-drop or a sub-menu of destination folders
- Test coverage scope for `src/routes/edit.js` and `src/shared/treeUtils.js`

### Deferred Ideas (OUT OF SCOPE)
- Drag-and-drop reordering
- Undo/redo history
- Re-classification trigger after edits
- Inline rename of folders/bookmarks
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLASS-03 | App removes empty folders from output after all other operations | `pruneEmptyFolders()` in `src/shared/treeUtils.js`, called in `src/routes/export.js` before `exportToNetscape()`. Recursive algorithm documented in Architecture Patterns. |
| UI-01 | Side-by-side tree view: original structure on the left (read-only), cleaned/proposed on the right | CSS grid two-column layout on the `classified` screen; two `renderTree()` calls into separate `x-ref` containers. Current `max-width: 800px` on `.page` must be widened. |
| UI-02 | Right-click context menu: move to folder, mark as keep, delete | Single floating context menu `<div>` + `contextmenu` event on right panel nodes; `POST /api/edit` syncs state. Node ID scheme and move sub-menu design are Claude's discretion. |
| UI-03 | Summary panel: dead links removed, duplicates removed, folders merged, total remaining | All four data points already live in Alpine state (`deadCount`, `cleanupStats.dupesRemoved`, `mergeCandidates.length`, `classifiedTree` traversal count). No new API needed. |
</phase_requirements>

---

## Summary

Phase 5 completes the end-to-end user journey by transforming the current single-panel `classified` screen into a two-column review-and-edit interface. All required data already exists in Alpine state from prior phases — the work is wiring it into new layout structures and adding the one missing piece: a `POST /api/edit` route plus its server-side tree mutation logic.

The primary engineering surface area is: (1) the `src/shared/treeUtils.js` module with `pruneEmptyFolders()`, (2) `src/routes/edit.js` implementing delete/move/keep operations against `session.classifiedTree`, and (3) `public/index.html` + `public/app.js` changes to the `classified` screen. All three follow patterns already established in the codebase — there is nothing technically novel to research from external sources.

Node IDs are already stable UUIDs assigned at parse time (`crypto.randomUUID()` in the parser, propagated through all pipeline stages). This means `nodeId` in edit operations can be the existing `.id` field directly — no new ID scheme needs to be designed.

**Primary recommendation:** Build in the order: treeUtils.js tests → treeUtils.js implementation → edit route tests → edit route → HTML layout extension → app.js wiring → export integration. This ensures the backend is solid before the UI layer depends on it.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express 5.2.1 | ^5.2.1 | `POST /api/edit` route | Established in Phase 1; router-per-file pattern |
| Alpine.js 3.x | CDN | Context menu state, summary panel bindings | Established in Phase 1; no build step |
| Node.js built-in | >=20 LTS | `crypto.randomUUID()` for node IDs | Already used in parser.js |

### No new dependencies required

All Phase 5 work is satisfied by existing dependencies. `src/shared/treeUtils.js` is pure JavaScript with no library imports. The context menu is built with vanilla DOM APIs.

**Installation:** No new packages. Run `npm install` if starting fresh — all required packages already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
├── shared/
│   └── treeUtils.js       # NEW: pruneEmptyFolders(), countLinks()
├── routes/
│   └── edit.js            # NEW: POST /api/edit (delete/move/keep)
test/
└── treeUtils.test.js      # NEW: unit tests for treeUtils
```

Existing files modified: `server.js`, `src/routes/export.js`, `public/index.html`, `public/app.js`.

---

### Pattern 1: pruneEmptyFolders (recursive tree utility)

**What:** Recursively removes folder nodes that have no link descendants. A folder containing only empty folders is also pruned.

**When to use:** Called once in `src/routes/export.js` immediately before `exportToNetscape()`.

**Algorithm:**

```javascript
// src/shared/treeUtils.js
export function pruneEmptyFolders(node) {
  if (node.type === 'link') return node;

  // Recurse into children first (depth-first, bottom-up)
  const prunedChildren = (node.children ?? [])
    .map(pruneEmptyFolders)
    .filter(child => {
      if (child.type === 'link') return true;
      // Keep folder only if it has surviving children after pruning
      return (child.children ?? []).length > 0;
    });

  return { ...node, children: prunedChildren };
}
```

**Key insight:** The filter runs AFTER recursive pruning, so a folder that contains only empty subfolders will itself have zero children after recursion and will be removed by the parent's filter pass.

**Integration point in export.js:**

```javascript
// src/routes/export.js — insert before exportToNetscape call
import { pruneEmptyFolders } from '../shared/treeUtils.js';

router.get('/export', (req, res) => {
  const source = session.classifiedTree ?? session.checkedTree ?? session.cleanTree ?? session.tree;
  const pruned = pruneEmptyFolders(source);
  const html = exportToNetscape(pruned);
  // ...
});
```

---

### Pattern 2: POST /api/edit route (server-side tree mutation)

**What:** Accepts an operation descriptor, applies it to a deep clone of `session.classifiedTree`, persists the result, returns the new tree.

**Pattern follows classify.js exactly:**

```javascript
// src/routes/edit.js
import { Router } from 'express';
import { session } from '../session.js';

const router = Router();

router.post('/edit', (req, res) => {
  const { op, nodeId, targetFolderId } = req.body;
  if (!session.classifiedTree) {
    return res.status(400).json({ error: 'No classified tree. Run classify first.' });
  }

  let updated;
  if (op === 'delete') {
    updated = deleteNode(structuredClone(session.classifiedTree), nodeId);
  } else if (op === 'move') {
    updated = moveNode(structuredClone(session.classifiedTree), nodeId, targetFolderId);
  } else if (op === 'keep') {
    updated = markKeep(structuredClone(session.classifiedTree), nodeId);
  } else {
    return res.status(400).json({ error: 'Unknown op: ' + op });
  }

  session.classifiedTree = updated;
  res.json({ classifiedTree: updated });
});

export default router;
```

**Key detail:** Use `structuredClone()` (built into Node 17+, so available on Node 20) to deep-copy before mutating. This honours the immutable-stage pattern from prior phases without requiring a third-party clone library.

---

### Pattern 3: deleteNode / moveNode / markKeep (tree mutation helpers)

These are pure functions operating on tree-shaped data. Belong in `src/routes/edit.js` as private helpers (not exported, not in treeUtils.js — they are edit-specific, not general utilities).

**deleteNode — recursive filter:**

```javascript
function deleteNode(node, targetId) {
  if (node.type === 'folder') {
    return {
      ...node,
      children: (node.children ?? [])
        .filter(child => child.id !== targetId)
        .map(child => deleteNode(child, targetId)),
    };
  }
  return node;
}
```

**moveNode — two-pass: extract then insert:**

```javascript
function moveNode(root, nodeId, targetFolderId) {
  // Pass 1: extract the node
  let extracted = null;
  function extract(node) {
    if (node.type !== 'folder') return node;
    const found = (node.children ?? []).find(c => c.id === nodeId);
    if (found) extracted = found;
    return {
      ...node,
      children: (node.children ?? [])
        .filter(c => c.id !== nodeId)
        .map(extract),
    };
  }
  const withoutNode = extract(root);
  if (!extracted) return root; // nodeId not found — no-op

  // Pass 2: insert into target folder
  function insert(node) {
    if (node.type !== 'folder') return node;
    if (node.id === targetFolderId) {
      return { ...node, children: [...(node.children ?? []), extracted] };
    }
    return { ...node, children: (node.children ?? []).map(insert) };
  }
  return insert(withoutNode);
}
```

**markKeep — recursive find and flag:**

```javascript
function markKeep(node, targetId) {
  if (node.id === targetId) return { ...node, kept: true };
  if (node.type === 'folder') {
    return {
      ...node,
      children: (node.children ?? []).map(child => markKeep(child, targetId)),
    };
  }
  return node;
}
```

---

### Pattern 4: Two-column layout (HTML + CSS)

**What:** The `classified` screen gains a second panel. The existing `.page` max-width of 800px is too narrow for two panels; expand to 1200px or full-width for this screen only.

**CSS grid approach:**

```css
.two-col-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

/* Override page max-width for the classified screen */
.page.wide { max-width: 1200px; }
```

**Alpine x-ref pattern (two containers):**

```html
<!-- public/index.html — classified screen block -->
<template x-if="status === 'classified'">
  <div>
    <!-- summary panel, actions, etc. -->
    <div class="two-col-layout">
      <div class="tree-panel">
        <h3>Original structure</h3>
        <div x-ref="leftPanel" x-init="renderTree(tree, $el, 0, {})"></div>
      </div>
      <div class="tree-panel">
        <h3>Proposed structure</h3>
        <div x-ref="rightPanel"
             x-init="renderTree(classifiedTree, $el, 0, { editMode: true, onContextMenu: (node, e) => openContextMenu(node, e) })">
        </div>
      </div>
    </div>
  </div>
</template>
```

**Established pattern note:** `x-init` on the container div (not `$nextTick`) — this is the established Phase 2 fix recorded in STATE.md. The `$refs` are available on `x-init` for elements inside active `x-if` blocks.

---

### Pattern 5: Floating context menu

**What:** A single `<div>` absolutely positioned relative to the viewport on `contextmenu` events.

**State fields to add to Alpine data:**

```javascript
contextMenu: {
  visible: false,
  x: 0,
  y: 0,
  node: null,       // the BookmarkNode being acted on
},
```

**HTML (placed at root of bookmarkApp div, not inside any x-if):**

```html
<div
  x-show="contextMenu.visible"
  :style="`position:fixed; left:${contextMenu.x}px; top:${contextMenu.y}px; z-index:1000`"
  class="context-menu"
  @click.outside="contextMenu.visible = false"
>
  <button @click="editOp('delete')">Delete</button>
  <button @click="editOp('keep')">Mark as Keep</button>
  <button @click="showMoveMenu()">Move to folder...</button>
</div>
```

**Opening the menu (called from renderTree's contextmenu handler):**

```javascript
openContextMenu(node, event) {
  event.preventDefault();
  this.contextMenu = { visible: true, x: event.clientX, y: event.clientY, node };
},

async editOp(op, targetFolderId = undefined) {
  this.contextMenu.visible = false;
  const body = { op, nodeId: this.contextMenu.node.id };
  if (targetFolderId) body.targetFolderId = targetFolderId;
  const res = await fetch('/api/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return; // handle error
  const data = await res.json();
  this.classifiedTree = data.classifiedTree;
  this.$nextTick(() => {
    const container = this.$refs.rightPanel;
    if (!container) return;
    container.innerHTML = '';
    renderTree(this.classifiedTree, container, 0, { editMode: true, onContextMenu: (n, e) => this.openContextMenu(n, e) });
  });
},
```

**Critical:** `@click.outside` on the context menu div closes it when user clicks elsewhere. This is a standard Alpine.js directive.

---

### Pattern 6: countLinks (for summary panel total remaining)

```javascript
// src/shared/treeUtils.js
export function countLinks(node) {
  if (node.type === 'link') return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countLinks(child), 0);
}
```

Used in Alpine state to display "total bookmarks remaining" reactively:

```javascript
// computed-style getter — call in x-text binding
get totalRemaining() {
  return this.classifiedTree ? countLinks(this.classifiedTree) : 0;
}
```

Since Alpine does not natively support computed getters declared this way inside `Alpine.data()`, use a method call in x-text: `x-text="classifiedTree ? countLinksClient(classifiedTree) : 0"` where `countLinksClient` is a method on the Alpine component, or inline the traversal.

---

### Pattern 7: Move sub-menu (folder list)

**What:** When user clicks "Move to folder", show a nested list of all folders in `classifiedTree`. This is the v1 approach (not drag-and-drop, per deferred items).

**Implementation:** Collect all folder nodes from `classifiedTree` into a flat array for display:

```javascript
getFolderList() {
  const folders = [];
  function walk(node) {
    if (node.type === 'folder' && node.title !== 'root') folders.push(node);
    if (node.children) node.children.forEach(walk);
  }
  if (this.classifiedTree) walk(this.classifiedTree);
  return folders;
},
```

Display as a secondary panel or inline in the context menu as a `<select>` or list of buttons.

---

### Anti-Patterns to Avoid

- **Mutating `session.classifiedTree` directly in the edit route:** Always `structuredClone()` first. The immutable-stage pattern is established; violating it creates subtle bugs when operations interact.
- **Client-only tree edits without server sync:** Export reads `session.classifiedTree` — any client-side-only mutations are silently lost on Export. Every structural edit (delete/move) must go through `POST /api/edit`.
- **Embedding context menu per tree node:** Creates dozens of hidden DOM elements. Use the single shared floating `<div>` approach (D-04).
- **Using `$nextTick` instead of `x-init` for initial render:** The Phase 2 fix establishes that `$refs` are available on `x-init` for elements in active `x-if` blocks. `$nextTick` inside `x-init` IS still correct for re-renders triggered from within handlers (existing pattern in app.js line 397–403).
- **Forgetting to re-render rightPanel after edit response:** After `this.classifiedTree = data.classifiedTree`, the DOM tree still shows the old structure. Must explicitly clear and re-render `rightPanel` via `$nextTick`.
- **`x-ref="treeContainer"` naming collision:** The existing code uses `treeContainer` as the ref name for all prior screens. The classified screen previously also used `treeContainer`. When splitting to two panels, use `leftPanel` and `rightPanel` as new ref names to avoid collision with the single-ref `rerenderTree()` method (which also uses `treeContainer`). Either update `rerenderTree()` or keep `treeContainer` for the right panel and introduce `leftPanel` only for the new left column.
- **Not handling `classifiedTree === null` in summary panel:** If the user reaches the classified screen (status === 'classified'), `classifiedTree` is guaranteed non-null. But guard anyway for robustness.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep object cloning | Custom recursive clone | `structuredClone()` (Node 17+ built-in) | Handles circular refs, typed arrays, Maps — built in, no dependency |
| Click-outside detection | Custom document event listener | Alpine `@click.outside` directive | Native Alpine directive — one attribute, correct cleanup lifecycle |
| CSS grid two-column layout | JavaScript-calculated widths | CSS `grid-template-columns: 1fr 1fr` | Browser handles resize, overflow, gap correctly |

---

## Common Pitfalls

### Pitfall 1: `x-ref` not found after re-render
**What goes wrong:** After Alpine re-renders a `x-if` block, `$refs` for elements inside it may be stale.
**Why it happens:** Alpine destroys and recreates the DOM when an `x-if` condition changes. The ref is re-established only after the new DOM is painted.
**How to avoid:** Use `$nextTick()` before accessing `$refs` inside event handlers that may trigger a re-render. The pattern at app.js line 397–403 already does this correctly.
**Warning signs:** `container is null` error in browser console immediately after a state transition.

### Pitfall 2: Context menu not dismissing on navigation / state change
**What goes wrong:** Context menu remains visible when the status transitions (e.g., user clicks Export while menu is open).
**Why it happens:** `contextMenu.visible` is never reset on status change.
**How to avoid:** Reset `contextMenu.visible = false` in `exportBookmarks()` and any other action that changes `status`. Or reactively hide it with `:style` that checks `status === 'classified'`.

### Pitfall 3: Empty folder created by delete — visible in UI but absent from export
**What goes wrong:** User deletes all bookmarks from a folder. The folder remains visible in the right panel (since `POST /api/edit` returns the tree as-is, with the folder now empty). Export is clean (pruning removes it), but the UI shows an empty folder.
**Why it happens:** Pruning happens only at export time (D-10). The right-panel tree reflects the live session state, which may contain empty folders mid-session.
**How to avoid:** This is intentional — ROADMAP item 4 says "empty folders are absent from the exported file", not "absent from the UI". Document clearly for users. Optionally: prune client-side before re-rendering the right panel (not required, but improves UX).

### Pitfall 4: `treeContainer` ref name collision
**What goes wrong:** The existing `rerenderTree()` method in app.js uses `this.$refs.treeContainer`. The classified screen previously used `x-ref="treeContainer"` for its single panel. When the classified screen is extended to two panels, the old ref name must be deliberately handled.
**Why it happens:** Copy-paste of the existing panel pattern without updating the ref name.
**How to avoid:** Use `leftPanel` and `rightPanel` as the new ref names. Update `rerenderTree()` to be aware it is only called from non-classified screens (it uses `cleanTree || tree`, not `classifiedTree`). Add a new `rerenderRightPanel()` method for classified-state re-renders.

### Pitfall 5: Move operation targeting a node's own subtree
**What goes wrong:** If user moves a folder into one of its own descendants, the result is a tree with the moved folder disappeared (extract succeeds, insert target is no longer in the tree).
**Why it happens:** The two-pass moveNode extracts the node before inserting, so if targetFolderId was inside the extracted subtree, it no longer exists in the tree during the insert pass.
**How to avoid:** In `moveNode`, validate that `targetFolderId` is not a descendant of `nodeId` before proceeding. Return unchanged tree (or error) if it is. Alternatively, only offer leaf-level category folders in the move sub-menu (which are never ancestors of links in the current flat hierarchy).

### Pitfall 6: `countLinks` called in Alpine template causing recomputation on every state update
**What goes wrong:** Expensive traversal triggered on every Alpine reactive update.
**Why it happens:** Alpine template expressions re-evaluate whenever any reactive data changes.
**How to avoid:** Either cache the count as a state field updated only on edit responses (`this.remainingCount = countLinks(data.classifiedTree)`), or ensure `countLinks` is called only when `classifiedTree` changes. The tree is typically hundreds of nodes, so performance is not catastrophic, but a cached field is cleaner.

---

## Code Examples

### countLinks (for summary panel — client-side version)

```javascript
// As a method on the Alpine component (app.js)
countLinks(node) {
  if (!node) return 0;
  if (node.type === 'link') return 1;
  return (node.children ?? []).reduce((sum, child) => sum + this.countLinks(child), 0);
},
```

Used in HTML as: `<span x-text="countLinks(classifiedTree)"></span>`

### Attaching contextmenu event in renderTree

The right-panel renderTree call passes `options.onContextMenu`. In renderTree, attach to both folder headers and link wrappers:

```javascript
// In renderTree — for link nodes (add after wrapper creation)
if (options.onContextMenu) {
  wrapper.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    options.onContextMenu(node, e);
  });
}

// For folder headers
if (options.onContextMenu) {
  header.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation(); // prevent parent folder from also triggering
    options.onContextMenu(node, e);
  });
}
```

### Server-side node ID lookup (used in edit helpers)

The `id` field on every BookmarkNode is a UUID assigned at parse time and preserved through all pipeline stages (classifyTree and buildHierarchy both spread node properties). IDs are stable for the session — no ID scheme changes needed.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `treeContainer` ref, one panel | Two separate refs (`leftPanel`, `rightPanel`) | Phase 5 | renderTree must be called separately for each panel; `rerenderTree()` method only applies to non-classified screens |
| No edit state on tree nodes | `kept: true` flag on BookmarkNode | Phase 5 | `BookmarkNode` typedef should be updated in `src/shared/types.js` to document the new optional field |
| Export reads tree as-is | Export runs `pruneEmptyFolders()` before serialising | Phase 5 | Empty folders silently vanish from the output file regardless of session state |

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies introduced in this phase — all libraries already installed, no new network services, no new CLI tools).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node --test`) |
| Config file | None — runner invoked directly via `npm test` |
| Quick run command | `node --test test/treeUtils.test.js` |
| Full suite command | `npm test` (`node --test test/**/*.test.js`) |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLASS-03 | `pruneEmptyFolders` removes empty folders recursively | unit | `node --test test/treeUtils.test.js` | Wave 0 |
| CLASS-03 | `pruneEmptyFolders` removes folder containing only empty folders | unit | `node --test test/treeUtils.test.js` | Wave 0 |
| CLASS-03 | `pruneEmptyFolders` preserves folders with link children | unit | `node --test test/treeUtils.test.js` | Wave 0 |
| CLASS-03 | Export route applies pruning before serialisation | integration | manual-only (requires running server + curl) | N/A — manual |
| UI-01 | Side-by-side layout renders both panels | manual-only (browser visual) | N/A | N/A — manual |
| UI-02 | `deleteNode` removes target from tree | unit | `node --test test/treeUtils.test.js` | Wave 0 |
| UI-02 | `moveNode` relocates node to target folder | unit | `node --test test/treeUtils.test.js` | Wave 0 |
| UI-02 | `markKeep` sets `kept: true` on target node | unit | `node --test test/treeUtils.test.js` | Wave 0 |
| UI-02 | `POST /api/edit` returns mutated tree | manual-only (requires server) | N/A | N/A — manual |
| UI-03 | Summary panel data points match session state | manual-only (browser visual) | N/A | N/A — manual |

**Note on edit helpers:** `deleteNode`, `moveNode`, and `markKeep` are private helpers inside `src/routes/edit.js` per the locked design. To make them unit-testable without spinning up a server, either (a) export them from a separate module (e.g., `src/shared/treeOps.js`) or (b) test them via integration test through `POST /api/edit`. Option (a) is cleaner for unit testing. This is Claude's discretion — the planner should choose and document it in the plan.

### Sampling Rate
- **Per task commit:** `node --test test/treeUtils.test.js`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/treeUtils.test.js` — covers CLASS-03 (pruneEmptyFolders) and UI-02 tree ops (deleteNode, moveNode, markKeep)

---

## Open Questions

1. **Should edit helpers be exported from a separate module for unit testing?**
   - What we know: `deleteNode`, `moveNode`, `markKeep` are private to `src/routes/edit.js` per the locked design (D-05 says logic is in the route file, not a shared module)
   - What's unclear: Whether unit tests should test them through the HTTP route (integration) or by exporting them from a shared module
   - Recommendation: Create `src/shared/treeOps.js` exporting the three helpers; import in `src/routes/edit.js`. This makes them unit-testable and follows the "logic-in-module" pattern established in prior phases. Include in Wave 0 test file.

2. **`treeContainer` ref name — update `rerenderTree()` or introduce new ref names?**
   - What we know: `rerenderTree()` uses `this.$refs.treeContainer`; the classified screen previously used the same ref name
   - What's unclear: Whether `rerenderTree()` is ever called from the classified screen (it is not — it only runs from cleaned/checked states after merge/check operations)
   - Recommendation: Keep `treeContainer` as the ref name for the right panel on the classified screen (so `rerenderRightPanel()` can reuse the same ref lookup pattern), and use `leftPanel` for the new read-only left panel. No changes to `rerenderTree()` needed.

3. **`kept: true` visual indicator — icon or colour?**
   - What we know: This is Claude's discretion
   - Recommendation: A small green checkmark icon prepended to the bookmark title is the least intrusive option. Use a Unicode character (e.g., `✓`) rather than an SVG to stay consistent with the existing emoji/Unicode approach in the tree renderer.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 5 |
|-----------|-------------------|
| No framework lock-in; Alpine.js CDN only | Context menu and two-panel layout must be built with Alpine directives + vanilla DOM. No additional frontend frameworks. |
| No build step — clone + npm start | All frontend code in `public/app.js` and `public/index.html`. No transpilation, no bundler. |
| No API key required for core flow | Edit/export operations are purely local. No external service calls introduced. |
| Max 3 levels deep in proposed hierarchy | `buildHierarchy` already enforces this. Phase 5 editing does not add new hierarchy levels (move operates within the existing tree). |
| Self-contained — no data leaves the machine except URL health checks | `POST /api/edit` and `GET /api/export` are both localhost-only routes. |
| Router-per-file pattern | `src/routes/edit.js` must export a `Router`, mounted at `/api` in `server.js`. |
| `"type": "module"` in package.json | All new `.js` files use ESM (`import`/`export`). No `require()`. |
| `x-init` on element, not `$nextTick` (Phase 2 fix) | Initial two-panel render uses `x-init` on each container div. |
| Immutable-stage pattern | Edit route uses `structuredClone()` before mutation; never mutates session directly. |
| Logic-in-module | `pruneEmptyFolders()` in `src/shared/treeUtils.js`, not inline in the route. |
| TDD | Tests for `pruneEmptyFolders()` and tree ops written before implementation (Wave 0 test file). |

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection of `public/app.js` — Alpine state fields, renderTree signature, existing patterns
- Direct code inspection of `public/index.html` — current classified screen HTML, CSS classes
- Direct code inspection of `src/routes/classify.js` — router-per-file template to replicate
- Direct code inspection of `src/routes/export.js` — exact insertion point for pruneEmptyFolders
- Direct code inspection of `src/session.js` — session fields available to edit route
- Direct code inspection of `src/shared/types.js` — BookmarkNode typedef
- Direct code inspection of `src/hierarchyBuilder.js` — classifiedTree shape (flat: root → category folders → links)
- Direct code inspection of `server.js` — router mount pattern
- `.planning/phases/05-editable-ui/05-CONTEXT.md` — locked decisions D-01 through D-12
- `Node.js structuredClone` — built-in since Node 17, no library required
- Alpine.js `@click.outside` — documented directive in Alpine 3.x

### Secondary (MEDIUM confidence)

- Alpine.js 3.x CDN docs (https://alpinejs.dev/essentials/installation) — `@click.outside` directive behaviour confirmed in Alpine 3 documentation

### Tertiary (LOW confidence)

None — all findings are grounded in direct codebase inspection and locked CONTEXT.md decisions.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already installed and in use; no new packages
- Architecture: HIGH — all patterns derived from existing code + locked CONTEXT.md decisions
- Pitfalls: HIGH — based on direct reading of existing code patterns and established gotchas recorded in STATE.md
- Test infrastructure: HIGH — existing `node --test` pattern confirmed in package.json

**Research date:** 2026-03-24
**Valid until:** 2026-06-24 (stable domain — Alpine.js 3.x and Node.js built-in APIs change slowly)
