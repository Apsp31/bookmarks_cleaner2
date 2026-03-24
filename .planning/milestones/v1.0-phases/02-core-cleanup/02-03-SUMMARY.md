---
phase: 02-core-cleanup
plan: 03
subsystem: frontend
tags: [alpine, cleanup-ui, merge-review, dedup, vanilla-js, renderTree]

# Dependency graph
requires:
  - phase: 02-core-cleanup
    plan: 02
    provides: /api/cleanup and /api/merge backend routes
provides:
  - runCleanup() Alpine method — triggers dedup pipeline, sets cleaned state
  - approveMerge(candidate) — per-row merge via /api/merge
  - approveAllMerges() — bulk merge all candidates
  - keepSeparate(candidate) — client-side dismiss for individual merge row
  - removeDuplicateSubtree(dupeEntry) — remove redundant subtree via /api/merge
  - rerenderTree() — re-renders tree in review mode with inline badges
  - renderTree() extended with options.reviewMode — inline merge-badge, btn-merge, btn-keep
  - cleaning/cleaned UI states in index.html with stats banner and bulk approve button
affects: [phase-03-link-checker, phase-04-classifier, phase-05-editable-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Alpine x-init on element inside x-if to avoid $refs timing issue (treeContainer not in DOM when x-if is false)"
    - "renderTree options object for review mode — pass-through on recursive calls to avoid badge duplication at depth 0"
    - "Inline event delegation via closure-bound callbacks in renderTree (no data attributes needed)"

key-files:
  created: []
  modified:
    - public/app.js
    - public/index.html

key-decisions:
  - "x-init on treeContainer div instead of $nextTick in rerenderTree — $refs are not available when referenced from inside x-if blocks"
  - "renderTree called with depth=1 for root children, not depth=0 — the depth=0 guard was designed to skip the synthetic root node but was also skipping all folder rendering when called at the top level"

# Metrics
duration: ~30min (including two post-commit bug-fix iterations)
completed: 2026-03-23

requirements-completed:
  - DEDUP-01
  - DEDUP-02
  - DEDUP-03
  - DEDUP-04
---

# Phase 02 Plan 03: Cleanup Frontend UI Summary

**Complete frontend cleanup flow: Run Cleanup button, cleaning/cleaned states with stats banner, inline merge-badge review with per-row merge/keep buttons and bulk approve, and full integration with /api/cleanup and /api/merge backend routes.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-03-23T21:53:40Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 2

## Accomplishments

- `public/app.js` extended with `runCleanup`, `approveMerge`, `approveAllMerges`, `keepSeparate`, `removeDuplicateSubtree`, `rerenderTree` Alpine methods
- `renderTree` extended with `options` parameter supporting review mode: inline `.merge-badge`, `.btn-merge`, `.btn-keep` elements with closure-bound event handlers
- `public/index.html` updated with `cleaning` and `cleaned` state templates, `.merge-badge` / `.btn-merge` / `.btn-keep` / `.btn-approve-all` / `.cleanup-banner` CSS, Run Cleanup button in loaded state
- Two post-commit bug fixes applied to get the end-to-end flow working in the browser (see Deviations)
- User verified the full cleanup flow end-to-end: upload, Run Cleanup, banner with stats, merge badges, Keep separate, Approve all merges, Export clean file

## Task Commits

1. **Task 1: Extend Alpine component and renderTree** — `76f49c0` (feat)
2. **Task 2: Update index.html with cleanup UI states, CSS, and controls** — `2527e82` (feat)
3. **Task 3: Visual verification (human-approved)** — no commit (checkpoint)

**Post-checkpoint bug fixes:**
- `b94aba7` — fix(02-03): renderTree depth=0 skip applied to all folders
- `4c2cbbf` — fix(02-03): use x-init on treeContainer to avoid $refs timing issue inside x-if

## Files Created/Modified

- `public/app.js` — extended Alpine component with 6 new methods, new state fields (cleanupStats, mergeCandidates, duplicateSubtrees, cleanTree), renderTree extended with options/reviewMode
- `public/index.html` — added cleaning/cleaned state templates, Phase 2 CSS block, Run Cleanup button in loaded state actions bar

## Decisions Made

- `x-init` on the `treeContainer` div (inside the `x-if="status === 'cleaned'"` template) instead of using `this.$nextTick` in `rerenderTree()` — Alpine's `$refs` are not populated for elements that are behind an inactive `x-if`, so `$nextTick` would still find `this.$refs.treeContainer` as `undefined`. The `x-init` fires once when the element enters the DOM, which is the correct moment to do the first render.
- `renderTree` called with `depth=1` for root-level children rather than `depth=0` — the existing `depth === 0` guard inside `renderTree` was intended to skip rendering the invisible synthetic root node, but it was also silently skipping all folder-level rendering when the function was invoked at the top level with `depth=0`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] renderTree depth=0 guard skipped all folder rendering**
- **Found during:** Post-task browser verification
- **Issue:** `renderTree` contained an early-return guard `if (depth === 0) return` inside the folder rendering branch. This was intended to skip the synthetic root, but because `rerenderTree()` called `renderTree(tree, container, 0, ...)` with the root node, it skipped rendering the root's children when they were folders — leaving the tree empty in cleaned state.
- **Fix:** Changed `rerenderTree()` to iterate `tree.children` and call `renderTree(child, container, 1, options)` for each top-level child, bypassing the root node entirely rather than relying on a depth guard.
- **Files modified:** public/app.js
- **Commit:** `b94aba7`

**2. [Rule 1 - Bug] Alpine $refs not available inside inactive x-if block**
- **Found during:** Post-task browser verification (tree not rendering after cleanup)
- **Issue:** `rerenderTree()` used `this.$nextTick(() => { const container = this.$refs.treeContainer; ... })` but `treeContainer` is inside `<template x-if="status === 'cleaned'">`. When status first becomes `cleaned`, Alpine has set the data but may not have yet inserted the template into the DOM, so `$refs.treeContainer` is `undefined` even inside `$nextTick`.
- **Fix:** Replaced the `$nextTick` ref access with `x-init="rerenderTree()"` on the `treeContainer` div itself. Alpine fires `x-init` when the element is inserted into the DOM — guaranteed to be present. `rerenderTree()` was updated to accept an optional `container` argument to bypass the `$refs` lookup when called from `x-init`.
- **Files modified:** public/app.js, public/index.html
- **Commit:** `4c2cbbf`

---

**Total deviations:** 2 auto-fixed (Rule 1 - runtime bugs discovered during browser verification)
**Impact on plan:** Both fixes were required for the cleanup flow to function. No scope changes.

## Issues Encountered

None beyond the two runtime bugs documented above. Both were resolved before human verification.

## User Setup Required

None — no API keys or external services required for this plan.

## Next Phase Readiness

- Phase 2 (Core Cleanup) is now complete: dedup pipeline, backend routes, and frontend UI are all implemented and verified
- `/api/cleanup` → `/api/merge` → Export flow works end-to-end
- Phase 3 (Link Checker) can begin; it depends on the cleaned tree in session which is now populated correctly

---
*Phase: 02-core-cleanup*
*Completed: 2026-03-23*

## Self-Check: PASSED

- FOUND: public/app.js (modified)
- FOUND: public/index.html (modified)
- FOUND commit: 76f49c0 (feat - extend Alpine component)
- FOUND commit: 2527e82 (feat - update index.html)
- FOUND commit: b94aba7 (fix - renderTree depth bug)
- FOUND commit: 4c2cbbf (fix - x-init treeContainer)
