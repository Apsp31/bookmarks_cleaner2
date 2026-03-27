---
phase: 06-classification-quality
plan: 02
subsystem: classifier
tags: [classifier, classification, keywords, folder-preservation, route]

# Dependency graph
requires:
  - phase: 06-classification-quality
    plan: 01
    provides: golden-file regression test and expanded DOMAIN_RULES baseline
provides:
  - classifyTree with hyphen-prefix folder preservation and preservedFolders opt-in
  - classify route accepting reclassifyFolders from request body
  - tightened CATEGORY_KEYWORDS (removed overloaded terms)
affects: [07-sub-categorisation, 08-drag-and-drop, frontend classify UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Folder-context threading: _sourceFolderName threaded as 3rd arg through recursive classifyTree walk"
    - "preservedFolders Set: opt-in parameter for reclassifying hyphen-prefix folders normally"
    - "Keyword specificity: CATEGORY_KEYWORDS ordered specific-first; overloaded single words removed"

key-files:
  created: []
  modified:
    - src/classifier.js
    - src/routes/classify.js
    - test/classifier.test.js

key-decisions:
  - "preservedFolders parameter name reflects user intent: folders in the set are opted IN to reclassification (not opted out of preservation)"
  - "Only direct parent folder name is threaded — folderName resets at each folder level, so only direct children of hyphen-prefix folder are preserved"
  - "keyword 'code' removed from Development (matches promo code, zip code, QR code — too broad)"
  - "keywords 'product', 'order', 'store' removed from Shopping (conflict with product management, order of operations, data store)"
  - "keywords 'post', 'feed', 'network' removed from Social (blog post, RSS feed, neural network are false positives)"
  - "keywords 'report', 'analysis' removed from News (bug report, data analysis are false positives)"
  - "keyword 'guide' removed from Reference (style guide = Design, buyer's guide = Shopping)"
  - "keywords 'extension', 'plugin' removed from Tools (file extension, plugin architecture are not Tools bookmarks)"

patterns-established:
  - "Golden-file guard: tighten keywords only after golden-file test exists from Plan 01; run it before and after any change"
  - "classifyTree 3-arg signature: (node, preservedFolders=new Set(), _sourceFolderName=null) — leading underscore marks internal param"

requirements-completed: [CLASS-04, CLASS-05]

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 06 Plan 02: Classify Tree Folder Preservation and Keyword Tightening Summary

**classifyTree extended with hyphen-prefix folder preservation via folder-name threading, classify route wired to accept reclassifyFolders Set, and CATEGORY_KEYWORDS tightened by removing 11 overloaded terms without golden-file regression**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-24T23:55:01Z
- **Completed:** 2026-03-24T23:57:07Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended `classifyTree(node, preservedFolders=new Set(), _sourceFolderName=null)` to tag links inside hyphen-prefixed folders with the folder name as category, bypassing classifyNode; preservedFolders opt-in Set allows user to reclassify specific folders normally
- Updated `/classify` route to read `reclassifyFolders` array from request body, convert to Set, and pass as 2nd argument to classifyTree
- Removed 11 overloaded keywords across 6 categories (Development, Shopping, Social, News, Reference, Tools) — all 47 golden-file regression tests still pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Hyphen-prefix folder preservation in classifyTree** - `2a2cbe5` (feat, TDD)
2. **Task 2: Update classify route and tighten CATEGORY_KEYWORDS** - `3bbd20b` (feat)

## Files Created/Modified
- `src/classifier.js` - Extended classifyTree with 3-arg signature; tightened CATEGORY_KEYWORDS
- `src/routes/classify.js` - Route now reads reclassifyFolders from body, converts to Set, passes to classifyTree
- `test/classifier.test.js` - Added `describe('classifyTree — hyphen-prefix preservation')` with 6 tests

## Decisions Made
- `preservedFolders` parameter name was kept as-is from the plan: it names folders the user wants to opt IN to reclassification (the set of folders that should NOT be preserved). Despite the potentially confusing name, it matches the plan spec and the CONTEXT.md decision D-08.
- Only the direct parent folder name is threaded to each child — `folderName` resets at each folder level. This means only direct children of a hyphen-prefix folder are preserved, not grandchildren with a non-hyphen intermediate folder.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None. The golden-file test guarded keyword removals correctly — all 47 entries still passed after removing 11 overloaded keywords.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- classifyTree signature is now stable for Phase 07 sub-categorisation work
- Classify route accepts reclassifyFolders from frontend — frontend can pass folder names to opt specific hyphen-prefix folders back into normal classification
- Golden-file regression test (47 entries) provides a stable baseline for any further keyword changes in Phase 06 Plan 03

## Self-Check: PASSED

All files and commits verified present.

---
*Phase: 06-classification-quality*
*Completed: 2026-03-24*
