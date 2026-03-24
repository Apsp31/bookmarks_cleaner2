# Feature Research — v1.1 Quality & Navigation

**Domain:** Chrome bookmark cleaner / organizer (local web app, file-in / file-out workflow)
**Researched:** 2026-03-24
**Milestone:** v1.1 (subsequent to v1.0 shipped 2026-03-24)
**Confidence:** MEDIUM-HIGH

> This document covers the three NEW features for v1.1. v1.0 features (parse, export, dedup, fuzzy
> merge, link checker, keyword classifier, single-level hierarchy, two-column review UI with context
> menu) are fully built and NOT re-researched here.

---

## Feature 1: Sub-Categorisation (2–3 Level Hierarchy)

### What Users Expect

A "Development" folder containing 300 bookmarks is unusable. Users with large collections expect
the tool to produce sub-folders automatically — they've seen this in file managers, bookmarking
services (Raindrop.io, Notion), and browser bookmark bars that they've manually maintained over
years. A flat 1-level category is table stakes for small collections; for large ones it feels broken.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sub-folders for large categories | Category with >20–30 items is browsable but unwieldy; >50 is overwhelming | MEDIUM | Threshold is the key decision (see below) |
| Max depth respected (3 levels) | v1.0 already promised this; users expect the promise to hold with sub-categories | LOW | root(0) → category(1) → sub-category(2) → link(3) — no deeper |
| Empty sub-folders absent from export | Same expectation as empty top-level folders | LOW | Already handled by existing empty-folder cleanup logic |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Predefined sub-category taxonomy per top-level category | Consistent, recognisable structure rather than algorithmically-derived noise | LOW-MEDIUM | Predefined is more reliable than derived for small datasets |
| Threshold control to avoid unnecessary splitting | Small categories should not get sub-folders nobody asked for | LOW | A single configurable constant is sufficient; not a user-facing setting |
| "Other" sub-folder as catch-all within each category | Items that don't fit sub-categories still have a home | LOW | Avoids classification dead-ends |

### Sub-Category Taxonomy (Predefined, per Research)

This is a proposed set of sub-categories per top-level category based on observed developer
bookmark collections, standard taxonomy structures, and the existing DOMAIN_RULES map.

**Development** (most likely to overflow — 143 domain rules mostly point here):
- Frontend — HTML, CSS, JS, React, Vue, design systems, browser APIs
- Backend — Node, Python, Go, databases, APIs, server tooling
- DevOps / Cloud — Docker, Kubernetes, AWS, GCP, Azure, CI/CD, Terraform
- Tools — IDEs, code playgrounds, formatters, regex testers, generators
- Learning — tutorials, courses, documentation sites, reference docs
- Other — anything in Development that doesn't match above sub-categories

**Design:**
- Inspiration — Dribbble, Awwwards, design portfolios
- Assets — fonts, icons, image libraries, stock photos
- Tools — Figma, Sketch, colour pickers, SVG editors
- Other

**Learning / Reference:**
- Courses — Coursera, Udemy, Egghead, Frontend Masters
- Documentation — MDN, official language/framework docs
- Articles — one-off reads, blog posts, tutorials
- Other

**News:**
- Tech — Hacker News, Ars Technica, The Verge, TechCrunch
- General — NYT, Guardian, BBC, Reuters
- Other

**Social / Community:**
- Forums — Reddit, HN, Lobste.rs, Stack Overflow
- Professional — LinkedIn, Twitter/X
- Messaging — Discord, Slack
- Other

**Shopping**, **Finance**, **Video**, **Tools**: These categories rarely overflow past the
threshold; no predefined sub-categories needed for v1.1. If they do overflow, route to "Other"
within the category.

### Threshold for Triggering Sub-Categorisation

Research finding (MEDIUM confidence, derived from bookmark organiser UX guides and cognitive load
literature): A folder becomes "browsable" at fewer than ~20–25 items. Users start feeling friction
at 30+ and frustration at 50+. No industry-standard threshold exists for auto-sub-categorisation
tools.

**Recommendation: split when a top-level category contains > 20 links.**

Rationale:
- 20 links in a folder is 1–2 screenfuls; still manageable.
- Sub-categorising a 12-item "Design" folder produces noise, not value.
- The threshold is a constant in `hierarchyBuilder.js`, not user-facing, so it can be tuned
  without API changes.

### Predefined vs Derived Sub-Categories

