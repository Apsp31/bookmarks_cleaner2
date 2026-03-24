# Pitfalls Research

**Domain:** Bookmark Cleaner v1.1 — sub-categorisation, classification quality, drag-and-drop
**Researched:** 2026-03-24
**Confidence:** HIGH (integration pitfalls derived from direct codebase inspection); MEDIUM (DnD event model, classification tuning)

> This file replaces the v1.0 pitfalls file. v1.0 pitfalls (soft-404, IP bans, URL dedup, parse blocking, etc.) are resolved and are not repeated. This file focuses exclusively on pitfalls introduced by the v1.1 features: multi-level hierarchy, classification quality, and drag-and-drop — with specific integration risks for this codebase.

---

## Critical Pitfalls

### Pitfall 1: buildHierarchy Sub-Category Depth Violates the Existing 3-Level Hard Constraint

**What goes wrong:**
`buildHierarchy` is refactored to emit sub-folders. The new output is: root (depth 0) → top-level category (depth 1) → sub-category (depth 2) → link (depth 3). This is exactly the max-3-level constraint from D-08. But if `buildHierarchy` is extended naively — for example by recursing into sub-categories that themselves have sub-categories — the output can reach depth 4 or 5 for rare category combinations, and the exporter emits deeply-nested `<DL>` blocks that Chrome handles but which violate the project's own stated constraint.

**Why it happens:**
The sub-categorisation logic groups links by a secondary key (e.g. language, sub-topic). If the grouping function is recursive with no guard, a "Development > JavaScript > Frameworks > Libraries" chain is possible. The constraint says max 3, but the code does not enforce it — it was only enforced by the flat design in v1.

**How to avoid:**
Add an explicit `depth` parameter to any new recursive hierarchy-building function with a hard `MAX_DEPTH = 3` constant. When depth would exceed MAX_DEPTH, flatten remaining items into the deepest allowable folder rather than creating another level. Write a test that generates a hierarchy from a collection designed to trigger 4-level nesting and asserts that max folder depth is 3.

**Warning signs:**
- Any folder node in the output where depth (counted from root) exceeds 2 before leaf links
- `serializeNode` in `exporter.js` receiving indent > 3

**Phase to address:** Sub-categorisation phase, during `buildHierarchy` redesign

---

### Pitfall 2: Sub-Category IDs Generated with crypto.randomUUID() Break Idempotent Rebuilds

