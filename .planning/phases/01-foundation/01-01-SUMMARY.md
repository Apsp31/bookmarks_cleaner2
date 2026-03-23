---
phase: 01-foundation
plan: 01
subsystem: parsing
tags: [cheerio, netscape-bookmark-format, node-test, esm, express, multer]

requires: []

provides:
  - parseBookmarkHtml(html) → BookmarkNode tree (cheerio-based Netscape parser)
  - exportToNetscape(root) → Netscape HTML string (entity-escaped, Chrome-importable)
  - BookmarkNode JSDoc typedef in src/shared/types.js
  - ESM project scaffold with express, cheerio, multer dependencies
  - Round-trip validated: parse → export → reparse produces identical bookmark/folder counts

affects:
  - 01-02 (server): depends on parser.js and exporter.js for upload/export routes
  - 01-03 (ui): depends on BookmarkNode tree shape for tree rendering
  - All subsequent phases: BookmarkNode type is the shared data contract

tech-stack:
  added:
    - express@5.2.1 (HTTP server)
    - cheerio@1.2.0 (lenient Netscape Bookmark HTML parsing)
    - multer@1.4.5-lts.2 (LTS line, multipart upload middleware)
    - node:test (built-in test runner, no install needed)
    - crypto.randomUUID() (built-in, no dependency)
  patterns:
    - ESM-only project (type: module, no require())
    - BookmarkNode tree: immutable shape, new objects on each transform
    - parseBookmarkHtml: children('dl') with nextAll('dl') fallback for htmlparser2 DL-in-DT behavior
    - escapeHtml: & replaced first, then "/</> to prevent double-escaping
    - ADD_DATE: parseInt with undefined fallback; Number.isFinite guard in exporter

key-files:
  created:
    - package.json
    - package-lock.json
    - .gitignore
    - src/shared/types.js
    - src/parser.js
    - src/exporter.js
    - test/fixtures/sample-bookmarks.html
    - test/parser.test.js
    - test/exporter.test.js
    - test/roundtrip.test.js
  modified: []

key-decisions:
  - "Used children('dl').first() with nextAll('dl') fallback: htmlparser2 places the child DL inside DT (not as sibling) because DT has no closing tag before DL starts"
  - "escapeHtml replaces & first to avoid double-escaping (& -> &amp; -> &amp;amp; if order is wrong)"
  - "ADD_DATE uses Number.isFinite() guard in exporter to prevent ADD_DATE=\"NaN\" or ADD_DATE=\"undefined\" in output"
  - "Fixture had extra </DL><p> that caused htmlparser2 to prematurely close root DL - fixed during implementation"

patterns-established:
  - "Parser pattern: cheerio.load with xmlMode: false for lenient Netscape HTML parsing"
  - "Test pattern: node:test with node:assert/strict; no jest/mocha dependencies"
  - "Fixture pattern: real Chrome bookmark export format with edge cases (entities, DD elements, 3-level nesting)"
  - "TDD flow: RED commit (failing tests) → GREEN commit (implementation)"

requirements-completed: [FILE-01, FILE-03]

duration: 6min
completed: 2026-03-23
---

# Phase 01 Plan 01: Foundation — Parser, Exporter, Round-trip Summary

**cheerio-based Netscape Bookmark parser and exporter with entity escaping, ADD_DATE handling, and round-trip validation via node:test (23/23 tests green)**

## Performance

- **Duration:** ~6 minutes
- **Started:** 2026-03-23T08:57:08Z
- **Completed:** 2026-03-23T09:03:26Z
- **Tasks:** 2 (Task 1: scaffolding + Task 2: TDD parser/exporter)
- **Files modified:** 10 (created)

## Accomplishments

