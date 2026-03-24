# Architecture Research

**Domain:** Bookmark Cleaner v1.1 — sub-categorisation, classification quality, drag-and-drop
**Researched:** 2026-03-24
**Confidence:** HIGH (analysis based directly on existing source code — all file paths verified)

## Context

This document replaces the v1.0 pre-implementation architecture document. It is integration-focused: it answers how the three v1.1 features slot into the existing codebase, which files change, and in what order to build them. Architectural decisions already locked in for v1.0 are not re-litigated here.

---

## Existing Architecture (as-built, v1.0)

### System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      Browser (Alpine.js)                      │
│  ┌───────────────────┐       ┌───────────────────────────┐   │
│  │  Left panel        │       │  Right panel (editable)   │   │
│  │  renderTree()      │       │  renderTree() + context   │   │
│  │  (read-only)       │       │  menu (single shared div) │   │
│  └───────────────────┘       └───────────────────────────┘   │
│                      Alpine state: bookmarkApp{}              │
└──────────────────────────────┬───────────────────────────────┘
                               │ fetch / EventSource
┌──────────────────────────────▼───────────────────────────────┐
│                    Express 5 (server.js)                      │
│  routes/upload.js  routes/classify.js  routes/edit.js         │
│  routes/export.js  routes/check.js     routes/cleanup.js      │
│  routes/merge.js                                              │
└──────────┬───────────────────┬──────────────────────────────┘
           │                   │
  ┌────────▼──────┐   ┌────────▼────────────────────────────┐
  │ src/session.js│   │  src/ pipeline modules              │
  │ (singleton)   │   │  classifier.js  hierarchyBuilder.js │
  └───────────────┘   │  linkChecker.js  normalizer.js      │
                      │  parser.js       exporter.js        │
                      │  shared/treeOps.js  treeUtils.js    │
                      └─────────────────────────────────────┘
```

### Component Responsibilities (v1.0 state)

| Component | Responsibility | Key Constraint |
|-----------|---------------|----------------|
| `src/classifier.js` | DOMAIN_RULES map + CATEGORY_KEYWORDS scan → `.category` per link | Sequential chain: domain → metadata → 'Other' |
| `src/hierarchyBuilder.js` | Flatten classified links → root → category folders → links (depth 2) | Single-level only — D-08 deferred sub-folders |
| `src/shared/treeOps.js` | Pure delete/move/markKeep helpers | Depth-agnostic — moveNode works at any depth already |
| `src/shared/treeUtils.js` | pruneEmptyFolders, countLinks | No change needed |
| `src/shared/types.js` | BookmarkNode typedef | No new fields needed for v1.1 |
| `src/routes/classify.js` | POST /api/classify — chains classifyTree + buildHierarchy | No signature change needed |
| `src/routes/edit.js` | POST /api/edit — delete/move/keep against session.classifiedTree | No change — move already handles depth > 1 |
| `src/session.js` | In-memory singleton: tree, cleanTree, checkedTree, classifiedTree | No new fields needed |
| `public/app.js` | Alpine component + renderTree() vanilla renderer + context menu | renderTree options pattern supports layered extensions |

---

## Feature 1: Sub-Categorisation

### Where buildHierarchy Changes

`src/hierarchyBuilder.js` is the only file that changes. The classifier's role is unchanged: it produces a flat `.category` string per link (e.g. `'Development'`). The hierarchy builder is where flat groups become folder trees, and it is where the second level is added.

### Integrated vs Separate Pass

Use a **separate post-pass**, not integration into the existing grouping loop.

The existing grouping loop in `buildHierarchy` runs in three lines: collect links, group by category, build folders. Integrating sub-categorisation into that loop would make all three steps conditional and harder to read. A post-pass is cleaner:

```
buildHierarchy(classifiedTree):
  1. collectLinks()                           ← unchanged
  2. group by link.category                  ← unchanged
  3. build category folder nodes             ← unchanged
  4. for each category folder where children.length > SUBCATEGORY_THRESHOLD:
       replace direct link children with sub-folder nodes via addSubFolders()
  5. return root                             ← unchanged
