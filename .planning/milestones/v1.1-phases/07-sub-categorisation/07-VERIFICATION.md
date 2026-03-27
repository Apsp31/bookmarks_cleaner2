---
phase: 07-sub-categorisation
verified: 2026-03-26T23:08:47Z
status: gaps_found
score: 4/5 success criteria verified
re_verification: false
gaps:
  - truth: "No exported bookmark file contains folders nested deeper than 3 levels (root → category → sub-category → link)"
    status: partial
    reason: "The depth-3 constraint is enforced by the buildHierarchy implementation and tested at the unit level (maxDepth test passes). However HIER-06 requires a round-trip test asserting max depth AND no empty <DL> blocks in the exported HTML — neither the exporter test nor any integration test covers these properties. The PLAN only claimed HIER-01 through HIER-05; HIER-06 was knowingly deferred but remains assigned to Phase 7 in REQUIREMENTS.md and ROADMAP.md."
    artifacts:
      - path: "test/exporter.test.js"
        issue: "No test asserting maxDepth of exported tree or absence of empty <DL> blocks after sub-folder creation"
      - path: "src/treeOps.js"
        issue: "pruneEmptyFolders exists but is not tested for the sub-folder case where user deletes all bookmarks from a sub-folder"
    missing:
      - "Exporter round-trip test: export a 21-link Development tree → assert no empty <DL><p>\\s*</DL><p> in HTML output"
      - "Exporter round-trip test: assert maxDepth of exported tree <= 3"
      - "pruneEmptyFolders test for sub-folder context (user deletes last link from AI/ML sub-folder)"
  - truth: "No empty <DL> blocks appear in the exported HTML after the user deletes bookmarks from sub-folders"
    status: failed
    reason: "HIER-06 specifically requires round-trip tests for this scenario. pruneEmptyFolders is implemented but not exercised against the sub-folder hierarchy shape, and the exporter has no test checking for empty <DL> blocks in output HTML."
    artifacts:
      - path: "test/exporter.test.js"
        issue: "No test for empty <DL> absence after sub-folder deletion"
    missing:
      - "Test: delete all links from Development > AI/ML sub-folder → export → assert no empty <DL> blocks in HTML"
human_verification: []
---

# Phase 7: Sub-Categorisation Verification Report

**Phase Goal:** Large category folders are automatically split into named sub-folders so the hierarchy is navigable at 2-3 levels deep
**Verified:** 2026-03-26T23:08:47Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A category folder with more than 20 links gains sub-folders named from the predefined taxonomy | ✓ VERIFIED | Test passes: "Development category with 21+ links gains sub-folders (HIER-02)" — 21-link tree produces 6+ typed folder children |
| 2 | AI/ML-related bookmarks (openai.com, huggingface.co) appear in a dedicated AI/ML sub-folder within Development | ✓ VERIFIED | Test passes: "AI/ML sub-folder contains openai.com and huggingface.co (HIER-04)" |
| 3 | After a hierarchy rebuild, drag and edit operations continue to work correctly — no silent no-ops from changed node IDs | ✓ VERIFIED | Deterministic slug IDs confirmed: `folder-root`, `folder-development`, `folder-development-ai-ml`. UUID usage removed (grep returns 0 matches). Test "same input produces identical IDs on two calls (HIER-01)" passes. |
| 4 | No exported bookmark file contains folders nested deeper than 3 levels | ✗ PARTIAL | maxDepth unit test passes (depth=3 for 21-link split). However HIER-06 requires a round-trip test in exporter suite asserting this constraint on actual HTML output — that test does not exist. |
| 5 | No empty `<DL>` blocks appear in the exported HTML after the user deletes bookmarks from sub-folders | ✗ FAILED | No test covers this scenario. exporter.test.js has no empty-DL assertion. pruneEmptyFolders is not exercised for the sub-folder hierarchy shape. |

**Score:** 3/5 success criteria fully verified (Truth 4 partial, Truth 5 failed)

Note: PLAN 07-01 claimed HIER-01 through HIER-05 only. HIER-06 was explicitly deferred ("out of scope for this plan") but remains assigned to Phase 7 in REQUIREMENTS.md and ROADMAP.md — making it an open gap for this phase.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/hierarchyBuilder.js` | Deterministic IDs, sub-folder split, DEVELOPMENT_SUBTAXONOMY map | ✓ VERIFIED | 217 lines. All required exports present: `buildHierarchy`, `SUBCATEGORY_THRESHOLD=20`, `SUBCATEGORY_MIN_COVERAGE_RATIO=0.6`. Contains `toFolderSlug`, `lookupDevSubcategory`, `maybeSplitIntoSubfolders`, `DEVELOPMENT_SUBTAXONOMY` (63 entries). No `crypto.randomUUID()`. |
| `test/hierarchyBuilder.test.js` | TDD tests for all sub-categorisation behaviours | ✓ VERIFIED | 337 lines. Contains 12-test `sub-categorisation` describe block. Import includes `SUBCATEGORY_THRESHOLD` and `SUBCATEGORY_MIN_COVERAGE_RATIO`. UUID regex pattern removed. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/hierarchyBuilder.js` | DEVELOPMENT_SUBTAXONOMY constant | `lookupDevSubcategory` using `new URL().hostname` | ✓ WIRED | Line 94: `new URL(url).hostname.replace(/^www\./, '')` — matches pattern |
| `test/hierarchyBuilder.test.js` | `src/hierarchyBuilder.js` | `import { buildHierarchy, SUBCATEGORY_THRESHOLD, SUBCATEGORY_MIN_COVERAGE_RATIO }` | ✓ WIRED | Line 3: import confirmed, constants used in assertions at lines 308 and 312 |