**Predefined wins here.** Reasons:
1. The domain rules map (`DOMAIN_RULES`) already assigns bookmarks to known categories. The
   domains that map to "Development" can be further tagged as frontend/backend/devops at the
   domain-rules level — no text analysis needed.
2. Derived sub-categories (e.g. TF-IDF clusters) require enough items per cluster to be
   meaningful. With 20–50 bookmarks in a category, TF-IDF clustering produces unstable,
   unrecognisable labels ("javascript react component" is not a folder name).
3. Predefined taxonomy produces consistent, expected folder names that users recognise and trust.
4. Personalisation (users renaming folders) is already supported by the context menu; they can
   rename "Frontend" to "JS" if they prefer.

### Implementation Dependencies

- Builds directly on `buildHierarchy()` in `src/hierarchyBuilder.js` — it currently groups links
  into top-level folders. Sub-categorisation is an extension of step 3 (folder node creation).
- The `DOMAIN_RULES` map in `src/classifier.js` needs sub-category tags added. Two approaches:
  - Option A: Add a second-tier field to DOMAIN_RULES (e.g. `{ category: 'Development', sub: 'DevOps / Cloud' }`).
  - Option B: Keep DOMAIN_RULES flat and add a separate SUB_CATEGORY_RULES map keyed on the same
    hostname. This is cleaner for the existing code that reads `DOMAIN_RULES`.
  - Recommendation: Option B — separate map, no mutation to the existing structure.
- `classifyNode()` would be extended to add a `subCategory` field alongside `category`.
- `buildHierarchy()` would add a nested step: after grouping by category, if `catLinks.length >
  SUBCATEGORY_THRESHOLD`, group catLinks by `subCategory` and emit sub-folder nodes.
- Sub-category labels for items not in the new sub-rules map default to `'Other'`.

---

## Feature 2: Classification Quality Improvement

### What Users Expect

The classifier should produce sensible folder assignments for bookmarks from sites it hasn't seen
before. Getting "Other" for 30% of a collection feels like the tool gave up. Users expect
classification to work for at least 80–90% of a typical personal collection without any API keys.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Expanded domain rules coverage | 143 rules is a start; real collections have long-tail domains | LOW | Pure data addition, no code change |
| Reasonable fallback for unknowns | "Other" catch-all is acceptable only for truly obscure sites | LOW | Already exists; quality improvement reduces how often it fires |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sub-domain awareness | `docs.python.org` → Development/Documentation; `shop.brand.com` → Shopping | LOW-MEDIUM | Pattern matching on hostname segments before full lookup |
| URL path hints | `/blog/`, `/shop/`, `/docs/`, `/wiki/` in path are strong signals even for unknown hosts | LOW | Regex patterns on `pathname` component of URL |
| Expanded keyword coverage per category | More keywords = fewer "Other" escapes from the metadata layer | LOW | Pure data addition to `CATEGORY_KEYWORDS` |
| Title-based first-word matching | Page titles often lead with the category: "How to use Docker..." → Development | LOW | Trivial extension of existing `classifyByMetadata` |

### What NOT to Do (Anti-Features for Classification)

| Feature | Why Problematic | What to Do Instead |
|---------|-----------------|-------------------|
| TF-IDF weighting | Requires a corpus to compute IDF; at individual bookmark scale (single document per URL), TF-IDF degenerates to TF — just keyword frequency. No benefit over current keyword scanning. | Expand `CATEGORY_KEYWORDS` lists; prioritise longer/more specific phrases |
| ML model embedding | Would produce better accuracy but introduces a model file, compute cost, and a build dependency — violates "clone + npm start" constraint | Domain rules + URL path hints + expanded keywords covers 85–90% |
| Free classification API (uClassify) | Listed in CLAUDE.md as "Out of Scope — uncertain longevity" | Stick with local-only classification |
| LLM calls for classification | Cost, latency, API key requirement; overkill when 90%+ is classifiable locally | Local rules + metadata is sufficient |

### Fallback Chain (Revised)

Current chain: `domain rules → OG metadata keywords → "Other"`

Proposed improved chain (all local, no API):
1. `classifyByDomain(url)` — existing, look up full hostname (strips www.)
2. NEW: `classifyBySubdomain(url)` — pattern-match on subdomain prefix (docs.*, shop.*, blog.*, api.*, cdn.*)
3. NEW: `classifyByUrlPath(url)` — pattern-match on pathname segments (/blog/, /docs/, /shop/, /wiki/, /learn/, /courses/)
4. `classifyByMetadata(metadata)` — existing, keyword scan on title + description
5. NEW: `classifyByTitleFirstWords(metadata)` — extract first 3–4 words from title; scan against category indicator words
6. `'Other'` — only fires if all of above return null