```

The post-pass fires only for large categories (suggested threshold: 20 links). Collections with few bookmarks per category produce exactly the same tree as v1.0 — no regression risk.

### Tree Node Structure

No changes to the `BookmarkNode` typedef in `src/shared/types.js`. The existing shape already supports depth 3:

```
root (folder, depth 0)
  └── Development (folder, depth 1)        ← category folder
        └── AI / ML (folder, depth 2)      ← NEW sub-folder
              └── openai.com (link, depth 3)
```

A sub-folder is just a folder node whose parent is a category folder. Existing `moveNode`, `pruneEmptyFolders`, and `renderTree` are all depth-agnostic — they recurse without depth limits. No changes required downstream.

Do not add a `subCategory` field to BookmarkNode. Once `buildHierarchy` creates sub-folder nodes, the sub-category is encoded in the folder's title. A separate field would duplicate that information and diverge when users move nodes.

### Data Structure for Sub-Category Taxonomy

A plain exported `const` in `src/hierarchyBuilder.js` (or extracted to a new `src/taxonomy.js` if it grows large):

```js
export const SUBCATEGORY_TAXONOMY = {
  'Development': {
    'AI / ML':       { domains: ['openai.com', 'huggingface.co'], keywords: ['ai', 'machine learning', 'llm', 'neural', 'gpt'] },
    'Cloud / Infra': { domains: ['aws.amazon.com', 'cloud.google.com', 'azure.microsoft.com', 'kubernetes.io', 'docker.com', 'terraform.io', 'digitalocean.com'], keywords: ['kubernetes', 'docker', 'terraform', 'cloud', 'infra', 'deploy'] },
    'Frontend':      { domains: ['codepen.io', 'codesandbox.io', 'jsfiddle.net'], keywords: ['css', 'react', 'vue', 'svelte', 'html', 'frontend', 'component'] },
    'Packages':      { domains: ['npmjs.com', 'pypi.org', 'crates.io', 'rubygems.org', 'pkg.go.dev'], keywords: [] },
    'Docs':          { domains: ['developer.mozilla.org', 'docs.rs', 'devdocs.io', 'docs.python.org'], keywords: ['docs', 'documentation', 'reference', 'spec'] },
  },
  'Learning': {
    'Courses':   { domains: ['coursera.org', 'udemy.com', 'edx.org', 'pluralsight.com', 'frontendmasters.com', 'egghead.io', 'lynda.com'], keywords: ['course', 'mooc', 'certificate'] },
    'Practice':  { domains: ['leetcode.com', 'exercism.org', 'codecademy.com', 'freecodecamp.org', 'brilliant.org'], keywords: ['practice', 'challenge', 'exercise'] },
  },
  'Video': {
    'Streaming':     { domains: ['netflix.com', 'primevideo.com', 'disneyplus.com', 'hulu.com'], keywords: ['streaming', 'series', 'episode'] },
    'User Content':  { domains: ['youtube.com', 'vimeo.com', 'twitch.tv', 'dailymotion.com'], keywords: [] },
  },
};
```

Matching strategy inside `addSubFolders(categoryFolder, subTaxonomy)`:
1. For each link, extract hostname (strip www.), check against each sub-category's `domains` list.
2. If no domain match, scan `link.title + link.metadata?.description` against the sub-category's `keywords` list.
3. First match wins. Unmatched links go into a catch-all named after the parent category (e.g. `'Other Development'`), unless more than 60% of links are unmatched — in that case, skip sub-foldering entirely for that category (not enough coverage to be useful).

### Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `src/hierarchyBuilder.js` | Modified | Add `SUBCATEGORY_THRESHOLD` constant, `addSubFolders()` function, `SUBCATEGORY_TAXONOMY` constant (or import from new file) |
| `src/taxonomy.js` | New (optional) | Extract taxonomy only if the constant exceeds ~100 lines |
| All other files | None | No signature or interface changes required |

---

## Feature 2: Classification Quality

### Current Chain

```
classifyByDomain(url)      — DOMAIN_RULES hostname lookup
    ↓ null
