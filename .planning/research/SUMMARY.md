# Project Research Summary

**Project:** Bookmark Cleaner v1.1 — Quality & Navigation
**Domain:** Local Node.js utility app — bookmark file processor with browser review UI
**Researched:** 2026-03-24
**Confidence:** HIGH

## Executive Summary

Bookmark Cleaner v1.1 is a focused quality-and-navigation milestone building on a fully shipped v1.0. The three features — classification quality improvement, sub-categorisation (2–3 level hierarchy), and drag-and-drop folder reordering — are all additive to an existing, well-understood codebase. No new npm packages are required for the recommended approach: SortableJS is available via CDN if needed, but native HTML5 Drag and Drop API is preferred because `renderTree()` uses imperative DOM construction rather than Alpine `x-for` lists. Classification improvements are pure data/logic additions to `src/classifier.js`. Architecture research confirms that all three features integrate with minimal blast radius: only four files change (`src/classifier.js`, `src/hierarchyBuilder.js`, `public/app.js`, and optionally a new `src/taxonomy.js`).

The recommended build order is: classification quality first (additive, zero structural risk), then sub-categorisation (structural change to hierarchy output that benefits from better classifications), then drag-and-drop (UI-only, fully independent of the other two). This sequencing ensures sub-category groupings are as accurate as possible before the hierarchy is designed around them, and keeps the riskiest structural change (multi-level hierarchy) isolated to a single phase where it can be fully validated before UI work begins.

The critical risks are concentrated in the sub-categorisation phase: random UUIDs in `buildHierarchy` will silently break all edit operations after a rebuild — the fix is deterministic ID generation from title path before any edit wiring is connected. Naive sub-categorisation can also violate the 3-level depth constraint without an explicit guard. A secondary risk in the drag-and-drop phase is event interference between the new DnD listeners and the existing context menu. All risks are well-understood with clear prevention strategies documented in PITFALLS.md — they are not reasons to change the approach, only reasons to write the specified tests before closing each phase.

---

## Key Findings

### Recommended Stack

The v1.0 stack (Node.js 20+, Express 5.2.1, Alpine.js 3.x CDN, cheerio 1.2.0, p-limit 7.3.0, fastest-levenshtein 1.0.16, ESM) is unchanged and carries forward entirely. See CLAUDE.md for the full baseline.

