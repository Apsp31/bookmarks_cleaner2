# Milestones

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