Steps 2, 3, 5 are cheap string operations with no network cost. They can be added to `classifier.js`
without changing the call sites in `classifyNode()`, just by extending the chain before the
`'Other'` fallback.

### URL Path Hints (Concrete Patterns)

| Path pattern | Inferred category |
|---|---|
| `/docs/` or `/documentation/` | Reference |
| `/blog/` | News (or Learning if `tutorial` in title) |
| `/wiki/` | Reference |
| `/shop/` or `/store/` or `/products/` | Shopping |
| `/learn/` or `/courses/` or `/tutorial/` | Learning |
| `/api/` | Development |

These patterns are applied only when domain lookup and subdomain lookup both return null. They
provide a coarse but reliable signal for long-tail sites.

### Subdomain Patterns (Concrete Patterns)

| Subdomain prefix | Inferred category |
|---|---|
| `docs.` | Reference |
| `api.` or `developer.` | Development |
| `blog.` | News |
| `shop.` or `store.` | Shopping |
| `learn.` or `courses.` | Learning |
| `cdn.` or `static.` or `assets.` | (skip — likely not a navigable bookmark) |

### Expanded Domain Rules

The existing 143 entries are good for English-speaking power users but miss:
- Regional news sites (e.g. `spiegel.de`, `lemonde.fr`)
- Developer tools added since the map was built (e.g. `bun.sh`, `deno.land`, `fly.io`, `railway.app`, `cursor.sh`)
- Design tools (e.g. `framer.com`, `webflow.com`, `spline.design`)

Adding 30–50 entries to `DOMAIN_RULES` is pure data and requires no test infrastructure changes.

### Implementation Dependencies

- All changes are in `src/classifier.js` — self-contained.
- `classifyNode()` signature and return shape unchanged — no downstream breakage.
- The extended fallback chain is additive; existing unit tests remain valid.
- New unit tests needed for: subdomain patterns, path patterns, expanded keyword matching.

---

## Feature 3: Drag-and-Drop Folder Reordering

### What Users Expect

After seeing a proposed hierarchy, users want to reorder top-level categories to match their
mental model (e.g. put "Development" first, push "Shopping" to the bottom). This is a strong
expectation from any tree UI — drag-and-drop reordering of peer-level items is a standard
affordance in file managers, Notion, Obsidian, and browser bookmark bars. Without it, the only
option is the existing context menu (delete/move/keep) which doesn't support reordering.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Drag folders to reorder within same parent | Core expectation of any tree with a user-editable list | MEDIUM | SortableJS on each folder's children container |
| Visual drop indicator (insertion line) | Without clear drop feedback, users misplace items | MEDIUM | A horizontal line showing insertion point — standard pattern |
| Drag handle icon on folder rows | Distinguishes "this is draggable" from "this is a click target" | LOW | ⠿ or ⋮⋮ grip icon, cursor: grab on hover |
| Dragged item appears "lifted" (opacity/shadow) | Confirms to user the item is being moved | LOW | CSS: opacity: 0.5 + box-shadow on the dragged element |

### Differentiators (for this tool specifically)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Moving bookmarks between folders via drag | Richer editing than context menu alone | HIGH | Requires cross-folder group config in SortableJS; significant state sync complexity |
| Drag folder INTO another folder (nest) | Merge by dragging | HIGH | Very hard to implement without accidental nesting; high error rate in practice |

### Anti-Features (Scope Boundaries)

| Feature | Why Requested | Why Problematic for v1.1 | Alternative |
|---------|---------------|--------------------------|-------------|
| Moving bookmarks via drag (cross-folder) | "Just drag it to the right folder" | Requires SortableJS cross-group config + complex server state sync + UI diff of which links moved where. The context menu (move) already covers this use case adequately. | Existing context menu "Move to folder" covers the same action with less risk |
| Drag folder into another folder (deep nesting) | "I want to reorganise the whole tree" | Creates accidental nesting; depth constraint becomes hard to enforce; undo needed | Defer to v2; note context menu handles individual moves |
| Undo for drag operations | "I dragged to the wrong spot" | Adds full history stack and revert UI. Significant complexity. | Instruct user to re-classify from scratch if structure is wrong; undo is v2+ |
| Keyboard drag (a11y) | Accessibility completeness | Out of scope for a personal local tool that one person uses. | Arrow-key reordering via context menu is the alternative |