classifyByMetadata(node.metadata)  — CATEGORY_KEYWORDS scan on OG title+description
    ↓ null
'Other'
```

### Should CATEGORY_KEYWORDS be Refactored or Extended?

**Extended first, then selectively refactored.** The sequential chain is correct — it is simple, debuggable, and has clear precedence. Weighted scoring would make debugging misclassifications much harder with minimal accuracy benefit for a personal tool.

The real problem is two-fold:
1. `DOMAIN_RULES` covers only 143 well-known domains. Personal collections contain hundreds of niche sites not in the map.
2. `CATEGORY_KEYWORDS` has false-positive risks: `'post'` (Social) matches too broadly; `'docs'` (Reference) fires before `'Learning'` gets a chance.

Fixes:
1. Expand `DOMAIN_RULES` — this is the highest-confidence path and is zero-risk (additive).
2. Tighten `CATEGORY_KEYWORDS` — remove overly generic terms, add multi-word phrases.
3. Add `classifyByUrlPattern()` as a new third step in the chain.

### New Fallback: classifyByUrlPattern

A new exported function in `src/classifier.js`:

```js
// Structural URL signals that work regardless of domain rules or page content.
// Checks subdomain patterns: docs.* → Reference, blog.* → News, shop.* → Shopping, etc.
export function classifyByUrlPattern(url) { ... }
```

Updated chain in `classifyNode`:

```js
const category =
  classifyByDomain(url) ??
  classifyByMetadata(node.metadata) ??
  classifyByUrlPattern(url) ??
  'Other';
```

Pattern examples worth implementing:
- Subdomain `docs.*` or `developer.*` → `'Reference'`
- Subdomain `blog.*` or `news.*` → `'News'`
- Subdomain `shop.*` or `store.*` → `'Shopping'`
- Subdomain `learn.*` or `courses.*` → `'Learning'`
- Path segment `/docs/` or `/documentation/` → `'Reference'`
- Path segment `/blog/` → `'News'`

This is low-risk because it only fires after domain rules and metadata both return null — it only helps the 'Other' bucket.

### Where the Fallback Sits in the Chain

The classify route (`src/routes/classify.js`) does not change. The new function is internal to `src/classifier.js`. The route calls `classifyTree(source)` which calls `classifyNode()` per link — the chain extension is invisible to the route layer.

### Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `src/classifier.js` | Modified | Expand `DOMAIN_RULES` (additive); tune `CATEGORY_KEYWORDS` (fix false positives); add `classifyByUrlPattern()` exported function; update `classifyNode()` to call it |
| `src/routes/classify.js` | None | No changes |
| All other files | None | No changes |

---

## Feature 3: Drag-and-Drop Folder Reordering

### Can DnD Layer on Top of renderTree() Without a Rewrite?

Yes. `renderTree()` creates plain `div.tree-node` elements. HTML5 DnD works on any element with `draggable="true"`. The function already uses an `options` object for callbacks (`onContextMenu`, `reviewMode`, `onMerge`, etc.). Adding an `options.onDrop` callback follows the exact same pattern — no rewrite needed, just additional attribute setting and event wiring inside the existing folder branch.

### Events and APIs Required

On each folder header element, when `options.onDrop` is present:

| Event | Action |
|-------|--------|
| `dragstart` | Set `dataTransfer.setData('text/plain', node.id)`; set `options.draggingId = node.id` on a shared ref |
| `dragover` | `e.preventDefault()` to enable drop; add CSS class `drag-over` for visual feedback; guard: skip if `node.id === draggingId` |
| `dragleave` | Remove `drag-over` CSS class |
| `drop` | Read `draggedId = dataTransfer.getData('text/plain')`; call `options.onDrop(draggedId, node.id)`; remove `drag-over` class |
| `dragend` | Clear `draggingId`; remove any lingering `drag-over` classes |

No third-party DnD library is needed. The HTML5 native API is sufficient for folder-level reordering on a local tool. Touch support is not a stated requirement.

### How a Drop Maps to POST /api/edit

A drop of folder A onto folder B means "move A into B". This is a direct mapping to the existing `move` operation:

```
options.onDrop(draggedId, targetFolderId)
    ↓
