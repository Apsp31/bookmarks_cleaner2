---
phase: 08-drag-and-drop
plan: 01
subsystem: api
tags: [treeOps, drag-and-drop, pure-function, edit-api, tdd]

# Dependency graph
requires:
  - phase: 07-sub-categorisation
    provides: deterministic slug IDs enabling stable edit ops after classify re-runs
provides:
  - reorderNode pure function in src/shared/treeOps.js
  - op:'reorder' branch in /api/edit with parentFolderId + newIndex validation
  - 7 unit tests for reorderNode in test/treeOps.test.js
affects: [08-02-drag-and-drop-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "reorderNode follows pure-function pattern: slice, findIndex, splice, spread — no mutation"
    - "op dispatch pattern in edit.js extended with 'reorder' branch before final else"

key-files:
  created:
    - test/treeOps.test.js
  modified:
    - src/shared/treeOps.js
    - src/routes/edit.js

key-decisions:
  - "reorderNode takes parentFolderId as explicit param (not inferred by traversal) — keeps API symmetric with newIndex and avoids ambiguity when same node appears at multiple levels"
  - "newIndex is post-removal index (splice semantics) — clamp applied after removal so max valid index is children.length after splice"

patterns-established:
  - "TDD RED/GREEN for pure tree functions: write test file, confirm import failure, then add export"

requirements-completed: [DND-01, DND-03]

# Metrics
duration: 2min
completed: 2026-03-27
---

# Phase 8 Plan 01: reorderNode pure function and /api/edit reorder endpoint

**`reorderNode` pure function added to treeOps.js with 7 passing TDD tests, and `/api/edit` extended with `op:'reorder'` branch that validates, calls, and persists the reordering**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-27T00:00:13Z
- **Completed:** 2026-03-27T00:01:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `reorderNode(root, nodeId, parentFolderId, newIndex)` exported from treeOps.js — pure function, handles clamp, nested traversal, no mutation
- 7 unit tests in test/treeOps.test.js covering move forward, move backward, unknown node, clamp high, clamp low, no-mutation contract, nested tree
- `/api/edit` POST now accepts `op:'reorder'` with `parentFolderId` and `newIndex`, validates both, calls `reorderNode` with `structuredClone`, persists to session, returns updated tree
- Full test suite: 243 tests, 0 failures (no regressions)

## Task Commits

1. **Task 1: Add reorderNode to treeOps with TDD tests** - `32f5125` (feat)
2. **Task 2: Extend /api/edit with op:'reorder' branch** - `6cddf65` (feat)

## Files Created/Modified

- `test/treeOps.test.js` - 7 unit tests for reorderNode using node:test + assert/strict
- `src/shared/treeOps.js` - Added `reorderNode` export after `moveNode` (existing exports preserved)
- `src/routes/edit.js` - Added `reorderNode` to import, added `op === 'reorder'` branch with validation

## Decisions Made

- `reorderNode` takes `parentFolderId` as an explicit parameter rather than inferring parent via traversal — symmetric with `newIndex` parameter and avoids ambiguity when rebuilding
- `newIndex` is the post-removal target index (splice semantics) — clamped after removal so max valid value is `children.length` post-splice, not pre-splice

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `reorderNode` backend logic is complete and tested — Plan 02 (frontend drag-and-drop) can call `POST /api/edit` with `op:'reorder'`, `nodeId`, `parentFolderId`, `newIndex`
- No blockers

---
*Phase: 08-drag-and-drop*
*Completed: 2026-03-27*