### Recommended Scope for v1.1

**Only folder reordering within the same parent level.** Specifically:
- Top-level category folders can be dragged to reorder them relative to each other.
- Sub-category folders (level 2) can be dragged to reorder within their parent category.
- Individual bookmarks (links) are NOT draggable — use the existing context menu for link moves.
- Folders cannot be dragged into other folders — no nesting via drag.

This gives the user the most-requested capability (choose the order of "Development", "Design",
"News", etc.) without the complexity and error risk of cross-folder or cross-level moves.

### UX Patterns (Specific and Concrete)

**Drag handle placement:**
- A `⠿` or `⋮⋮` grip icon appears at the LEFT edge of each folder header row.
- The grip icon is always visible (not hover-only) — users need to know folders are draggable
  without having to discover it by accident.
- Cursor changes to `grab` on hover over the grip, `grabbing` during drag.
- The rest of the folder header retains `pointer` cursor for click-to-expand.

**During drag visual state:**
- The dragged folder row: `opacity: 0.4`, subtle `box-shadow`, `cursor: grabbing`.
- A horizontal insertion line (2px, accent colour, spans full row width) shows the drop target
  position — appears between items based on mouse Y position vs item midpoints.
- The insertion line moves in real time as the cursor moves through the dragover zone.
- Drop targets that would violate depth constraints (e.g. dragging a folder into a link row) show
  no insertion line and the cursor shows `not-allowed`.

**After drop:**
- The folder snaps to its new position.
- The dragged item returns to normal opacity and shadow immediately.
- The insertion line disappears.
- The new order is persisted to the server via a `POST /api/edit` call with `op: 'reorder'`,
  sending the parent folder ID and new ordered array of child IDs.

**Events used (HTML5 Drag API):**
- `dragstart` on folder header: set `dataTransfer.effectAllowed = 'move'`; tag the dragged node
  id on a shared variable.
- `dragover` on sibling folder rows and the parent container: `preventDefault()` to allow drop;
  compute Y-midpoint of each child to determine insertion position; render insertion line.
- `dragleave` on the container: clear insertion line.
- `drop` on the container: read dragged node id; compute new index from insertion line position;
  update tree state; POST to server.
- `dragend` on the folder: clean up visual state regardless of whether drop succeeded.

**SortableJS vs Native HTML5 Drag API:**

Two options exist for the right-panel tree (which uses vanilla DOM rendering via `renderTree()`
in `app.js`):

| Option | Pros | Cons | Fit |
|--------|------|------|-----|
| Native HTML5 Drag API | Zero dependency, already works with DOM-rendered tree, full control over insertion line | More code for insertion line + midpoint detection | Good — app.js uses vanilla DOM |
| SortableJS (CDN) | Less code, handles edge cases | Another CDN dependency; Alpine.js Sort plugin requires x-for rendered lists, not DOM-rendered trees | Awkward — the tree is DOM-rendered not Alpine x-for |

**Recommendation: Native HTML5 Drag API.** The `renderTree()` function builds the DOM directly
and the app avoids framework lock-in. SortableJS integration with the DOM-rendered tree would
require restructuring how the tree renders (moving to x-for lists). Native drag API gives full
control and the implementation is well-understood (MDN docs, multiple tutorials).

An alternative is SortableJS loaded via CDN and called imperatively after `renderTree()` by
attaching a new `Sortable` instance to each `tree-children` container. This avoids restructuring
the renderer and is a lower-risk approach — SortableJS handles the insertion indicator internally.

### State Synchronisation

The classified tree (`session.classifiedTree`) is the source of truth on the server. After a
reorder drag, the new child order must be sent to the server.

Proposed API extension to `POST /api/edit`:
```
{ op: 'reorder', folderId: '<uuid>', childIds: ['<id1>', '<id2>', ...] }
```

The server's `treeOps.js` would gain a `reorderChildren(tree, folderId, childIds)` function that
finds the folder by id and reorders its children array to match `childIds`. Returns the updated
tree. Pattern is identical to existing `deleteNode` / `moveNode`.

### Implementation Dependencies

- `renderTree()` in `public/app.js` — needs drag event listeners added to folder header rows, or
  SortableJS attached to `.tree-children` containers.
