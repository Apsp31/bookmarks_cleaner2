---
phase: 07-sub-categorisation
plan: 01
subsystem: api
tags: [hierarchyBuilder, deterministic-ids, sub-categorisation, taxonomy, tdd]

# Dependency graph
requires:
  - phase: 06-classification-quality
    provides: classifyTree with hyphen-prefix preservation and fuzzyMatchCategory; classifiedTree shape
provides:
  - Deterministic folder IDs (slug format) in buildHierarchy replacing crypto.randomUUID()
  - DEVELOPMENT_SUBTAXONOMY map (63 hostnames, 6 sub-categories)
  - maybeSplitIntoSubfolders() with threshold, coverage ratio, and hyphen-prefix guards
  - SUBCATEGORY_THRESHOLD and SUBCATEGORY_MIN_COVERAGE_RATIO exported named constants
  - 12 new TDD tests covering all sub-categorisation behaviours
affects: [08-drag-and-drop, edit-routes, export-pipeline, any-phase-using-folder-ids]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "toFolderSlug(pathSegments) converts title arrays to stable slug IDs — no UUID dependency"
    - "maybeSplitIntoSubfolders() — guard-chain pattern: hyphen-prefix → threshold → taxonomy → coverage"
    - "DEVELOPMENT_SUBTAXONOMY plain object mirrors DOMAIN_RULES pattern from classifier.js"

key-files:
  created: []
  modified:
    - src/hierarchyBuilder.js
    - test/hierarchyBuilder.test.js

key-decisions:
  - "Deterministic slug IDs replace crypto.randomUUID() so edit ops (targetFolderId) survive classify re-runs"
  - "SUBCATEGORY_THRESHOLD=20 and SUBCATEGORY_MIN_COVERAGE_RATIO=0.6 exported as named constants, not hardcoded"
  - "maybeSplitIntoSubfolders only splits Development in this phase; other categories exceeding threshold stay flat"
  - "Coverage guard (60%) prevents large Other sub-folder when most domains are not in the sub-taxonomy"
  - "Hyphen-prefix check runs before threshold check — ensures organisational folders never sub-split"

patterns-established:
  - "Pattern 1: toFolderSlug(['category', 'sub']) builds hierarchical slugs — folder-development-ai-ml"
  - "Pattern 2: lookupDevSubcategory strips www. via new URL().hostname.replace() — same as classifyByDomain"
  - "Pattern 3: maybeSplitIntoSubfolders returns either the original links array or a new sub-folder array — callers always get children directly"

requirements-completed: [HIER-01, HIER-02, HIER-03, HIER-04, HIER-05]

# Metrics
duration: 2min
completed: 2026-03-26
---

# Phase 7 Plan 01: Sub-Categorisation Summary

**Deterministic slug IDs and Development sub-taxonomy (Frontend/Backend/DevOps/Cloud/Tools/Learning/AI/ML) added to buildHierarchy with threshold (20) and coverage ratio (60%) guards**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T23:03:28Z
- **Completed:** 2026-03-26T23:06:16Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Replaced `crypto.randomUUID()` folder IDs with deterministic slugs (`folder-root`, `folder-development`, `folder-development-ai-ml`) so edit operations targeting folder IDs survive hierarchy rebuilds
- Added `DEVELOPMENT_SUBTAXONOMY` (63 domain entries across 6 sub-categories) with `lookupDevSubcategory()` and `maybeSplitIntoSubfolders()` implementing four sequential guards
- Exported `SUBCATEGORY_THRESHOLD=20` and `SUBCATEGORY_MIN_COVERAGE_RATIO=0.6` as named constants; all 236 tests pass (12 new, 212 existing)

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD RED — Write failing tests for deterministic IDs and sub-categorisation** - `572c16a` (test)
2. **Task 2: GREEN — Implement deterministic IDs, sub-taxonomy, and sub-folder split** - `520ce77` (feat)

_Note: TDD tasks have two commits (test RED → feat GREEN). No REFACTOR phase needed — code was clean on first pass._

## Files Created/Modified

- `src/hierarchyBuilder.js` — Added `toFolderSlug`, `DEVELOPMENT_SUBTAXONOMY`, `lookupDevSubcategory`, `maybeSplitIntoSubfolders`; replaced UUID calls; exported constants; updated docstring
- `test/hierarchyBuilder.test.js` — Replaced UUID assertion with slug assertion; added 12-test `sub-categorisation` describe block; updated import to include constants

## Decisions Made

- Used plain object for `DEVELOPMENT_SUBTAXONOMY` (consistent with `DOMAIN_RULES` pattern in `classifier.js`)
- `tailwindcss.com` mapped to `Frontend` (CSS framework context wins over Design ambiguity)
- `maybeSplitIntoSubfolders` returns raw links array when guards fail — callers don't need to know whether sub-splitting occurred

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - test infrastructure was already in place from prior phases. All 236 tests green on first GREEN run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `buildHierarchy` now produces a 3-level tree (root → category → sub-folder → link) for large Development collections
- Deterministic IDs mean Phase 8 drag-and-drop edit ops will survive classify re-runs
- `HIER-06` (pruneEmptyFolders and empty-DL round-trip test) is out of scope for this plan but noted in RESEARCH.md; it is deferred — empty folder cleanup after user deletes is not yet wired into edit routes

---
*Phase: 07-sub-categorisation*
*Completed: 2026-03-26*