For v1.1, no new npm packages are needed. SortableJS 1.15.7 is available via CDN as an option for drag-and-drop, but research recommends the native HTML5 Drag and Drop API because `renderTree()` uses imperative DOM construction rather than Alpine `x-for` lists — SortableJS integration would require restructuring the renderer. The `@alpinejs/sort` plugin is explicitly ruled out due to a known `x-for` + nested list DOM sync bug (Alpine discussion #4157). Classification improvements are code-only — no NLP library (`natural`, `wink-nlp`, `compromise`) is justified; the rules-based classifier already covers 80–90% of common domains and the gap is coverage, not algorithmic quality.

**Core v1.1 additions (no npm install required):**
- Native HTML5 Drag API — folder reordering — zero-dependency, integrates with imperative DOM tree via `options.onDrop` callback pattern
- `SUBCATEGORY_TAXONOMY` constant — sub-categorisation — plain exported `const` in `hierarchyBuilder.js` or extracted to `src/taxonomy.js`; no library needed
- Expanded `DOMAIN_RULES` (~300 entries target) — classification coverage — pure data addition, highest-confidence improvement path
- `classifyByUrlPattern()` function — URL path and subdomain signals — additive third step in the existing classification chain

### Expected Features

**Must have (table stakes):**
- Sub-folders for large categories (threshold: > 20 links) — a flat 200-item "Development" folder is unusable for navigation
- Max 3-level depth enforced as a hard constraint — promised in v1.0; must hold with sub-categories (root → category → sub-category → link)
- Empty sub-folders absent from export — same expectation as empty top-level folders; pruning logic must be extended to recursive depth
- Drag handle on folder rows with visual feedback — without a visible grip icon, users cannot discover draggability
- Visual drop indicator (insertion line) during drag — without clear drop feedback, users misplace items

**Should have (differentiators):**
- Predefined sub-category taxonomy (not algorithmically derived) — consistent, recognisable names; TF-IDF clustering on 20–50 items produces unstable, unrecognisable labels
- URL path hints and subdomain patterns in classifier — `docs.*`, `/blog/`, `/shop/` etc. as structural signals for long-tail domains; cheap string operations with no network cost
- "Other" catch-all sub-folder within each category — prevents classification dead-ends; skipped if > 60% of links would fall into it (not enough coverage to be useful)
- Threshold control to skip splitting small categories — no sub-folders for a 12-item "Design" folder; configurable constant, not user-facing

**Defer (v2+):**
- Drag bookmarks between folders — HIGH complexity; context menu "Move to" already covers this use case adequately without the state sync risk
- Drag folder into another folder (nesting via drag) — high accidental-nesting error rate; depth constraint enforcement becomes hard to verify
- Undo for drag operations — requires full history stack; v2+ scope
- NLP/ML classification (`natural`, `wink-nlp`) — requires training corpus; local rules + URL patterns cover 85–90% without dependencies

### Architecture Approach

All three v1.1 features integrate with the existing pipeline as additive changes to individual modules. The key insight from architecture research is that `renderTree()`, `moveNode()`, `pruneEmptyFolders()`, and the export serialiser are all already depth-agnostic — they recurse without depth limits — so the 3-level hierarchy change does not require updates downstream of `buildHierarchy`. The one exception is empty-folder pruning in the exporter, which was written for a 2-level tree and needs a recursive depth extension.

The drag-and-drop integration reuses the existing `move` operation via `/api/edit` without any server-side changes. `moveNode` in `treeOps.js` already has a circular-move guard (`isDescendant` check) that handles folder-into-own-subtree drops. The only Alpine state change needed is a `dragNodeId` property and extraction of `_applyEdit()` as a shared helper called by both the existing context menu and the new DnD handler.

**Major components and v1.1 changes:**
1. `src/classifier.js` — expands DOMAIN_RULES to ~300 entries; tightens CATEGORY_KEYWORDS; adds `classifyByUrlPattern()` as third chain link; no signature changes to `classifyNode()`
2. `src/hierarchyBuilder.js` — adds `SUBCATEGORY_THRESHOLD` constant, `SUBCATEGORY_TAXONOMY`, and `addSubFolders()` post-pass applied only to categories exceeding the threshold; folder IDs must become deterministic (hash-based, not `crypto.randomUUID()`)
3. `public/app.js` — extracts `_applyEdit()` helper; adds `dragNodeId: null` state; adds `onDropFolder()` method; wires HTML5 DnD events inside `renderTree()` folder branch gated on `options.onDrop` being present

**Files that do NOT change:** `src/shared/treeOps.js`, `src/shared/treeUtils.js`, `src/shared/types.js`, `src/routes/classify.js`, `src/routes/edit.js`, `src/routes/export.js`, `src/session.js`, `server.js`.

### Critical Pitfalls

1. **Random UUIDs in buildHierarchy silently break edit operations** — if `buildHierarchy` is re-invoked after any edit, all folder IDs change and subsequent `editOp` calls no-op silently (server finds no matching node; returns tree unchanged; client shows no error). Prevention: derive folder IDs deterministically from title path, e.g. `crypto.createHash('sha1').update('Development/JavaScript').digest('hex').slice(0,8)`. Write a test that calls `buildHierarchy` twice on the same input and asserts all folder IDs are identical across both calls.

2. **Sub-categorisation depth can exceed the 3-level hard constraint** — naive recursion or a grouping function without a depth guard can produce root → category → sub-category → sub-sub-category → link (depth 4). Prevention: add a `MAX_DEPTH = 3` constant with an explicit depth parameter; flatten remaining items at the deepest allowable level. Write a test with input designed to trigger 4-level nesting and confirm it caps at 3.

3. **Keyword classifier over-fits without a golden-file regression test** — expanding `CATEGORY_KEYWORDS` causes silent regressions when keywords are added or when `Object.entries()` iteration order shifts (insertion order is load-bearing). Prevention: establish a golden-file test with known bookmark → category expectations before any keyword additions; add a comment in the source marking ordering as load-bearing.

4. **DnD events interfere with the existing context menu** — `dragstart`/`drop` fire on the same elements as `contextmenu`; right-click during a drag can open the context menu and trigger an unintended edit operation. Prevention: add `isDraggingNode: false` flag to Alpine state; return early from `openContextMenu` when dragging; call `contextMenu.visible = false` at `dragstart`; use `e.stopPropagation()` on child DnD handlers.

5. **Empty sub-folders appear in Chrome after import** — user deletes all links from a sub-folder during review; existing empty-folder pruning only handles 2-level trees. Prevention: extend `pruneEmptyFolders` to recursively check nested folder children before serialisation; add a round-trip test asserting no empty `<DL>` blocks in output.

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Classification Quality

**Rationale:** Purely additive changes to `src/classifier.js` — expanding DOMAIN_RULES, tightening CATEGORY_KEYWORDS, adding `classifyByUrlPattern()`. Zero structural risk; rollback is trivial. Better classifications produced here directly improve sub-category groupings in Phase 2. The golden-file regression test established here protects the classifier through all future changes.

**Delivers:** Reduced "Other" bucket in classification output; subdomain and URL path signals for long-tail sites; protected classifier against ordering-sensitive regressions.

**Addresses:** Expanded domain rules coverage (P1), URL path hints and subdomain awareness (P1), expanded keyword precision (P2).

**Avoids:** Pitfall 4 (keyword over-fitting) — golden-file test written before any keyword additions; Pitfall 5 (domain map vs keyword fallback conflicts) — test asserting domain rule wins over conflicting keyword for any affected URL.

### Phase 2: Sub-Categorisation

**Rationale:** Structural change to `buildHierarchy` output — the classified tree depth increases from 2 to up to 3 levels for large categories. Must come after Phase 1 so classification quality feeds correct top-level categories into the sub-category grouping logic. This is the highest-risk phase: deterministic IDs must be implemented before edit operations are wired, and the depth constraint must be enforced with an explicit guard, not assumed from the flat design.

**Delivers:** Automatic sub-folders for large categories using predefined taxonomy; "Other" catch-all sub-folder; 3-level depth hard constraint enforced by `MAX_DEPTH` constant; empty sub-folder pruning in exporter extended to recursive depth.

**Addresses:** Sub-folders for large categories (table stakes for large collections), predefined taxonomy, threshold control, "Other" catch-all, max depth constraint, empty sub-folders in export.

**Avoids:** Pitfall 1 (random UUID IDs) — deterministic IDs implemented and tested before edit operations are wired; Pitfall 2 (depth > 3) — `MAX_DEPTH` constant and unit test; Pitfall 5 (empty sub-folders in export) — recursive pruning verified before phase closes; Pitfall 10 (inconsistent sub-category labels) — fixed controlled vocabulary from `SUBCATEGORY_TAXONOMY`, not free-form metadata output.

### Phase 3: Drag-and-Drop Folder Reordering

**Rationale:** UI-only change confined to `public/app.js`. Fully independent of Phases 1 and 2 — operates on whatever tree shape exists. Benefits from having a richer 3-level tree available during testing. No server-side changes needed: the existing `move` operation via `/api/edit` already handles folder moves at any depth.

**Delivers:** Drag handles on folder rows in the right (proposed) panel; visual drop indicator (insertion line); reordering of folders within the same parent level; `_applyEdit()` helper shared by context menu and DnD (removes code duplication in `editOp`).

**Addresses:** Drag handle with grip icon (table stakes), visual drop indicator (table stakes), folder reordering within same level (P1), dragged item visual state.

**Avoids:** Pitfall 6 (DnD / context menu event interference) — `isDraggingNode` flag and early return in `openContextMenu`; Pitfall 7 (drop target ambiguity) — three drop zones per folder (top/middle/bottom strips) with `getBoundingClientRect()` and `data-drop-zone` attributes; Pitfall 8 (full re-render loses DnD listeners) — `isEditPending` flag disables drag handles during in-flight server calls.

### Phase Ordering Rationale

- Classification quality before sub-categorisation: better top-level category assignments produce better sub-category groupings. Bookmarks that fall to the wrong top-level category are never reached by the sub-category taxonomy rules.
- Sub-categorisation before drag-and-drop: higher-risk structural change should be validated end-to-end (including export round-trip) before UI work begins on top of it. Phase 3 also benefits from testing against a richer 3-level tree.
- All three phases are otherwise independent — if sub-categorisation scope is cut, drag-and-drop can ship from a flat tree without changes.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Sub-Categorisation):** The `SUBCATEGORY_TAXONOMY` constant proposed in ARCHITECTURE.md covers Development, Learning, and Video. The 60% coverage threshold for skipping sub-foldering is a heuristic — expose as a named constant and tune against a real collection during phase execution. Domain entries within each sub-category will also need expansion against real bookmark samples.
- **Phase 3 (Drag-and-Drop):** The three-drop-zone pattern (top/middle/bottom strips with `getBoundingClientRect()`) has not been prototyped against the specific DOM structure of `renderTree()`. The interaction between the folder expand/collapse click target and the drag handle element needs careful `e.stopPropagation()` design to avoid zone misfires.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Classification Quality):** Expanding a DOMAIN_RULES map and adding URL pattern matching are well-understood, low-risk data additions. Golden-file test is the only guard needed — implement first, then expand.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | v1.0 stack carries forward unchanged; SortableJS vs native DnD recommendation is based on direct analysis of `renderTree()` implementation; `@alpinejs/sort` ruling is confirmed against a tracked Alpine issue (#4157) |
| Features | MEDIUM-HIGH | Feature set derived from bookmark organiser UX patterns; sub-category threshold (20 links) is an estimate from cognitive load literature with no industry standard to cite; 60% coverage skip threshold is a heuristic |
| Architecture | HIGH | Based on direct codebase inspection of all affected files with line numbers verified; integration risks are concrete; depth-agnostic claims for `treeOps` and `renderTree` verified against source |
| Pitfalls | HIGH (integration pitfalls); MEDIUM (DnD UX patterns) | Integration pitfalls derived from direct source inspection with specific failure modes described; DnD zone patterns from MDN and design system documentation |

**Overall confidence:** HIGH

### Gaps to Address

- **Sub-category taxonomy completeness:** `SUBCATEGORY_TAXONOMY` covers Development, Learning, and Video. Design, News, Social/Community, Shopping, Finance, and Tools are noted as "rarely overflow the threshold" but have no taxonomy entries. If those categories do overflow, items fall to "Other" within the category — acceptable for v1.1 but worth measuring on a real collection during Phase 2.
- **60% coverage skip threshold:** The rule "if > 60% of links in a category are unmatched by the sub-taxonomy, skip sub-foldering" is a heuristic, not a validated value. Should be exposed as a named constant (`SUBCATEGORY_MIN_COVERAGE_RATIO`) and reviewed after running Phase 2 against a real bookmark file.
- **Three-zone drop implementation:** The drop zone geometry logic (top/middle/bottom strips with `getBoundingClientRect()`) is well-specified in PITFALLS.md but not prototyped. The existing folder header element contains multiple child elements (expand icon, title, badge, context menu trigger) — careful `e.stopPropagation()` handling is needed to prevent zone misfires from child element events bubbling up.

---

## Sources

### Primary (HIGH confidence)
- `src/classifier.js` — direct inspection; confirmed 143 DOMAIN_RULES entries, sequential chain, insertion-order dependency in CATEGORY_KEYWORDS (line refs in ARCHITECTURE.md)
- `src/hierarchyBuilder.js` — direct inspection; confirmed single-level output, `crypto.randomUUID()` usage, D-08 deferral comment
- `src/shared/treeOps.js` — direct inspection; confirmed depth-agnostic `moveNode`, `isDescendant` circular guard at line 61
- `public/app.js` — direct inspection; confirmed `renderTree` options pattern; full `innerHTML` wipe on `editOp`; file-DnD `isDragging` flag exists (not reusable for node DnD)
- `src/routes/edit.js` — direct inspection; confirmed silent no-op on node-not-found (returns tree unchanged with no error flag)
- `src/exporter.js` — direct inspection; confirmed no empty-folder pruning in `serializeNode`; recursive but no depth guard
- MDN HTML Drag and Drop API: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
- SortableJS npm registry: https://registry.npmjs.org/sortablejs/latest — confirmed v1.15.7
- @alpinejs/sort npm registry: https://registry.npmjs.org/@alpinejs/sort/latest — confirmed v3.15.8

### Secondary (MEDIUM confidence)
- Alpine x-sort + x-for DOM sync issue: https://github.com/alpinejs/alpine/discussions/4157 — confirmed bug; resolved in PR #4361 but fragile for nested use
- Bookmarkify best practices: https://www.bookmarkify.io/blog/best-way-to-organize-bookmarks-5ceba — 2–3 level depth recommendation, cognitive load limits
- Cloudscape Design System drag-and-drop patterns: https://cloudscape.design/patterns/general/drag-and-drop/ — drag indicator icon, cursor patterns, drop preview zones
- frontend-dev-bookmarks (dypsilon): https://github.com/dypsilon/frontend-dev-bookmarks — real-world developer bookmark taxonomy at scale
- "Building Sortable Tree" (Marc Dahmen): https://dev.to/marcantondahmen/building-sortable-tree-a-lightweight-drag-drop-tree-in-vanilla-typescript-f7l — callback pattern for vanilla DnD trees

### Tertiary (LOW confidence — validate during execution)
- Sub-category threshold (20 links) — derived from cognitive load literature and bookmark UX guides; no industry standard; treat as a tunable constant
- 60% coverage skip threshold — heuristic only; validate against real collections during Phase 2 execution

---
*Research completed: 2026-03-24*
*Ready for roadmap: yes*