- `src/shared/treeOps.js` — needs a new `reorderChildren` function.
- `src/routes/edit.js` — needs to handle `op: 'reorder'` in the switch.
- The RIGHT panel only (proposed/classified tree) gets drag-and-drop. The LEFT panel (original
  tree) remains read-only.
- This depends on the existing review phase being in place (already built in v1.0).

---

## Feature Dependencies

```
[Sub-categorisation]
    └──extends──> [buildHierarchy() in hierarchyBuilder.js] (v1.0)
    └──extends──> [DOMAIN_RULES in classifier.js] (v1.0)
    └──requires──> [classifyNode() sub-category field addition]

[Classification quality]
    └──extends──> [classifyNode() chain in classifier.js] (v1.0)
    └──independent of──> [Sub-categorisation] (but feeds into it — better sub-category labels)

[Drag-and-drop reordering]
    └──extends──> [renderTree() in app.js] (v1.0)
    └──extends──> [treeOps.js] (v1.0 — needs reorderChildren)
    └──extends──> [edit.js route] (v1.0 — needs op: 'reorder')
    └──independent of──> [Sub-categorisation] (folder depth doesn't affect drag logic)
    └──independent of──> [Classification quality] (operates on already-classified tree)
```

### Dependency Notes

- **Classification quality should land before sub-categorisation** — better category assignments
  mean fewer "Other" items landing in sub-category buckets. If classification quality is improved
  first, sub-category rules map covers more items correctly.
- **Sub-categorisation and drag-and-drop are independent** — either can ship in isolation. If
  sub-categorisation ships first, drag-and-drop still works on the new 3-level tree. If
  drag-and-drop ships first, it works on the existing 2-level tree.
- **Neither new feature requires changes to the link checker, parser, exporter, or dedup
  pipeline** — all are entirely within the classifier + hierarchy builder + review UI layer.

---

## Feature Prioritisation Matrix (v1.1)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Classification quality — expanded domain rules (data only) | HIGH | LOW | P1 |
| Classification quality — URL path + subdomain hints | HIGH | LOW | P1 |
| Sub-categorisation — extended hierarchyBuilder | HIGH | MEDIUM | P1 |
| Sub-categorisation — sub-category domain rules map | HIGH | LOW | P1 |
| Drag-and-drop folder reordering (same-level only) | MEDIUM-HIGH | MEDIUM | P1 |
| Classification quality — expanded keyword lists | MEDIUM | LOW | P2 |
| Drag-and-drop — move bookmarks cross-folder | MEDIUM | HIGH | P3 (defer) |
| Drag-and-drop — drag folder into folder (nesting) | LOW | HIGH | P3 (defer) |

---

## Sources

- Alpine.js Sort plugin: https://alpinejs.dev/plugins/sort — confirmed CDN sort uses SortableJS
- SortableJS docs: https://sortablejs.github.io/Sortable/ — nested group config, fallbackOnBody, swapThreshold
- Cloudscape Design System drag-and-drop patterns: https://cloudscape.design/patterns/general/drag-and-drop/ — drag-indicator icon, cursor patterns, drop preview
- MDN HTML Drag and Drop API: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API — dragstart/dragover/drop/dragend event model
- "Building Sortable Tree" (Marc Dahmen): https://dev.to/marcantondahmen/building-sortable-tree-a-lightweight-drag-drop-tree-in-vanilla-typescript-f7l — callback pattern (onChange with source/target parent nodes)
- Bookmarkify best practices: https://www.bookmarkify.io/blog/best-way-to-organize-bookmarks-5ceba — 2-3 level depth recommendation, cognitive load limits
- Bookmark taxonomy gist: https://gist.github.com/RebeccaWhit3/bee652f44c69db884f302ecfdf13b02f — sub-category vocabulary reference
- frontend-dev-bookmarks (dypsilon): https://github.com/dypsilon/frontend-dev-bookmarks — real-world developer bookmark taxonomy at scale
- Quora bookmark organisation threads — community patterns for how developers categorise bookmarks
- Existing v1.0 codebase: src/classifier.js (143 DOMAIN_RULES, CATEGORY_KEYWORDS), src/hierarchyBuilder.js (buildHierarchy, single-level), public/app.js (renderTree DOM implementation)

---

*Feature research for: Chrome bookmark cleaner / organizer — v1.1 Quality & Navigation milestone*
*Researched: 2026-03-24*