### Data-Flow Trace (Level 4)

Not applicable — `hierarchyBuilder.js` is a pure transformation function. Input is an in-memory tree, output is a new in-memory tree. No external data source. No rendering. Level 4 not required.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Module exports accessible | `node -e "import('/home/alan/code/claude/gsd/src/hierarchyBuilder.js').then(m => ...)"` | SUBCATEGORY_THRESHOLD=20, SUBCATEGORY_MIN_COVERAGE_RATIO=0.6, buildHierarchy=function | ✓ PASS |
| All 24 hierarchyBuilder tests pass | `node --test test/hierarchyBuilder.test.js` | 24 pass, 0 fail | ✓ PASS |
| Full test suite (236 tests) passes | `node --test test/**/*.test.js` | 236 pass, 0 fail | ✓ PASS |
| No UUID usage in hierarchyBuilder.js | `grep -n "crypto.randomUUID" src/hierarchyBuilder.js` | NOT FOUND | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HIER-01 | 07-01-PLAN.md | `buildHierarchy` uses deterministic node IDs | ✓ SATISFIED | `folder-root`, `folder-development`, `folder-development-ai-ml` slugs. UUID removed. Two-call identity test passes. |
| HIER-02 | 07-01-PLAN.md | Sub-folders created when top-level category exceeds threshold (default: 20) | ✓ SATISFIED | `SUBCATEGORY_THRESHOLD=20` exported. 21-link test splits, 19-link test stays flat, coverage guard test (5/21 < 60%) stays flat. |
| HIER-03 | 07-01-PLAN.md | Predefined sub-taxonomy for Development: Frontend, Backend, DevOps/Cloud, Tools, Learning, AI/ML | ✓ SATISFIED | `DEVELOPMENT_SUBTAXONOMY` contains all 6 sub-categories with 63 hostname entries. Frontend test (reactjs.org) passes. |
| HIER-04 | 07-01-PLAN.md | AI/ML is a recognised sub-category (openai.com, huggingface.co, etc.) | ✓ SATISFIED | Both URLs in DEVELOPMENT_SUBTAXONOMY mapped to 'AI/ML'. Test passes confirming routing. |
| HIER-05 | 07-01-PLAN.md | Threshold is a named constant (not hardcoded inline) | ✓ SATISFIED | `export const SUBCATEGORY_THRESHOLD = 20` and `export const SUBCATEGORY_MIN_COVERAGE_RATIO = 0.6` at lines 23-24. |
| HIER-06 | NOT CLAIMED (deferred) | Folder depth capped at 3 levels; round-trip tests assert max depth and no empty `<DL>` blocks in export | ✗ BLOCKED | Depth-3 is correct in implementation and has a unit test (maxDepth=3 passes). However HIER-06 requires exporter round-trip test for max depth AND absence of empty `<DL>` blocks — neither exists. REQUIREMENTS.md marks this as Pending. |

**Orphaned requirement:** HIER-06 is assigned to Phase 7 in REQUIREMENTS.md but not claimed by any plan in this phase directory. The SUMMARY explicitly defers it: "HIER-06 is out of scope for this plan." This is a known gap, not a surprise.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODOs, FIXMEs, placeholder returns, hardcoded stubs, or console.log-only implementations were detected in `src/hierarchyBuilder.js` or `test/hierarchyBuilder.test.js`.

### Human Verification Required

None. All verification items are programmatic.

### Gaps Summary

**3 out of 5 success criteria are fully verified.** The two gaps both trace to a single root cause: **HIER-06 was deferred**.

HIER-06 requires:
1. A round-trip test in `test/exporter.test.js` asserting no empty `<DL>` blocks after sub-folder deletion
2. A round-trip test asserting the exported HTML tree has max depth ≤ 3

The implementation is sound — `buildHierarchy` provably produces max-depth-3 trees (unit test confirms) and `pruneEmptyFolders` exists in `treeOps.js`. The gap is the absence of integration/exporter tests that exercise the sub-folder case.

**Root cause:** Both gaps are the same missing test coverage for the sub-folder + exporter interaction. A single focused plan adding 2-3 tests to `test/exporter.test.js` would close both gaps.

---

_Verified: 2026-03-26T23:08:47Z_
_Verifier: Claude (gsd-verifier)_
