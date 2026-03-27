# Milestones

## v1.1 Quality & Navigation (Shipped: 2026-03-27)

**Phases completed:** 3 phases (6–8), 7 plans, 11 tasks

**Key accomplishments:**

- classifyTree extended with hyphen-prefix folder preservation via folder-name threading, classify route wired to accept reclassifyFolders Set, and CATEGORY_KEYWORDS tightened by removing 11 overloaded terms without golden-file regression
- Alpine reclassifyFolders Set with opt-in toggle badge on hyphen-prefix folders in checked state, wired to POST /api/classify body
- fuzzyMatchCategory function added to classifier: bookmarks in topic-specific folders (Coding, Machine Learning, Videos) now receive meaningful categories instead of Other when no domain/metadata/path rule matches
- Deterministic slug IDs and Development sub-taxonomy (Frontend/Backend/DevOps/Cloud/Tools/Learning/AI/ML) added to buildHierarchy with threshold (20) and coverage ratio (60%) guards
- `reorderNode` pure function added to treeOps.js with 7 passing TDD tests, and `/api/edit` extended with `op:'reorder'` branch that validates, calls, and persists the reordering
- Native HTML5 drag-and-drop wired into renderTree() with Alpine state, BoundingClientRect midpoint insertion line, and context menu guard for folder reordering in the right review panel

---

## v1.0 MVP (Shipped: 2026-03-24)

**Phases completed:** 5 phases, 13 plans, 27 tasks

**Key accomplishments:**

- cheerio-based Netscape Bookmark parser and exporter with entity escaping, ADD_DATE handling, and round-trip validation via node:test (23/23 tests green)
- Express 5 server wiring upload/export API routes via multer + in-memory session singleton to parser/exporter from Plan 01
- Alpine.js drop zone with synchronous backup download, server-parsed stats display, and recursive vanilla JS bookmark tree — completing the Phase 1 UI layer
- URL normalization (7 rules), dedup tree walk, Levenshtein folder-pair detection, and SHA-256 subtree fingerprinting — all pure functions with 27 passing unit tests using TDD.
- Cleanup and merge pipeline wired into Express routes: POST /api/cleanup, POST /api/merge (approveAll + pairs), and GET /api/export updated to prefer cleanTree — all 50 tests passing.
- Complete frontend cleanup flow: Run Cleanup button, cleaning/cleaned states with stats banner, inline merge-badge review with per-row merge/keep buttons and bulk approve, and full integration with /api/cleanup and /api/merge backend routes.
- HEAD-first link checker with 26 TDD tests: correct status semantics (429=uncertain, 401/403=ok), two-level p-limit concurrency, and OG metadata extraction from HTML GET responses
- SSE endpoint streaming live link-check progress to an Alpine EventSource UI, with checkedTree session persistence and three-level export fallback
- One-liner:
- Express POST /api/classify route wired to classifier + hierarchy pipeline, with Alpine.js Classify Bookmarks button, classifying spinner state, and classified tree panel showing Proposed structure.
- Pure tree mutation helpers — pruneEmptyFolders, countLinks, deleteNode, moveNode, markKeep — all TDD green (18/18 tests)
- POST /api/edit route (delete/move/keep with structuredClone) wired to session; export route prunes empty folders via pruneEmptyFolders before serialisation
- Two-column before/after tree view with Alpine context menu (delete/keep/move), summary stats panel, and full edit loop synced to POST /api/edit

---
