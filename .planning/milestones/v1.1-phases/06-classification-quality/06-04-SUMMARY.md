---
phase: 06-classification-quality
plan: 04
subsystem: classifier
tags: [classification, levenshtein, fuzzy-match, folder-fallback, bookmark]

# Dependency graph
requires:
  - phase: 06-02
    provides: classifyTree with hyphen-prefix preservation and preservedFolders opt-in
provides:
  - fuzzyMatchCategory(folderName) exported function in src/classifier.js
  - Updated classifyNode(node, sourceFolderName) with folder name fallback pipeline
  - Updated classifyTree threading _sourceFolderName to classifyNode via folderHint
affects:
  - 06-03 (reclassify toggle — classifyTree API unchanged, folderHint logic is internal)
  - any future classifier work

# Tech tracking
tech-stack:
  added: ["fastest-levenshtein (distance import, was already installed)"]
  patterns:
    - "Fuzzy match pipeline: exact CI → synonym map → Levenshtein ≤ 2 → similarity ≥ 0.7 → null"
    - "GENERIC_FOLDER_NAMES blocklist prevents browser-default folder names (root, bookmarks bar) from becoming category labels"
    - "Hyphen-prefix folders in preservedFolders opt-in pass null as folderHint to avoid using '-FolderName' as category"

key-files:
  created: []
  modified:
    - src/classifier.js
    - test/classifier.test.js

key-decisions:
  - "fuzzyMatchCategory returns null for 'root' via Levenshtein (no match) — raw 'root' blocked by GENERIC_FOLDER_NAMES in classifyNode so result is 'Other'"
  - "Hyphen-prefix folders opted into preservedFolders pass null as folderHint (not the hyphen-name) — hyphen names are organisational markers, not useful category hints"
  - "CATEGORY_SYNONYMS checked before Levenshtein to ensure deliberate aliases (coding→Development) are never penalised by edit distance"
  - "folderHint variable introduced in classifyTree to filter out hyphen-prefix names before passing to classifyNode"

patterns-established:
  - "Folder name fallback chain: fuzzyMatchCategory → raw folder name → 'Other' (only when sourceFolderName is non-null and non-generic)"

requirements-completed: [CLASS-07]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 06 Plan 04: Source Folder Fallback for Classifier Summary

**fuzzyMatchCategory function added to classifier: bookmarks in topic-specific folders (Coding, Machine Learning, Videos) now receive meaningful categories instead of Other when no domain/metadata/path rule matches**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-25T22:57:00Z
- **Completed:** 2026-03-25T23:02:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Exported `fuzzyMatchCategory(folderName)`: resolves folder names to standard categories via exact CI match, synonym map (33 aliases), Levenshtein ≤ 2, or normalised similarity ≥ 0.7
- Updated `classifyNode(node, sourceFolderName = null)`: new optional 2nd param activates folder name fallback as 4th pipeline step
- GENERIC_FOLDER_NAMES blocklist prevents browser defaults (root, bookmarks bar, etc.) from becoming bogus categories
- Updated `classifyTree` to pass `folderHint` (filtered from `_sourceFolderName`) to `classifyNode`
- Hyphen-prefix folders opted into `preservedFolders` pass `null` as folderHint so hyphen names are never used as fallback categories
- All 47 golden-file regression fixtures continue to pass unchanged (no 2nd argument = null default = same behaviour)
- Full test suite: 224 tests, 0 failures

## Task Commits

Each task was committed atomically:

1. **RED — Failing tests** - `4154f2d` (test)
2. **GREEN — Implementation** - `722df90` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified

- `src/classifier.js` — Added `import { distance }`, `CATEGORY_SYNONYMS`, `STANDARD_CATEGORIES`, `FUZZY_*` constants, `GENERIC_FOLDER_NAMES`, `fuzzyMatchCategory()` export, updated `classifyNode` signature and body, updated `classifyTree` to use `folderHint`
- `test/classifier.test.js` — Added `fuzzyMatchCategory` to imports; added 3 new describe blocks (fuzzyMatchCategory × 13 tests, classifyNode source folder fallback × 9 tests, classifyTree source folder threading × 4 tests)

## Decisions Made

- **folderHint vs direct _sourceFolderName**: Introduced `folderHint` variable in `classifyTree` so hyphen-prefix folders opted into `preservedFolders` pass `null` to `classifyNode`. This keeps hyphen-name-as-category logic inside `classifyTree` and keeps `classifyNode` clean.
- **GENERIC_FOLDER_NAMES blocklist**: 'root' and browser-default folder names are filtered before using raw folder name as category. This handles the plan's specified behaviour (`sourceFolderName = 'root' → 'Other'`) without special-casing in `fuzzyMatchCategory`.
- **Synonym map checked before Levenshtein**: Prevents 'Coding' (distance 5 from 'Development') from failing the fuzzy check — synonyms are deliberate mappings that must never be penalised by edit distance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] classifyTree hyphen-prefix preservedFolders opt-in regression**
- **Found during:** Task 1 (GREEN implementation)
- **Issue:** After adding `_sourceFolderName` pass-through, existing test "link inside hyphen-prefix folder with preservedFolders opt-in is classified normally" started failing. The `-Pinned` folder name was being passed as sourceFolderName to `classifyNode`, which then returned `{ category: '-Pinned' }` instead of `'Other'`.
- **Fix:** Introduced `folderHint` variable in `classifyTree`: when `_sourceFolderName` starts with `-`, pass `null` as folderHint. Hyphen-prefix folder names are organisational markers, not category hints.
- **Files modified:** src/classifier.js (classifyTree body)
- **Verification:** `ℹ pass 71 ℹ fail 0` on full classifier.test.js
- **Committed in:** `722df90` (feat task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Fix was necessary for correctness. Hyphen-prefix preservation invariants maintained. No scope creep.

## Issues Encountered

None beyond the auto-fixed regression above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CLASS-07 requirement fulfilled: bookmarks in user-named topic folders now receive meaningful categories
- `fuzzyMatchCategory` is exported and can be reused by any future classification enhancement
- Golden-file baseline is fully green — any future DOMAIN_RULES or keyword changes will be caught

## Self-Check: PASSED

- FOUND: src/classifier.js
- FOUND: test/classifier.test.js
- FOUND: .planning/phases/06-classification-quality/06-04-SUMMARY.md
- FOUND commit 4154f2d (test RED)
- FOUND commit 722df90 (feat GREEN)
- FOUND commit 5a4392d (docs metadata)
- All 224 tests passing (0 failures)

---
*Phase: 06-classification-quality*
*Completed: 2026-03-25*