Alpine: _applyEdit('move', draggedId, targetFolderId)
    ↓
POST /api/edit { op: 'move', nodeId: draggedId, targetFolderId }
    ↓
edit.js: moveNode(structuredClone(session.classifiedTree), nodeId, targetFolderId)
    ↓
response: { classifiedTree: updated }
    ↓
Alpine: this.classifiedTree = updated; re-render right panel
```

The circular-move guard in `moveNode` (the `isDescendant` check at line 61 of `src/shared/treeOps.js`) already handles the case where a folder is dropped into its own subtree. No additional validation is needed in the route or the Alpine handler.

### Alpine State Changes

One new reactive property: `dragNodeId: null` — the id of the node currently being dragged. Used to suppress the `drag-over` highlight on the drag source node itself, and to clear it on `dragend`.

The `editOp()` method already handles move operations but it reads `this.contextMenu.node.id` for the source node — this is context-menu-specific plumbing. Drag-and-drop provides the node id directly. The cleanest approach is to extract the fetch + re-render logic from `editOp()` into a private `_applyEdit(op, nodeId, targetFolderId)` method, then have both `editOp()` and a new `onDropFolder(draggedId, targetFolderId)` method call it. This avoids duplicating the error handling and re-render logic.

```js
// Extracted helper — called by both context menu and DnD
async _applyEdit(op, nodeId, targetFolderId = undefined) {
  // existing fetch + classifiedTree update + re-render logic from editOp()
},

// Context menu handler (unchanged behaviour, now delegates)
async editOp(op, targetFolderId = undefined) {
  this.contextMenu.visible = false;
  this.showMoveMenu = false;
  await this._applyEdit(op, this.contextMenu.node.id, targetFolderId);
},

// DnD handler — called from renderTree options.onDrop
async onDropFolder(draggedId, targetFolderId) {
  this.dragNodeId = null;
  await this._applyEdit('move', draggedId, targetFolderId);
},
```

### Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `public/app.js` (Alpine component) | Modified | Add `dragNodeId: null` state; add `onDropFolder()` method; extract `_applyEdit()` helper from `editOp()`; pass DnD callbacks into `renderTree()` options in right-panel render calls |
| `public/app.js` (`renderTree()` function) | Modified | Add `draggable`, `dragstart`, `dragover`, `dragleave`, `drop`, `dragend` wiring in the folder branch, gated on `options.onDrop` being present |
| All server-side files | None | No changes — the move operation through `/api/edit` is already implemented |

---

## Data Flow Changes

### Sub-Categorisation — Pipeline View

```
POST /api/classify
    ↓
classifyTree(source)                    ← unchanged
    ↓
buildHierarchy(classified)              ← CHANGED: post-pass adds sub-folders for large categories
    ↓
{ classifiedTree }                      ← same JSON shape; depth can now be 3
    ↓
session.classifiedTree = classifiedTree ← unchanged
    ↓
Alpine: this.classifiedTree = data.classifiedTree
    ↓
renderTree() in right panel             ← unchanged (already recurses at any depth)
```

### Classification Quality — No Flow Changes

`classifyByUrlPattern` is a new function inside `src/classifier.js`, called only from `classifyNode`. The call site in `classifyNode`, the route, and all Alpine code are unchanged.

### Drag-and-Drop — Right Panel Edit Flow

```
User drags folder A header
    ↓
