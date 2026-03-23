---
phase: 04-classifier-and-structure
plan: "02"
subsystem: classifier
tags: [express, alpine, sse, classify, hierarchy, session, frontend]

requires:
  - phase: 04-01
    provides: [src/classifier.js, src/hierarchyBuilder.js]
provides:
  - POST /api/classify endpoint wired to classifier + hierarchy pipeline
  - session.classifiedTree field
  - classifiedTree priority in export chain
  - upload resets all downstream session fields
  - Classify Bookmarks button and classified state in frontend
affects: [05-review-and-export]

tech-stack:
  added: []
  patterns:
    - Router-per-file pattern extended with classify.js
    - Upload route resets all downstream session fields on new file
    - Alpine classifyBookmarks() follows same async pattern as runCleanup/runLinkCheck

key-files:
  created:
    - src/routes/classify.js
  modified:
    - src/session.js
    - src/routes/export.js
    - src/routes/upload.js
    - server.js
    - public/app.js
    - public/index.html

key-decisions:
  - "Upload route now resets all downstream session fields (cleanTree, checkedTree, mergeCandidates, duplicateSubtrees, classifiedTree) to prevent stale state from a previous file"
  - "classifiedTree has highest priority in export chain (classifiedTree ?? checkedTree ?? cleanTree ?? tree)"

patterns-established:
  - "Classify button is disabled while isClassifying is true (same :disabled pattern as Check Links)"
  - "Classification error falls back to 'checked' status so user can retry"

requirements-completed: [CLASS-01, CLASS-02, STRUCT-01, STRUCT-02]

duration: 113s
completed: "2026-03-23"
---

# Phase 04 Plan 02: Classify Route and Frontend Wiring Summary

**Express POST /api/classify route wired to classifier + hierarchy pipeline, with Alpine.js Classify Bookmarks button, classifying spinner state, and classified tree panel showing Proposed structure.**

## Performance

- **Duration:** 113 seconds
- **Started:** 2026-03-23T23:49:15Z
- **Completed:** 2026-03-23T23:51:08Z
- **Tasks:** 2 (+ 1 auto-approved checkpoint)
- **Files modified:** 6

## Accomplishments

- Created `src/routes/classify.js`: POST /classify reads `session.checkedTree ?? session.cleanTree`, runs `classifyTree` + `buildHierarchy`, stores result in `session.classifiedTree`, returns JSON
- Wired classify route into session, export chain, upload reset, and server.js
- Added Classify Bookmarks button to the checked state with disabled-while-classifying guard
- Added `classifying` (spinner) and `classified` (Proposed structure tree panel) states to frontend

## Task Commits

Each task was committed atomically:

1. **Task 1: Create classify route, extend session + export + upload, mount in server.js** - `db7f8e1` (feat)
2. **Task 2: Add Classify Bookmarks button and classified state to frontend** - `3cb404f` (feat)
3. **Task 3: Verify end-to-end classification flow** - auto-approved (checkpoint:human-verify in --auto mode)

## Files Created/Modified

- `src/routes/classify.js` - New POST /classify route: reads checkedTree ?? cleanTree, classifies, builds hierarchy, stores classifiedTree
- `src/session.js` - Added `classifiedTree: null` field and JSDoc annotation
- `src/routes/export.js` - Prepended `session.classifiedTree ??` to export priority chain
- `src/routes/upload.js` - Added full downstream session reset on new file upload
- `server.js` - Import and mount classifyRouter at /api
- `public/app.js` - Added classifiedTree, isClassifying fields; classifyBookmarks() method; resetApp() updates
- `public/index.html` - Classify Bookmarks button in checked state; classifying and classified state templates

## Decisions Made

1. **Upload resets all downstream session fields** — Upload route now resets `cleanTree`, `checkedTree`, `mergeCandidates`, `duplicateSubtrees`, and `classifiedTree` when a new file is loaded. Prevents stale data from a previous session polluting the UI.

2. **classifiedTree is highest-priority in export chain** — `session.classifiedTree ?? session.checkedTree ?? session.cleanTree ?? session.tree`. Classification is the final step, so its output takes precedence.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full classification pipeline is now end-to-end: upload → cleanup → check → classify → export
- Phase 05 (review-and-export) can build the side-by-side review UI on top of `session.classifiedTree`
- All 110 tests pass, no regressions

## Known Stubs

None — classify route returns real classifiedTree from classifier.js + hierarchyBuilder.js. Frontend renders the actual tree from server response.

## Self-Check: PASSED

- src/routes/classify.js: FOUND
- src/session.js contains classifiedTree: FOUND
- src/routes/export.js priority chain: FOUND
- src/routes/upload.js reset fields: FOUND
- server.js classifyRouter: FOUND
- public/app.js classifyBookmarks: FOUND
- public/index.html Classify Bookmarks button: FOUND
- Commit db7f8e1 (Task 1): FOUND
- Commit 3cb404f (Task 2): FOUND

---
*Phase: 04-classifier-and-structure*
*Completed: 2026-03-23*
