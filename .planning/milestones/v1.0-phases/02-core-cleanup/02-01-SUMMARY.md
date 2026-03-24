---
phase: 02-core-cleanup
plan: 01
subsystem: api
tags: [dedup, url-normalization, fuzzy-matching, levenshtein, sha256, node-test, tdd]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: BookmarkNode typedef and ESM project structure
provides:
  - normalizeUrl pure function (7 normalization rules via WHATWG URL API)
  - dedupTree pure function (depth-first walk, first-occurrence, no mutation)
  - countLinks helper
  - findMergeCandidates (Levenshtein ratio <= 0.25, skips root node)
  - fingerprintSubtree (SHA-256 of sorted normalized child link URLs)
  - findDuplicateSubtrees (fingerprint grouping, skips empty folders)
affects: [02-02, 02-03, phase-03-link-checker, phase-04-classifier]

# Tech tracking
tech-stack:
  added:
    - fastest-levenshtein@1.0.16 (Levenshtein edit distance, CJS consumed via ESM named import)
  patterns:
    - TDD with node:test — RED (failing test commit) then GREEN (implementation commit)
    - Pure functions only — no session/IO interaction in dedup.js and fuzzy.js
    - Snapshot searchParams keys before iteration to avoid live-iterator mutation bug

key-files:
  created:
    - src/dedup.js
    - src/fuzzy.js
    - test/dedup.test.js
    - test/fuzzy.test.js
  modified:
    - package.json (added fastest-levenshtein dependency)
    - package-lock.json

key-decisions:
  - "Spread searchParams.keys() before delete loop to avoid live iterator mutation (Pitfall 1 from RESEARCH.md)"
  - "fingerprintSubtree uses direct-children-only (not recursive) to avoid false positives from large parent folders"
  - "collectFolders skips title === 'root' to prevent spurious merge candidates from the synthetic root node"
  - "Plan test case for Dev Tools/Developer Tools had incorrect distance comment (said 3, actual 6, ratio 0.40 > 0.25); replaced with Design/Designs (d=1, ratio=0.14)"

patterns-established:
  - "Pattern: normalizeUrl — always pass URLs through this before Set insertion or fingerprinting"
  - "Pattern: dedupTree — shared seen Set passed by reference across full tree walk"
  - "Pattern: fingerprintSubtree — sort before hash for order-independence"

requirements-completed:
  - DEDUP-01
  - DEDUP-02
  - DEDUP-03
  - DEDUP-04

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 02 Plan 01: Dedup and Fuzzy Matching Pipeline Summary

**URL normalization (7 rules), dedup tree walk, Levenshtein folder-pair detection, and SHA-256 subtree fingerprinting — all pure functions with 27 passing unit tests using TDD.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T18:58:07Z
- **Completed:** 2026-03-23T19:01:21Z
- **Tasks:** 3 (Task 0 + Feature 1 + Feature 2, each with TDD RED/GREEN commits)
- **Files modified:** 6

## Accomplishments

- `src/dedup.js` exports `normalizeUrl`, `dedupTree`, `countLinks` — 15 tests green
- `src/fuzzy.js` exports `findMergeCandidates`, `findDuplicateSubtrees`, `fingerprintSubtree` — 12 tests green
- Full test suite 50/50 green with no regressions in Phase 1 parser/exporter/roundtrip tests
- `fastest-levenshtein@1.0.16` installed and verified via ESM named import

## Task Commits

Each task was committed atomically:

1. **Task 0: Install fastest-levenshtein** - `dbc8d98` (chore)
2. **Feature 1 RED: dedup tests** - `dd0c8f0` (test)
3. **Feature 1 GREEN: dedup implementation** - `5da2087` (feat)
4. **Feature 2 RED: fuzzy tests** - `72ddab4` (test)
5. **Feature 2 GREEN: fuzzy implementation + test fix** - `627bea0` (feat)

_Note: TDD tasks have RED (test) and GREEN (impl) commits as separate atomic commits._

## Files Created/Modified

- `src/dedup.js` — normalizeUrl (7 rules), dedupTree (depth-first, no-mutation), countLinks
- `src/fuzzy.js` — findMergeCandidates, fingerprintSubtree (SHA-256), findDuplicateSubtrees
- `test/dedup.test.js` — 15 unit tests covering all normalization patterns and dedup walk behaviors
- `test/fuzzy.test.js` — 12 unit tests covering fuzzy folder matching and subtree fingerprinting
- `package.json` — added fastest-levenshtein@1.0.16
- `package-lock.json` — updated lockfile

## Decisions Made

- ESM named import `import { distance } from 'fastest-levenshtein'` works transparently on Node 18+ for CJS packages — confirmed working
- fingerprintSubtree only hashes direct link children (not recursive) to avoid false positives from large parent folders that happen to share some nested bookmarks
- collectFolders skips `title === 'root'` to prevent the synthetic root node from generating spurious merge candidates

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan test case had incorrect Levenshtein distance comment**
- **Found during:** Feature 2 GREEN phase (test run failure)
- **Issue:** Plan stated "Dev Tools" / "Developer Tools" has distance 3 and ratio 0.20. Actual distance(lower) = 6, maxLen = 15, ratio = 0.40 which exceeds the 0.25 threshold — the pair would NOT be flagged by the implementation. Test expected 1 candidate but got 0.
- **Fix:** Replaced test pair with "Design" / "Designs" (d=1, maxLen=7, ratio=0.14 which correctly satisfies <= 0.25). Same intent — demonstrates merge candidate detection — with correct values.
- **Files modified:** test/fuzzy.test.js (Tests 1 and 6)
- **Verification:** All 12 fuzzy tests pass; 50/50 full suite green
- **Committed in:** `627bea0` (Feature 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - incorrect test expectation in plan)
**Impact on plan:** Fix necessary for tests to reflect the actual algorithm behavior. No scope change, same test coverage intent maintained.

## Issues Encountered

None beyond the test expectation mismatch documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/dedup.js` and `src/fuzzy.js` are ready for import by Plan 02 (`/api/cleanup` route)
- All pure functions — no side effects, no I/O — safe to call in any context
- countLinks is available for duplicate-removal stats in the cleanup response

---
*Phase: 02-core-cleanup*
*Completed: 2026-03-23*

## Self-Check: PASSED

- FOUND: src/dedup.js
- FOUND: src/fuzzy.js
- FOUND: test/dedup.test.js
- FOUND: test/fuzzy.test.js
- FOUND commit: dbc8d98 (chore - install fastest-levenshtein)
- FOUND commit: dd0c8f0 (test - dedup RED)
- FOUND commit: 5da2087 (feat - dedup GREEN)
- FOUND commit: 72ddab4 (test - fuzzy RED)
- FOUND commit: 627bea0 (feat - fuzzy GREEN)
