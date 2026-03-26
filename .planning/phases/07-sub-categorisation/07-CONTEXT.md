# Phase 7: Sub-Categorisation - Context

**Gathered:** 2026-03-26 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Automatically split large category folders into named sub-folders so the hierarchy is navigable at 2–3 levels deep. Deliverables: deterministic node IDs in `buildHierarchy`, automatic sub-folder creation when a category exceeds the configured threshold, a predefined sub-taxonomy for Development (Frontend, Backend, DevOps/Cloud, Tools, Learning, AI/ML), depth cap at 3 levels, and empty folder pruning after user deletes. Classification logic is untouched — sub-categorisation is a structural step only.

</domain>

<decisions>
## Implementation Decisions

### Node ID Strategy (HIER-01)
- **D-01:** Change `crypto.randomUUID()` folder IDs in `buildHierarchy` (currently at `src/hierarchyBuilder.js` lines 63, 71) to deterministic IDs derived from the category title — a stable slug such as `folder-development`. Link node IDs are unchanged (they're already stable from parsing and inherit IDs from the bookmark tree).
- **D-02:** The deterministic ID scheme must handle slug collisions (two folders with the same title). Use a counter suffix if needed (e.g. `folder-development-2`), or prefer a hash of the full path from root.
- **D-03:** Edit operations in `src/routes/edit.js` find nodes by `id` via tree-walk — deterministic folder IDs ensure that any `targetFolderId` from a previous render remains valid after a classify re-run.

### Sub-Categorisation Placement (HIER-02, HIER-03, HIER-04, HIER-05)
- **D-04:** Sub-folder logic lives entirely inside `buildHierarchy` in `src/hierarchyBuilder.js`. After grouping links by top-level category, if a group's link count exceeds `SUBCATEGORY_THRESHOLD` (default: 20, named constant), the group is split into sub-folders.
- **D-05:** `classifier.js` is not modified. Sub-categorisation is purely structural — it redistributes links already assigned a category into sub-folders within that category. No reclassification step.
- **D-06:** Sub-taxonomy for Development: Frontend, Backend, DevOps/Cloud, Tools, Learning, AI/ML. This is the only taxonomy defined in this phase; other categories get sub-folders only if they exceed threshold, falling back to an "Other" sub-folder for unmatched links within that category.
- **D-07:** AI/ML sub-category explicitly covers openai.com, huggingface.co, and similar — these are already classified as Development by `classifier.js` and will be redistributed to the AI/ML sub-folder.
- **D-08:** `SUBCATEGORY_THRESHOLD` (default 20) and `SUBCATEGORY_MIN_COVERAGE_RATIO` (default 0.6 — skip sub-splitting if fewer than 60% of links fit named sub-categories) are both named constants in `hierarchyBuilder.js`. Noted in STATE.md: expose as named constants, not hardcoded inline.
- **D-09:** Sub-taxonomy domain-to-sub-category mapping lives inside `buildHierarchy` (or a local constant within `hierarchyBuilder.js`), not in `classifier.js` — keeps sub-categorisation structural concerns separate from classification domain knowledge.

### Depth Cap and Empty Folder Pruning (HIER-06)
- **D-10:** Depth cap enforced by design in `buildHierarchy`: max 3 levels — root → category → sub-category, with links as leaves at depth 2 under sub-folders. No link may be placed deeper than level 3.
- **D-11:** Empty folder pruning implemented as a `pruneEmptyFolders(tree)` utility in `src/shared/treeOps.js`, called from the edit route (`src/routes/edit.js`) after every mutation. This keeps session state clean so both the UI tree panel and the exporter see no empty folders.
- **D-12:** The exporter (`src/exporter.js`) is NOT modified — it serialises whatever it receives. Correctness is guaranteed upstream by the prune step in the edit pipeline.

### Test Coverage (HIER-06)
- **D-13:** New tests in `test/hierarchyBuilder.test.js` covering: sub-folder creation when threshold exceeded, AI/ML sub-categorisation, depth cap assertion (max depth = 3), and `SUBCATEGORY_MIN_COVERAGE_RATIO` skip behaviour.
- **D-14:** New or extended test in `test/exporter.test.js` for "no empty `<DL>` blocks" assertion on a tree that contains empty folder nodes (round-trip test).
- **D-15:** Uses existing `node:test` + `node:assert/strict` pattern — no new test framework.

### Claude's Discretion
- Exact domain-to-sub-category mapping for the Development sub-taxonomy (which domains map to Frontend vs Backend vs Tools etc.)
- Whether sub-taxonomy mapping is a `Map`, plain object, or switch statement inside `buildHierarchy`
- The precise slug/hash algorithm for deterministic IDs, as long as collisions are handled
- Whether `pruneEmptyFolders` is called on every edit mutation or only before export (edit pipeline preferred per D-11, but timing is open)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Sub-Categorisation — HIER-01 through HIER-06 (exact acceptance criteria)
- `.planning/ROADMAP.md` §Phase 7 — Success criteria (5 items) and UI hint

### Source files to read before implementing
- `src/hierarchyBuilder.js` — buildHierarchy, current crypto.randomUUID() usage (lines 63, 71), flatten/group/folder construction pipeline
- `src/classifier.js` — classifyNode, classifyTree, DOMAIN_RULES (how Development category is assigned); read to understand what sub-taxonomy must redistribute
- `src/routes/classify.js` — classify pipeline: classifyTree → buildHierarchy call sequence
- `src/routes/edit.js` — how edit operations find nodes by id; where pruneEmptyFolders call will be inserted
- `src/shared/treeOps.js` — existing moveNode, deleteNode, findNodeById utilities; pruneEmptyFolders goes here
- `src/exporter.js` — serialisation of children: [] (currently unconditional, no pruning)
- `public/app.js` — renderTree, Alpine state; how node IDs are used in frontend edit ops
- `test/hierarchyBuilder.test.js` — existing maxDepth helper (lines 19–22) and depth-cap test (lines 79–86) to update
- `test/exporter.test.js` — where empty-DL round-trip test will be added
- `test/roundtrip.test.js` — existing round-trip coverage

### Prior phase context (locked decisions)
- `.planning/milestones/v1.0-phases/04-classifier-and-structure/04-CONTEXT.md` — D-01 through D-18: buildHierarchy design, session state shape, immutable-stage pattern
- `.planning/phases/06-classification-quality/06-CONTEXT.md` — D-05 through D-08: hyphen-prefix folder preservation (preserved categories must survive sub-categorisation — don't sub-split `-Pinned` style folders); D-09 through D-12: reclassify toggle UI

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/treeOps.js`: existing `findNodeById`, `moveNode`, `deleteNode` — `pruneEmptyFolders` follows the same pure tree-walk pattern
- `buildHierarchy` in `src/hierarchyBuilder.js`: owns the flatten → group-by-category → folder construction pipeline — sub-folder split inserts naturally after the grouping step
- `classifyByDomain(url)` in `classifier.js`: DOMAIN_RULES already maps `openai.com` → Development, `huggingface.co` → Development — no changes needed, just redistribution
- `test/hierarchyBuilder.test.js`: `maxDepth(node)` helper function already exists (lines 19–22) — reuse for depth assertions

### Established Patterns
- **Immutable-stage**: `classifyTree` returns a new tree, never mutates input — `buildHierarchy` should also return a new tree
- **Named constants at top of file**: `SUBCATEGORY_THRESHOLD` and `SUBCATEGORY_MIN_COVERAGE_RATIO` follow the same pattern as existing constants (e.g. `DOMAIN_RULES`, `CATEGORY_KEYWORDS` in `classifier.js`)
- **Pure functions**: classifier functions have no Express/session dependencies — `buildHierarchy` and `pruneEmptyFolders` must also be independently testable
- **TDD first**: prior phases wrote unit tests before implementation (Phase 4 D-16, Phase 6 D-14)

### Integration Points
- `src/hierarchyBuilder.js`: Replace `crypto.randomUUID()` with deterministic slug/hash; add sub-folder split after group-by-category; expose `SUBCATEGORY_THRESHOLD` and `SUBCATEGORY_MIN_COVERAGE_RATIO` as named constants
- `src/shared/treeOps.js`: Add `pruneEmptyFolders(tree)` utility
- `src/routes/edit.js`: Call `pruneEmptyFolders` after every mutation before writing back to session
- `test/hierarchyBuilder.test.js`: Update existing depth-cap test; add sub-taxonomy tests
- `test/exporter.test.js`: Add empty-`<DL>` round-trip test

### Hyphen-prefix folder consideration
- Per Phase 6 D-05–D-07: folders whose name starts with `-` are preserved as top-level folders in the classified hierarchy. `buildHierarchy` must NOT apply sub-categorisation to these folders — they are organisational markers, not categories to be split.

</code_context>

<specifics>
## Specific Ideas

- STATE.md records: "buildHierarchy must use deterministic hash-based IDs before any edit wiring — crypto.randomUUID() silently breaks editOp after rebuild" — this is the exact motivation for D-01.
- STATE.md records: "SUBCATEGORY_THRESHOLD and SUBCATEGORY_MIN_COVERAGE_RATIO exposed as named constants (not hardcoded inline)" — confirms D-08.
- REQUIREMENTS.md HIER-06: "round-trip tests assert max depth and no empty `<DL>` blocks in export" — the test must actually export to HTML and assert the absence of `<DL><p>\n</DL>` patterns.

</specifics>

<deferred>
## Deferred Ideas

- Sub-taxonomies beyond Development (Design, Finance, Shopping, News sub-folders) — noted in REQUIREMENTS.md §Future Requirements; explicitly deferred from Phase 6; not in scope here
- User-defined category rules (custom domain → category mappings) — Future Requirements
- `SUBCATEGORY_MIN_COVERAGE_RATIO` tuning against a real collection — implementation detail; expose constant and tune during execution per STATE.md blocker note

None — analysis stayed within Phase 7 scope.
</deferred>

---

*Phase: 07-sub-categorisation*
*Context gathered: 2026-03-26*