**What goes wrong:**
`buildHierarchy` currently uses `crypto.randomUUID()` for every folder it creates. In v1 this was fine because classification ran once per session. In v1.1, if `buildHierarchy` is re-invoked (e.g. user edits a bookmark's category and the right panel is rebuilt), every folder gets a new UUID. Any node IDs stored in Alpine's component state — for example the `contextMenu.node.id` or the `$refs.rightPanel` DOM tree — are now stale. Clicking a context menu item calls `editOp('delete', oldNodeId)` but the session tree has new IDs. The server returns the tree unchanged, silently ignoring the operation.

**Why it happens:**
The current `editOp` flow sends `nodeId` (from the DOM/context menu state) to `/api/edit`, which calls `deleteNode(structuredClone(session.classifiedTree), nodeId)`. If `session.classifiedTree` was rebuilt from scratch with new random IDs, `deleteNode` walks the tree, finds no match, and returns the tree unmodified. No error is returned (the server just returns the same tree). The client re-renders the same tree, the user thinks the delete worked, then wonders why the node is still there on the next action.

**How to avoid:**
Make folder IDs in `buildHierarchy` deterministic: derive them from the folder's title path rather than random UUIDs. For example `crypto.createHash('sha1').update('Development/JavaScript').digest('hex').slice(0,8)`. Link node IDs should be preserved from the classified tree — never reassigned during hierarchy building. Write a test that calls `buildHierarchy` twice on the same input and asserts that all folder IDs are identical across both calls.

**Warning signs:**
- A delete or move operation via context menu appears to succeed (no error shown) but the node reappears on next re-render
- `deleteNode` or `moveNode` returning the unmodified root (both are no-ops when nodeId is not found — they return `root` silently)

**Phase to address:** Sub-categorisation phase, before wiring edit operations to the new hierarchy

---

### Pitfall 3: moveNode's Circular Guard Does Not Account for Folder-into-Own-Sub-Category Moves

**What goes wrong:**
The existing `moveNode` in `treeOps.js` has a circular move guard: if `sourceNode.type === 'folder' && isDescendant(sourceNode, targetFolderId)`, it returns the tree unchanged. In v1 the hierarchy was flat (2 levels: root → category → links), so moving a folder into its own descendant was only theoretically possible. In v1.1, with a 3-level hierarchy, a user can drag a sub-category folder and attempt to drop it onto one of its own children (now a link-level folder). The guard should still catch this — but only if `isDescendant` correctly walks the deepened tree.

More importantly: when sub-categories are introduced, `getFolderList()` in `app.js` returns ALL folders including sub-categories. The "Move to..." context menu now lists sub-folders of the node being moved as valid targets. If the guard fires silently (returns tree unchanged, no error), the user sees no feedback and assumes the move worked.

**Why it happens:**
`getFolderList()` walks the entire tree unconditionally. The context menu has no awareness of which target folders would create a circular dependency for the selected node. The guard is a backstop, not a proactive filter.

**How to avoid:**
In `getFolderList()` (or the new equivalent for the v1.1 move menu), exclude folders that are the selected node itself or descendants of the selected node. This is the same `isDescendant` check already in `treeOps.js` — expose it or re-use it client-side when building the move target list. Also add a visual error message when `moveNode` detects a circular move rather than silently returning the unmodified tree. The server route at `/api/edit` can detect a no-op by comparing the returned tree to the input via a hash or by adding an explicit `moved: boolean` flag to the response.

**Warning signs:**
- "Move to..." sub-menu lists the folder being moved as a possible target
- A move operation completes with no server error but the tree looks identical

**Phase to address:** Sub-categorisation phase (when building the move UI), drag-and-drop phase (when wiring drop targets)

---

### Pitfall 4: Keyword Classifier Over-Fits to the Existing Test Suite

**What goes wrong:**
`CATEGORY_KEYWORDS` in `classifier.js` is expanded to improve classification. New keywords are added. Tests in `classifier.test.js` pass. But the expanded keyword list over-fits to the test fixtures — real bookmark collections contain titles like "My Notes - Notion" which now match `Tools` because "notes" was added to the Tools keywords, while the same title previously matched nothing and fell through to domain-rule → Notion → `Tools` anyway. The problem is subtler: "Python Tutorial for Beginners" now matches `Learning` (correct) but also matches `Development` (because `python` was added to Development keywords). The first matching category wins (current loop order). If the insertion order of `CATEGORY_KEYWORDS` entries is changed during expansion, existing bookmarks silently shift categories.

**Why it happens:**
`classifyByMetadata` iterates `Object.entries(CATEGORY_KEYWORDS)` and returns the first match. The ordering of object properties in modern JS is insertion order for string keys. Any reordering of the category entries in the object literal changes classification results for ambiguous titles. This is a hidden dependency on declaration order.

**How to avoid:**
- Add a regression test fixture: a set of known bookmark titles with expected categories that must not change when the keyword list is expanded. Run this as a golden-file test, not just unit assertions.
- When adding keywords, test each new keyword against all existing test fixtures to verify no regressions.
- Consider adding a `confidence` score to `classifyByMetadata` (count of matching keywords) so that high-ambiguity bookmarks can be surfaced to the user rather than silently assigned.
- Document the category ordering in `CATEGORY_KEYWORDS` as intentional and add a comment warning that order changes classification outcomes.

**Warning signs:**
- An existing test that previously passed now fails after keyword additions
- A bookmark that was categorised as `X` in v1.0 is now categorised as `Y` — discovered by comparing outputs on the same input file

**Phase to address:** Classification quality phase, before any keyword additions; establish the golden-file test first

---

### Pitfall 5: Rule Conflicts Between Domain Map and Keyword Fallback Produce Inconsistent Results

**What goes wrong:**
A bookmark for `blog.github.com` hits the domain rules map (`github.com` → `Development`). But `blog.github.com` does not match the `github.com` key because `classifyByDomain` strips `www.` only, not arbitrary subdomains. The domain rule misses, falls through to metadata, and the Open Graph title "GitHub Blog — Product Updates" matches `Development` via the keyword `github` anyway — so it looks correct. But `techcrunch.com` is in the domain map as `News`, while a TechCrunch article titled "Best Python Tools for Developers" would match `Development` via keyword if the domain rule were absent. The domain rule wins and it stays `News`. This asymmetry is invisible unless explicitly tested.

**Why it happens:**
The classifier pipeline is `domain rules → metadata keywords → 'Other'`. The domain rule always beats the metadata fallback. This is intentional for the 143 well-known domains, but as the domain map is expanded, new entries will occasionally override what the keyword fallback would have chosen. There is no mechanism to say "use metadata if confidence is higher."

**How to avoid:**
- Do not expand the domain rules map beyond ~300 entries. The value of the domain map is certainty for major sites; adding long-tail domains increases the risk of override conflicts.
- For the keyword classifier improvement, focus on improving keyword precision (fewer false matches) rather than recall (more keywords). Each new keyword is a potential conflict with the domain map.
- Add a test case: a URL that is in the domain map, where the page title would classify differently via keyword. Verify the domain rule wins and document this as intentional.

**Warning signs:**
- Adding a new domain rule changes classification results for URLs already covered by keyword fallback
- Two bookmarks from the same site (different sub-pages) get different categories because one hits the domain map and the other does not

**Phase to address:** Classification quality phase

---

### Pitfall 6: Drag-and-Drop Events Bubble Through the Alpine.js Tree and Trigger Context Menu

**What goes wrong:**
The existing right panel tree in `app.js` has `contextmenu` event listeners on every `.tree-folder-header` and `.tree-link` element. When drag-and-drop is added, `dragstart`, `dragover`, `drop`, and `dragend` events are attached to the same elements. During a drag operation, the user accidentally right-clicks a node (or on touch devices, long-press triggers contextmenu). The context menu opens during an active drag. The user then drops, and the context menu click handler fires on the drop target, executing an unintended edit operation.

**Why it happens:**
`renderTree` adds event listeners imperatively to DOM nodes. There is no unified event management — each listener is wired independently. Alpine.js's `x-on` directives and the imperative `addEventListener` calls in `renderTree` do not coordinate. The context menu state (`contextMenu.visible`) is set by `openContextMenu` and cleared only by `editOp` or by a `@click.outside` handler on the context menu element. If the context menu is open and a drop fires, both actions can execute.

**How to avoid:**
- Add a drag-state flag (e.g. `isDraggingNode: false`) to the Alpine component. Set it `true` in `dragstart`, `false` in `dragend`. In `openContextMenu`, return early if `this.isDraggingNode` is true.
- In the drop handler, call `this.contextMenu.visible = false` before processing the drop.
- Use `e.stopPropagation()` on all DnD event handlers on child nodes to prevent events bubbling up to parent folder nodes and triggering their own handlers.
- Test this interaction explicitly: start a drag, right-click mid-drag, verify context menu does not appear.

**Warning signs:**
- Context menu appears briefly during a drag operation
- Drop operation executes AND an edit operation fires on the same user action

**Phase to address:** Drag-and-drop phase

---

### Pitfall 7: Drop Target Ambiguity — Dropping on a Folder Header vs Dropping Inside a Folder

**What goes wrong:**
The tree renders each folder as a `.tree-folder-header` (the clickable label row) and a `.tree-children` (the expanded content area). When a user drags a bookmark and tries to drop it "into" a folder, the drop event fires on whichever element the cursor is over: either the header or the children container. If dropped on the header, the item should go inside the folder. If dropped between two folders, it should be reordered at that level. Without explicit drop zone regions, the user cannot tell which folder will receive the drop, and the implementation cannot determine insert position vs. folder membership.

**Why it happens:**
HTML drag-and-drop does not distinguish "drop into" from "drop between" — both fire the same `drop` event on whichever element has `dragover` returning false (i.e., has `e.preventDefault()` called). The element that is the `event.target` of the drop could be the header, the children container, a nested link, or a nested folder header. Without clear visual feedback and explicit drop-zone regions, the implementation becomes a guess at user intent.

**How to avoid:**
- Define three distinct drop zones per folder: a top strip (reorder before), a middle area (drop into), and a bottom strip (reorder after). Use `getBoundingClientRect()` and `e.clientY` to determine which zone the drop landed in.
- Show a visible insertion indicator (a horizontal line) when dragging over the top/bottom strips, and a folder highlight when over the middle area.
- Use `data-drop-zone="before|into|after"` and `data-node-id` attributes on the drop target elements so the drop handler can read intent from the DOM rather than inferring from cursor position.
- Because this is an imperative DOM tree (not Alpine `x-for`), the drop handler needs to query the DOM for these attributes and map back to node IDs, then call the server `/api/edit` move operation.

**Warning signs:**
- A bookmark dropped on a folder sometimes goes into it, sometimes reorders next to it — non-deterministic
- The insert indicator line does not appear in the correct position

**Phase to address:** Drag-and-drop phase

---

### Pitfall 8: Full Tree Re-Render After Every Edit Loses DnD Event Listeners

**What goes wrong:**
The current `editOp` flow calls `container.innerHTML = ''` and then `renderTree(...)` to rebuild the entire right panel after every edit. This works for the context menu flow in v1. But drag-and-drop requires `dragstart`, `dragover`, `drop`, and `dragend` listeners on every node. If the tree is fully rebuilt via `innerHTML = ''` after every drop, all listeners are wiped and re-added. For a small tree this is imperceptible. For a 500-node tree this causes a visible flash and potentially drops the first `dragstart` of the next gesture if the tree is still rendering.

More critically: if a drop triggers a server call (which is async), the tree will be re-rendered when the fetch resolves. If the user attempts a second drag before the first fetch resolves, they are dragging on elements whose listeners were added for the previous tree state. The `data-node-id` attributes on the DOM nodes are still the pre-drop IDs.

**Why it happens:**
`rerenderTree()` and the `editOp` inline render both use `container.innerHTML = ''` followed by a full `renderTree` call. This was fine for the context-menu-only v1 because context menu operations are discrete, not overlapping. Drag-and-drop creates overlapping async gestures.

**How to avoid:**
- Disable all drag handles during an in-flight server call. Set a `isEditPending` flag on the Alpine component; the `renderTree` options can pass this as `draggable: !isEditPending` to each node element.
- After the server returns the new tree and `rerenderTree()` fires, reset `isEditPending = false`.
- Do not allow a second drag to start while `isEditPending` is true — add a check in `dragstart`.
- Consider patching the DOM for simple reorder operations (move a `.tree-node` element from one container to another) rather than full re-render, to avoid the listener-wipe problem entirely. Only fall back to full re-render for complex operations.

**Warning signs:**
- A drag operation that appeared to succeed is reversed by a delayed server response
- The drag handle on a node does not respond after a quick sequence of drag operations

**Phase to address:** Drag-and-drop phase

---

### Pitfall 9: Export Round-Trip Breaks for 3-Level Hierarchy with Empty Sub-Categories

**What goes wrong:**
The exporter (`exporter.js`) recursively serialises the tree with `serializeNode`. For a 3-level hierarchy, the output is: `<DT><H3>Development</H3> <DL><p> <DT><H3>JavaScript</H3> <DL><p> ... </DL><p> </DL><p>`. If a sub-category folder ends up empty (all its links were deleted via the review panel), `serializeNode` emits an empty `<DL><p></DL><p>` block. Chrome's importer creates an empty folder for each of these blocks — the user sees empty folders in their imported bookmarks that they thought they had removed.

**Why it happens:**
The existing `buildHierarchy` never creates empty folders (it only creates a folder if there are links to put in it). But once the hierarchy is built and the user deletes links from the review panel, sub-category folders can become empty. The current exporter does not filter empty folders before serialising — and in v1 with a 2-level tree, this was not a problem because all links were direct children of category folders.

**How to avoid:**
Add an `pruneEmpty` pass in the export route (or in `exportToNetscape`) that recursively removes folders with no children before serialising. This already exists conceptually in the project (`Empty folders absent from exported file` is a v1.0 validated requirement), but it needs to handle the new 3-level depth — the current pruning logic must be verified to handle nested empty folders, not just top-level empty folders.

Write a test: create a tree with a 3-level hierarchy where one sub-category folder is empty. Call `exportToNetscape`. Parse the output. Verify no empty `<DL>` blocks appear.

**Warning signs:**
- Round-trip test (`roundtrip.test.js`) passes (it only counts bookmarks, not folders)
- Empty folders visible in Chrome after import — caught only by manual testing

**Phase to address:** Sub-categorisation phase, before closing the export integration

---

### Pitfall 10: Sub-Category Labels Vary by Capitalisation and Punctuation, Causing Spurious Splits

**What goes wrong:**
The sub-categorisation logic produces labels like `"JavaScript"`, `"Javascript"`, `"javascript"`, and `"Node.js"` depending on how the keyword was matched or which metadata field was used. `buildHierarchy` groups by exact string equality. Three bookmarks that should be in the same `Development/JavaScript` folder land in three separate sub-folders.

**Why it happens:**
`classifyByMetadata` lowercases the input text for keyword matching but does not normalise the output label — the category label is taken from the `CATEGORY_KEYWORDS` object key (always consistent), but any new sub-category label derived from metadata content (e.g., using the matched keyword as the sub-category name) will inherit whatever case the source text had.

**How to avoid:**
Sub-category labels must come from a controlled vocabulary, not from raw metadata content. Define a fixed sub-taxonomy parallel to the top-level taxonomy: `{ Development: ['JavaScript', 'Python', 'DevOps', 'Cloud', 'Other'] }`. The sub-classifier maps to entries in this list, not to free-form strings. Apply the same normalisation pattern as the top-level classifier: fixed label list, keyword-to-label mapping, no free-form output.

**Warning signs:**
- The hierarchy contains two folders whose names are the same word in different cases
- A sub-category folder contains only one or two items when by subject matter it should have ten

**Phase to address:** Sub-categorisation phase, taxonomy design step (before implementation)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using random UUIDs for sub-category folders in buildHierarchy | No code change needed | Edit operations silently no-op after rebuild; stale IDs in DOM | Never — deterministic IDs are straightforward |
| Expanding CATEGORY_KEYWORDS without a golden-file regression test | Faster to write | Silent category regressions when keywords are added or reordered | Never — the test takes 20 minutes to write |
| Implementing DnD as server-round-trip for every reorder | Simpler — reuses existing editOp flow | Async latency makes drag feel broken; overlapping drags corrupt state | Acceptable only if drag is disabled during pending fetch |
| Pruning empty folders only at top level | Simpler pruning code | Empty sub-category folders appear in Chrome import | Never — 3-level pruning is a 5-line recursive addition |
| Free-form sub-category labels derived from metadata | No taxonomy design needed | Inconsistent labels, spurious folder splits | Never — fixed sub-taxonomy is required for coherent output |
| innerHTML = '' + full re-render after every DnD drop | No DOM patching logic | Listener wipe, flash on large trees, overlapping-gesture bugs | Acceptable if `isEditPending` guard is implemented |

---

## Integration Gotchas

These are specific integration risks between the v1.1 features and the existing codebase.

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| `buildHierarchy` → `session.classifiedTree` | Rebuilding the hierarchy replaces all folder IDs, breaking subsequent `editOp` calls that use the old IDs stored in `contextMenu.node.id` | Derive folder IDs deterministically from title path; preserve link node IDs from the classified tree |
| `renderTree` + DnD | Adding `draggable=true` to `.tree-folder-header` elements makes the folder expand click compete with drag initiation | Use a dedicated drag handle element inside the header (a grip icon); apply `draggable=true` only to the handle, not the full header |
| `contextMenu.visible` + DnD | Context menu position is stored as `{ x, y }` in Alpine state; if a drop moves the tree node, the context menu may point at the wrong element | Always set `contextMenu.visible = false` at `dragstart` |
| `getFolderList()` → move sub-menu | Returns all folders including sub-categories of the node being moved, creating circular-move targets in the menu | Filter out the source node and all its descendants before populating the move target list |
| `classifyByMetadata` ordering | `CATEGORY_KEYWORDS` iteration order is insertion order; reordering entries for readability changes which category wins for ambiguous titles | Add a comment marking the ordering as load-bearing; add a test that asserts category X wins over category Y for a specific ambiguous title |
| `exporter.js` `serializeNode` | Empty folder detection was written for 2-level tree; now needs to handle nested empty sub-folders | Recursively check `children.length === 0` after filtering empty children before emitting a folder node |
| `roundtrip.test.js` | Round-trip test counts bookmarks only — a 3-level hierarchy with empty sub-folders would pass the test but produce bad import | Add a folder-depth assertion and an empty-folder assertion to the round-trip test suite |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full `renderTree` rebuild on every DnD drop (with 3-level tree) | Visible flash; listeners lost; overlapping gestures | Patch DOM for reorder-only ops; full rebuild only on server response | >200 visible nodes |
| `Object.entries(CATEGORY_KEYWORDS)` scanned for every link during classification | Negligible at 500 bookmarks; measurable at 5000 | Pre-build a flattened keyword → category lookup at module load time | >2000 bookmarks in a single classification run |
| `getFolderList()` called on every context menu open (walks full tree) | Imperceptible at 500 nodes | Cache the folder list; invalidate on edit operations | >500 folders (unusual but possible with 3-level tree) |
| `isDescendant` called during every `moveNode` (recursive tree walk) | Currently O(n) per call; called once per move | Acceptable as-is; only becomes an issue if move validation is called in a hot loop | Not a concern for user-driven drag-and-drop |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Sub-categories appear in "Move to..." menu without indication of nesting depth | User cannot tell if "JavaScript" is a top-level folder or under "Development" | Show folder path in the move menu: "Development / JavaScript" not just "JavaScript" |
| Drag-and-drop available only on right panel (proposed structure) | User tries to drag on left panel (original structure) and nothing happens | Either disable drag affordance (no cursor change) on left panel, or show a tooltip: "Drag is available in the proposed structure panel" |
| Sub-category assignment is invisible to user | User sees "Development" with 200 items; sub-categories appear only after clicking in — no indication sub-folders exist | Expand the first level of the proposed tree by default so the user sees "Development > JavaScript (42), Python (31)..." immediately |
| Dropping a link onto a top-level category folder when a sub-category exists | Link is placed at the category level, not in any sub-category — creating a mixed folder with both links and sub-folders | Either prohibit links at the category level when sub-categories exist, or visually distinguish mixed folders |

---

## "Looks Done But Isn't" Checklist

- [ ] **Sub-categorisation:** Verify that `buildHierarchy` produces the same folder IDs on two calls with the same input — confirms deterministic IDs.
- [ ] **Sub-categorisation:** Verify that max folder depth is 3 — write a test with an input designed to create 4+ levels and confirm it is capped at 3.
- [ ] **Sub-categorisation:** Verify that empty sub-category folders after user edits do not appear in the export — manually delete all links from a sub-folder and export.
- [ ] **Classification quality:** Run the existing `classifier.test.js` suite after every keyword addition — confirm zero regressions before expanding keywords.
- [ ] **Classification quality:** Verify keyword ordering is preserved — add a comment in `CATEGORY_KEYWORDS` that ordering is load-bearing; confirm no refactor reorders entries.
- [ ] **Drag-and-drop:** Verify context menu does not open during an active drag — manually test right-click during a drag gesture.
- [ ] **Drag-and-drop:** Verify moving a folder into its own descendant is blocked — attempt the move via DnD and confirm the tree is unchanged.
- [ ] **Drag-and-drop:** Verify drop position is deterministic — drop at the top edge of a folder (should reorder before), middle (should move into), bottom edge (reorder after).
- [ ] **Integration:** Verify `editOp('delete')` still works after `buildHierarchy` is updated — confirm nodeId from context menu matches the session tree.
- [ ] **Integration:** Verify the move sub-menu does not list the source folder itself or any of its descendants as valid targets.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Random UUIDs in buildHierarchy break edit ops | HIGH | Switch to deterministic IDs in buildHierarchy; audit all downstream consumers of node IDs; regression test all edit operations |
| Keyword expansion causes classification regressions | MEDIUM | Revert the specific keywords that caused regressions; add golden-file test before re-expanding |
| Drop target ambiguity causes incorrect moves | MEDIUM | Add explicit drop zone regions (top/middle/bottom strips) to the DnD implementation; add visual indicator |
| Empty sub-folders appearing in Chrome after import | LOW | Add recursive `pruneEmpty` pass to exporter; re-export and re-test |
| Sub-category labels are inconsistent case | MEDIUM | Normalise all sub-category labels against a fixed controlled vocabulary; re-run classification on existing session data |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Depth > 3 from naive sub-categorisation | Sub-categorisation phase (buildHierarchy redesign) | Unit test: deep-nesting input → assert max depth 3 |
| Random UUIDs break edit operations after rebuild | Sub-categorisation phase (before wiring edits) | Test: call buildHierarchy twice; assert all folder IDs are equal |
| Circular move via expanded folder list | Sub-categorisation phase + DnD phase | Test: move source folder into its own sub-folder; assert tree unchanged |
| Keyword over-fitting and ordering sensitivity | Classification quality phase (before expanding keywords) | Golden-file test with known bookmark → category pairs |
| Domain map / keyword fallback conflicts | Classification quality phase | Test: URL in domain map with conflicting keyword title; assert domain rule wins; document as intentional |
| DnD events conflicting with context menu | DnD phase | Manual test: right-click during active drag |
| Drop target ambiguity | DnD phase | Manual test: drag to top/middle/bottom of folder; verify correct insert position each time |
| Full re-render loses DnD listeners | DnD phase | Test: perform two rapid sequential drags; assert both take effect |
| Empty sub-folders in export | Sub-categorisation phase (close-out) | Round-trip test with empty sub-folders; assert no empty `<DL>` blocks |
| Inconsistent sub-category labels | Sub-categorisation phase (taxonomy design) | Test: classify 10 variations of a JavaScript URL; assert all map to same sub-category label |

---

## Sources

- Direct inspection of `/home/alan/code/claude/gsd/src/hierarchyBuilder.js` — confirmed random UUID usage, single-level only, no depth guard
- Direct inspection of `/home/alan/code/claude/gsd/src/classifier.js` — confirmed insertion-order dependency in CATEGORY_KEYWORDS, domain rule always beats metadata
- Direct inspection of `/home/alan/code/claude/gsd/src/shared/treeOps.js` — confirmed moveNode circular guard; getFolderList pattern in app.js does not filter descendants
- Direct inspection of `/home/alan/code/claude/gsd/public/app.js` — confirmed full innerHTML wipe + renderTree on every editOp; confirmed isDragging flag exists but is for file DnD only, not node DnD
- Direct inspection of `/home/alan/code/claude/gsd/src/routes/edit.js` — confirmed structuredClone pattern; confirmed no-op returns on node-not-found (silent failure)
- Direct inspection of `/home/alan/code/claude/gsd/src/exporter.js` — confirmed no empty-folder pruning in serializeNode; recursive but no depth guard
- Direct inspection of `/home/alan/code/claude/gsd/test/roundtrip.test.js` — confirmed only bookmark count is validated, not folder depth or empty folder presence
- HTML Drag and Drop API — MDN Web Docs (bubbling, drop zone regions): https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
- Alpine.js event handling and x-on directive — context menu + DnD interaction: https://alpinejs.dev/directives/on
- Deterministic ID generation for tree nodes (hash-based): common pattern in virtual DOM reconciliation literature

---
*Pitfalls research for: Bookmark Cleaner v1.1 — sub-categorisation, classification quality, drag-and-drop*
*Researched: 2026-03-24*
