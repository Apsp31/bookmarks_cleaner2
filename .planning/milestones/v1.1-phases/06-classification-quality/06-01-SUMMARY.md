---
phase: 06-classification-quality
plan: 01
subsystem: classifier
tags: [classification, domain-rules, url-patterns, tdd, golden-file, regression-test]

# Dependency graph
requires:
  - phase: 04-classifier-and-structure
    provides: classifier.js with DOMAIN_RULES, CATEGORY_KEYWORDS, classifyByDomain, classifyByMetadata, classifyNode, classifyTree
provides:
  - Golden-file regression test (47 URL-to-category fixtures covering all 10 categories)
  - DOMAIN_RULES expanded from 143 to 329 unique entries proportionally across all categories
  - classifyByPath(url) exported function: path and subdomain pattern matching as 3rd fallback
  - classifyNode chain updated to 4-step: domain -> metadata -> path/subdomain -> Other
  - classifyByPath unit tests and DOMAIN_RULES count assertion
affects: [06-02, 06-03, 07-sub-categorisation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Golden-file test: capture URL->category baseline in GOLDEN constant before any keyword changes"
    - "classifyByPath: pure function matching pathname.startsWith and hostname.startsWith patterns, null on no match"
    - "Null-coalescing chain in classifyNode: domain ?? metadata ?? path ?? 'Other'"

key-files:
  created:
    - test/classifier.golden.test.js
  modified:
    - src/classifier.js
    - test/classifier.test.js

key-decisions:
  - "classifyByPath and classifyBySubdomain merged into one function (D-02 option: fold into classifyByPath)"
  - "Golden-file written before any DOMAIN_RULES changes (D-14 requirement respected)"
  - "mit.edu assigned to Learning (not News) — only one category per domain, later entry wins in JS object"
  - "329 entries chosen (not exactly 280) to give proportional coverage without artificial trimming"

patterns-established:
  - "Golden-file test pattern: GOLDEN array of {url, metadata?, expected} fixtures drives classifyNode assertions"
  - "classifyByPath signature: (url: string) -> string|null — same pattern as classifyByDomain and classifyByMetadata"

requirements-completed: [CLASS-01, CLASS-02, CLASS-03]

# Metrics
duration: 5m 20s
completed: 2026-03-24
---

# Phase 06 Plan 01: Classification Quality — Foundation Summary

**Golden-file regression test (47 fixtures), DOMAIN_RULES expanded 143 -> 329 entries, and classifyByPath adding /blog/, /docs/, /shop/, /api/ path and docs.*, blog.*, shop.* subdomain signals as the 3rd fallback step in the classify chain**

## Performance

- **Duration:** 5m 20s
- **Started:** 2026-03-24T23:47:07Z
- **Completed:** 2026-03-24T23:52:27Z
- **Tasks:** 1
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Created `test/classifier.golden.test.js` with 47 URL-to-category assertions covering all 10 categories (Development, Video, Social / Community, News, Shopping, Tools, Reference, Design, Finance, Learning) plus 3 metadata-fallback fixtures — all pass against the pre-change baseline
- Expanded `DOMAIN_RULES` from 143 to 329 unique entries (~15-20 new entries per category), removing duplicate keys and keeping proportional distribution
- Added `classifyByPath(url)` exported function: subdomain hints (`docs.*`, `blog.*`, `shop.*`, `store.*`, `documentation.*`) and path hints (`/docs/`, `/blog/`, `/news/`, `/shop/`, `/store/`, `/api/`), returns null on no match
- Updated `classifyNode` chain to `classifyByDomain ?? classifyByMetadata ?? classifyByPath ?? 'Other'`
- Added `describe('classifyByPath')` block (16 tests) and `describe('DOMAIN_RULES')` count assertion to `test/classifier.test.js`
- Full test suite: 192 tests, 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Golden-file test, DOMAIN_RULES expansion, classifyByPath** - `cfd6701` (feat)

**Plan metadata:** (see final docs commit below)

## Files Created/Modified

- `test/classifier.golden.test.js` - 47 golden-file regression fixtures covering all 10 categories + 3 metadata fallback cases
- `src/classifier.js` - DOMAIN_RULES expanded to 329 entries, classifyByPath function added, classifyNode chain updated, JSDoc updated
- `test/classifier.test.js` - Added classifyByPath import, DOMAIN_RULES import, classifyByPath describe block (16 tests), DOMAIN_RULES count test

## Decisions Made

- **classifyByPath and classifyBySubdomain merged into one function** — the context noted D-02 allowed folding subdomain hints into classifyByPath; a single function is simpler and equally testable
- **Golden-file written before DOMAIN_RULES expansion** — per D-14 and STATE.md warning that CATEGORY_KEYWORDS iteration order is load-bearing; the golden-file was run and confirmed passing before any changes
- **329 entries (not exactly 280)** — the plan said "target ~300"; 329 gives better proportional coverage without artificial trimming to hit a round number exactly
- **mit.edu resolved to Learning** — it appeared in both News (hbr.org section) and Learning sections; JS object last-write wins, the News duplicate was removed from source to keep code clean

## Deviations from Plan

None - plan executed exactly as written. The TDD flow was followed: golden-file first (Step 1), then DOMAIN_RULES expansion (Step 2), then classifyByPath (Step 3), then chain update (Step 4), then unit tests (Step 5), then golden-file re-run (Step 6).

## Issues Encountered

- **Duplicate domain keys**: `mit.edu`, `tailwindcss.com`, `bbc.co.uk` appeared as duplicates when expanding DOMAIN_RULES (JS silently overwrites). Resolved by removing the earlier duplicate entries from the source so keys are unambiguous. No test impact.

## Known Stubs

None - all exported functions are fully implemented and wired into the classifyNode chain.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Golden-file baseline is committed — Phase 06 Plan 02 (CATEGORY_KEYWORDS precision) can now safely modify keywords without risking silent regressions
- classifyByPath is tested and exported — any future plan can rely on it
- DOMAIN_RULES at 329 entries satisfies CLASS-01 (expanded map) and CLASS-02 (path/subdomain signals)

## Self-Check: PASSED

All files verified present. Task commit `cfd6701` confirmed in git log.

---
*Phase: 06-classification-quality*
*Completed: 2026-03-24*