dragstart → dataTransfer.setData(A.id); Alpine.dragNodeId = A.id
    ↓
User hovers over folder B header
    ↓
dragover → e.preventDefault(); add drag-over CSS class to B (if B !== A)
    ↓
User releases over folder B
    ↓
drop → options.onDrop(A.id, B.id) → Alpine.onDropFolder(A.id, B.id)
    ↓
Alpine._applyEdit('move', A.id, B.id)
    ↓
POST /api/edit { op: 'move', nodeId: A.id, targetFolderId: B.id }
    ↓
edit.js: moveNode(structuredClone(session.classifiedTree), A.id, B.id)
    ↓ (moveNode circular guard fires if A is ancestor of B — no-op)
{ classifiedTree: updated }
    ↓
Alpine: this.classifiedTree = updated; re-render right panel
    ↓
dragend → Alpine.dragNodeId = null
```

---

## Recommended Build Order

Dependencies determine order. All three features are independent of each other — but building in this order maximises testability at each step.

### Phase 1 — Classification Quality (additive, zero structural risk)

- Expand `DOMAIN_RULES` in `src/classifier.js`
- Tune `CATEGORY_KEYWORDS` (remove over-broad terms, add multi-word phrases)
- Add `classifyByUrlPattern()` as third chain link in `classifyNode()`
- Validation: re-classify a real bookmark file; compare 'Other' count before/after
- Risk: LOW — purely additive; no structural changes; rollback is trivial

### Phase 2 — Sub-Categorisation (structural change to hierarchy output)

- Add `SUBCATEGORY_THRESHOLD`, `SUBCATEGORY_TAXONOMY`, and `addSubFolders()` to `src/hierarchyBuilder.js`
- Start with taxonomy entries for 'Development' and 'Learning' (highest-value categories based on DOMAIN_RULES coverage)
- Validation: re-classify a large Development-heavy collection; verify sub-folders appear and catch-all fires correctly when coverage is low
- Risk: MEDIUM — changes the classifiedTree shape consumed by edit/export; confirmed safe because treeOps and renderTree are depth-agnostic, but worth explicit testing

### Phase 3 — Drag-and-Drop (UI-only change)

- Extract `_applyEdit()` helper in `public/app.js`
- Add `dragNodeId` state and `onDropFolder()` method
- Wire DnD events in `renderTree()` folder branch
- Validation: drag category folder into another folder; drag a sub-folder out; verify circular-move guard fires when dragging parent onto its own child
- Risk: LOW — server already handles `move` op at any depth; HTML5 DnD is browser-native; no new dependencies

Build order rationale: Phase 1 improves the classification quality that Phase 2's sub-categorisation builds on (better top-level categories produce better sub-folder groupings). Phase 3 is fully independent and benefits from having a richer tree to drag around during testing.

---

## Anti-Patterns

### Anti-Pattern 1: Adding a subCategory field to BookmarkNode

**What people do:** Add `subCategory: string` to the typedef and carry it through the classification chain.
**Why it's wrong:** Sub-category is structural (which folder a link lives in), not intrinsic to the link. Once `buildHierarchy` creates sub-folder nodes, the structure is already encoded in the tree. A separate field creates a second source of truth that diverges when users move nodes via edit operations.
**Do this instead:** Sub-category lives only in the folder node's title. Links carry only `.category` (the top-level category label).

### Anti-Pattern 2: Running sub-categorisation inside classifyNode

**What people do:** Return a richer string like `'Development/Frontend'` from `classifyNode` to encode the sub-category at classification time.
**Why it's wrong:** `classifyNode` is a per-link function that lacks collection-wide context. Deciding whether to create a `'Frontend'` sub-folder requires knowing how many Development bookmarks exist and how many would fall into each sub-category — that is a grouping decision that requires seeing the whole collection, which only `buildHierarchy` has.
**Do this instead:** `classifyNode` continues to return flat category labels. `buildHierarchy` applies sub-categorisation as a post-pass after grouping is complete.

### Anti-Pattern 3: Rewriting renderTree() for drag-and-drop

**What people do:** Replace the vanilla JS renderer with SortableJS, a component framework, or a virtual DOM library to get DnD support.
**Why it's wrong:** `renderTree()` already handles arbitrary depth, context menus, expand/collapse, merge badges, and link-status decorations via the options callback pattern. It was explicitly designed to be extended. Replacing it would require re-implementing all of that logic.
**Do this instead:** Add DnD attributes and event handlers inside the existing folder branch of `renderTree`, gated on `options.onDrop` being present — the same pattern already used for `options.onContextMenu`.

### Anti-Pattern 4: Weighted scoring in the classification chain

**What people do:** Replace the sequential domain → metadata → URL-pattern chain with a score accumulator that assigns weights to each signal.
**Why it's wrong:** Debugging why a specific bookmark landed in the wrong category becomes difficult when classification is a weighted sum across multiple signals. The sequential chain has a clear contract: first confident match wins, and you can step through the chain to understand the result.
**Do this instead:** Extend `DOMAIN_RULES` coverage (high-confidence signal first), tighten `CATEGORY_KEYWORDS` (remove false positives), then add `classifyByUrlPattern` for structural signals. These three steps in sequence cover the vast majority of improvements needed.

---

## Integration Points Summary

### Files That Change

| File | Change Type | Feature |
|------|-------------|---------|
| `src/classifier.js` | Modified | Classification quality |
| `src/hierarchyBuilder.js` | Modified | Sub-categorisation |
| `src/taxonomy.js` | New (optional) | Sub-categorisation (if taxonomy is extracted) |
| `public/app.js` | Modified | Drag-and-drop |

### Files That Do Not Change

| File | Why Safe |
|------|----------|
| `src/shared/treeOps.js` | moveNode is depth-agnostic; circular guard handles DnD edge case |
| `src/shared/treeUtils.js` | pruneEmptyFolders recurses without depth limit |
| `src/shared/types.js` | No new fields needed on BookmarkNode |
| `src/routes/classify.js` | Route signature unchanged; output shape changes internally |
| `src/routes/edit.js` | Already handles move at any depth |
| `src/routes/export.js` | pruneEmptyFolders + exportToNetscape are depth-agnostic |
| `src/session.js` | No new session fields required |
| `server.js` | No new routes needed |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `routes/classify.js` to `hierarchyBuilder.js` | Direct function call | Route unchanged; output shape changes for large categories |
| `routes/edit.js` to `treeOps.js` | Direct function call | moveNode already depth-agnostic |
| `classifier.js` internal | Sequential chain | New `classifyByUrlPattern()` added as third step |
| `renderTree()` to Alpine DnD | `options.onDrop` callback | Same options pattern as existing `onContextMenu` |
| Alpine `editOp()` to `_applyEdit()` | Internal refactor | Shared logic extracted; context-menu and DnD both delegate to it |

---

## Sources

- `src/hierarchyBuilder.js` — confirmed single-level output, D-08 deferral comment at line 37–39
- `src/shared/treeOps.js` — confirmed moveNode is depth-agnostic with isDescendant circular guard at line 61
- `src/classifier.js` — confirmed 143-entry DOMAIN_RULES (counted), sequential chain in classifyNode at line 287–291
- `src/shared/types.js` — confirmed BookmarkNode shape; no subCategory field; children array unrestricted
- `public/app.js` — confirmed renderTree options pattern (lines 13–14); editOp fetch pattern (lines 520–551)
- MDN HTML Drag and Drop API: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API — confirmed dragstart/dragover/drop/dragend events; dataTransfer.setData/getData API; native browser support

---
*Architecture research for: Bookmark Cleaner v1.1 — sub-categorisation, classification quality, drag-and-drop*
*Researched: 2026-03-24*