- ESM project scaffold with express, cheerio, multer; `node:test` test runner requires no install
- `parseBookmarkHtml()` correctly walks Netscape DL/DT/H3/A structure; handles entity-encoded titles, ADD_DATE as integer, DD elements, 3-level nesting, UUIDs on all nodes
- `exportToNetscape()` produces Chrome-importable HTML with proper entity escaping (&, ", <, >) and conditional ADD_DATE attributes
- Round-trip gate D-12 passed: parse → export → reparse yields identical bookmark (31) and folder (9) counts

## Task Commits

Each task was committed atomically:

1. **Task 1: Project scaffolding, BookmarkNode type, and test fixture** - `f018aee` (chore)
2. **Task 2 RED: Failing tests for parser, exporter, round-trip** - `65c6c4f` (test)
3. **Task 2 GREEN: Parser and exporter implementation** - `9d6c2dd` (feat)

## Files Created/Modified

- `package.json` - ESM project config, Node >=20, express/cheerio/multer deps, node:test script
- `src/shared/types.js` - BookmarkNode JSDoc typedef (id, type, title, url, addDate, children, linkStatus, category)
- `src/parser.js` - parseBookmarkHtml() using cheerio; children('dl') + nextAll fallback for DL-in-DT structure
- `src/exporter.js` - exportToNetscape() with escapeHtml() helper; proper entity escaping, conditional ADD_DATE
- `test/fixtures/sample-bookmarks.html` - 31 links, 8 folders, 3-level nesting, AT&T/entities/DD element edge cases
- `test/parser.test.js` - 9 tests: root structure, nesting, link/folder shape, entities, ADD_DATE, DD, UUIDs
- `test/exporter.test.js` - 10 tests: DOCTYPE, META, TITLE, entity escaping, folder structure, ADD_DATE
- `test/roundtrip.test.js` - 3 tests: bookmark count, folder count, no NaN/undefined ADD_DATE after round-trip

## Decisions Made

- Used `children('dl').first()` with `nextAll('dl').first()` fallback in parser: htmlparser2 puts the child `<DL>` inside `<DT>` (since DT has no explicit close before DL), not as a sibling as the research expected. The fallback handles edge cases where parsers differ.
- `escapeHtml` replaces `&` first — if order is wrong, `&` would be double-escaped to `&amp;amp;`.
- `Number.isFinite()` guard in exporter prevents `ADD_DATE="NaN"` or `ADD_DATE="undefined"` which would break Chrome's importer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] htmlparser2 places child DL inside DT, not as sibling**
- **Found during:** Task 2 GREEN phase
- **Issue:** Research (RESEARCH.md Pitfall 2) said to use `.nextAll('dl').first()` because the child `<DL>` is a sibling of `<DT>`. In practice, htmlparser2 places the `<DL>` as a child of `<DT>` (because DT has no closing tag before the DL starts). Using only `nextAll` yielded 0 children for every folder.
- **Fix:** Changed to `children('dl').first()` with `nextAll('dl').first()` as fallback
- **Files modified:** `src/parser.js`
- **Verification:** All 9 parser tests pass; tree shows correct 3-level nesting
- **Committed in:** `9d6c2dd` (feat commit)

**2. [Rule 1 - Bug] Fixture had extra </DL> closing root DL prematurely**
- **Found during:** Task 2 GREEN phase debugging
- **Issue:** The test fixture had a spurious extra `</DL><p>` inside the Development section that caused htmlparser2 to close the root `<DL>` early, placing "Reading & Research", "Work & Productivity", and "Misc & Special Characters" DTs at body level instead of root DL children.
- **Fix:** Removed the extra `</DL><p>` line from the fixture
- **Files modified:** `test/fixtures/sample-bookmarks.html`
- **Verification:** All 5 top-level folders now correctly appear as children of root DL
- **Committed in:** `9d6c2dd` (feat commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in implementation vs. expected behavior)
**Impact on plan:** Both fixes necessary for correctness. The research's selector recommendation was based on an assumption about htmlparser2 behavior that didn't hold for this specific HTML structure. No scope creep.

## Issues Encountered

- htmlparser2 lenient parsing behavior differs from what the research documented: child `<DL>` ends up inside `<DT>` rather than as sibling. This is consistent behavior — the research's `.nextAll()` recommendation was for a case where `<DD>` descriptions appear between `<DT>` and `<DL>`, but when `<DL>` immediately follows `<H3>` inside `<DT>`, htmlparser2 treats it as a child. The dual-strategy (children first, nextAll fallback) handles both cases robustly.

## Known Stubs

None — parser and exporter are fully implemented and tested.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Parser and exporter are the foundational I/O contract — Phase 1 Plan 2 (server) can import and use them immediately
- BookmarkNode type shape is defined and stable; all subsequent phases inherit this contract
- Round-trip test (D-12) is green — the parse/export cycle is faithful
- No blockers for 01-02 (Express server + upload/export routes)

## Self-Check: PASSED

All created files verified to exist. All commits verified in git log.

---
*Phase: 01-foundation*
*Completed: 2026-03-23*
