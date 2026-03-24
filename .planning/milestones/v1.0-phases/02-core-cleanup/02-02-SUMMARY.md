---
phase: 02-core-cleanup
plan: 02
subsystem: api
tags: [express-routes, session, cleanup, merge, dedup, integration]

# Dependency graph
requires:
  - phase: 02-core-cleanup
    plan: 01
    provides: dedupTree, countLinks, findMergeCandidates, findDuplicateSubtrees pure functions
provides:
  - POST /api/cleanup endpoint (cleanup route)
  - POST /api/merge endpoint (merge route with approveAll and pairs modes)
  - Extended session store with cleanTree, mergeCandidates, duplicateSubtrees
  - GET /api/export updated to prefer cleanTree
affects: [02-03, phase-03-link-checker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - express.json() middleware required before route mounts for JSON body parsing in Express 5
    - applyMerge uses two-pass approach (findNode + rebuild) to avoid in-place mutation per D-07
    - Router-per-file pattern continued from Phase 1 (each route file exports default Router)

key-files:
  created:
    - src/routes/cleanup.js
    - src/routes/merge.js
  modified:
    - src/session.js (added cleanTree, mergeCandidates, duplicateSubtrees fields)
    - src/routes/export.js (cleanTree ?? session.tree fallback)
    - server.js (express.json(), cleanupRouter, mergeRouter mounts)

key-decisions:
  - "applyMerge two-pass strategy: collect remove-node children first, then rebuild tree — avoids needing parent pointers"
  - "Partial merge removes resolved pairs from mergeCandidates where aId OR bId matches — conservative filter keeps remaining candidates intact"
  - "express.json() added to server.js before route mounts so all /api POST routes can receive JSON bodies"

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 02 Plan 02: Express Route Integration Summary

**Cleanup and merge pipeline wired into Express routes: POST /api/cleanup, POST /api/merge (approveAll + pairs), and GET /api/export updated to prefer cleanTree — all 50 tests passing.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T19:04:13Z
- **Completed:** 2026-03-23T19:05:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `src/routes/cleanup.js` — POST /api/cleanup calls dedupTree, findMergeCandidates, findDuplicateSubtrees; returns stats + mergeCandidates + duplicateSubtrees; writes session.cleanTree without mutating session.tree
- `src/routes/merge.js` — POST /api/merge supports `approveAll: true` (merges all candidates + duplicates) and `pairs: [{ aId, bId }]` (selective); returns updated tree and remaining candidates
- `src/session.js` — extended with cleanTree, mergeCandidates, duplicateSubtrees fields + updated JSDoc
- `src/routes/export.js` — now serves `session.cleanTree ?? session.tree` (prefers cleaned tree)
- `server.js` — added `express.json()` middleware and mounts for cleanupRouter and mergeRouter
- Full 50/50 test suite green with no regressions

## Task Commits

1. **Task 1: Extend session store and create cleanup route** — `e9cb884` (feat)
2. **Task 2: Create merge route, update export route, mount in server.js** — `985449b` (feat)

## Files Created/Modified

- `src/routes/cleanup.js` — POST /api/cleanup integrating dedupTree + fuzzy analysis
- `src/routes/merge.js` — POST /api/merge with applyMerge helper (two-pass, no mutation)
- `src/session.js` — Phase 2 fields added to singleton
- `src/routes/export.js` — cleanTree fallback for export
- `server.js` — JSON middleware + router mounts

## Decisions Made

- applyMerge uses a two-pass approach: find the remove node and extract its children first, then rebuild the tree in one pass (appending children to keepId, filtering out removeId). This avoids needing parent pointers or complex splice logic while maintaining immutability.
- Partial merge filters mergeCandidates conservatively: any pair where aId or bId appears in the resolved set is removed. This prevents stale references after a folder is consumed.
- express.json() is placed before all /api route mounts in server.js so all routes receive parsed bodies without per-route middleware.

## Deviations from Plan

None - plan executed exactly as written. The applyMerge helper was implemented as specified in the plan with the two-pass strategy (findNode + rebuild). All acceptance criteria met.

## Issues Encountered

None.

## Known Stubs

None - all data paths are wired. session.cleanTree, mergeCandidates, and duplicateSubtrees are all live data from the pipeline, not placeholders.

## User Setup Required

None.

## Next Phase Readiness

- POST /api/cleanup and POST /api/merge are ready for frontend integration (Plan 03)
- GET /api/export will serve the clean tree after cleanup has been run
- session.cleanTree is the authoritative cleaned state for all downstream consumers

---
*Phase: 02-core-cleanup*
*Completed: 2026-03-23*
