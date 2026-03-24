---
phase: 04-classifier-and-structure
plan: "01"
subsystem: classifier
tags: [tdd, classifier, domain-rules, og-metadata, hierarchy-builder, pure-functions]
dependency_graph:
  requires: []
  provides: [src/classifier.js, src/hierarchyBuilder.js]
  affects: [src/routes/classify.js, src/session.js]
tech_stack:
  added: []
  patterns:
    - Domain rules map with www.-stripping hostname lookup
    - OG keyword scan ordered specific-first to prevent greedy matching
    - Immutable stage pattern (spread operator, no node mutation)
    - collectLinks recursive flattener + Map-based category grouping
key_files:
  created:
    - src/classifier.js
    - src/hierarchyBuilder.js
    - test/classifier.test.js
    - test/hierarchyBuilder.test.js
  modified: []
decisions:
  - key: specific-first keyword ordering in CATEGORY_KEYWORDS prevents greedy OG matching
  - key: v1 buildHierarchy skips sub-categorisation (pass-through), satisfying depth=3 constraint simply
  - key: byCategory Map iterates actual classified links, not a fixed list, so empty categories are never created
metrics:
  duration: "159 seconds"
  completed: "2026-03-23"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 04 Plan 01: Classifier and Hierarchy Builder Summary

**One-liner:** Domain rules map (100+ hostnames) + OG keyword fallback classifier with immutable classifyTree, plus hierarchy builder that groups links by category into a max-3-level tree.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TDD classifier.js -- domain rules, OG metadata, full pipeline | 36a3b58 | test/classifier.test.js, src/classifier.js |
| 2 | TDD hierarchyBuilder.js -- group by category, enforce 3-level cap | d83f228 | test/hierarchyBuilder.test.js, src/hierarchyBuilder.js |

## What Was Built

### src/classifier.js

Pure classification pipeline with four exported functions and two exported data maps:

- `DOMAIN_RULES` — 100+ hostname-to-category entries spanning all 10 categories (Development, Video, Social / Community, News, Shopping, Tools, Reference, Design, Finance, Learning).
- `CATEGORY_KEYWORDS` — category-to-keywords map ordered specific-first (Development's 'github'/'npm'/'api' checked before Tools' generic 'tool'/'editor'). Prevents Pitfall 5 (greedy OG matching).
- `classifyByDomain(url)` — strips `www.` prefix via `.replace(/^www\./, '')`, looks up in DOMAIN_RULES, wraps `new URL()` in try/catch for malformed URLs.
- `classifyByMetadata(metadata)` — concatenates `title + description`, lowercases, iterates CATEGORY_KEYWORDS for first match. Returns null for absent/empty metadata.
- `classifyNode(node)` — folder nodes returned unchanged; link nodes get `{ ...node, category }` via domain→metadata→'Other' chain. Input never mutated.
- `classifyTree(node)` — recursive deep-walk returning new tree. Input never mutated.

### src/hierarchyBuilder.js

Pure hierarchy construction from a classified tree:

- `collectLinks(node)` — internal recursive flattener collecting all link nodes.
- `buildHierarchy(classifiedTree)` — flattens links, groups into `Map<category, links[]>`, builds category folder nodes (UUID ids), sorts alphabetically, returns new root folder. Empty categories never created (iterates actual groups, not a fixed list). Max depth = 2 (root→category→link), satisfying D-08 hard constraint.

### Test Coverage

- `test/classifier.test.js` — 22 tests covering classifyByDomain (8), classifyByMetadata (6), classifyNode (5), classifyTree (3). All pass.
- `test/hierarchyBuilder.test.js` — 12 tests covering all buildHierarchy behaviors. All pass.
- Full suite: 110/110 tests passing (no regressions).

## Decisions Made

1. **Specific-first CATEGORY_KEYWORDS ordering** — CATEGORY_KEYWORDS entries ordered from specific categories (Development, Video, Design, Finance) to generic (Reference, Tools) so that precise keywords like 'github', 'npm', 'tutorial' fire before generic matches like 'tool', 'docs'. This addresses Pitfall 5 from the research document.

2. **v1 hierarchy is flat within categories** — `buildHierarchy` returns links as direct children of category folders (depth = root→category→link = 3 levels). The research-documented `buildSubCategories` is deferred to a future plan. This satisfies D-08 (max 3 levels) with minimal complexity.

3. **byCategory Map drives folder creation** — category folders are built by iterating the actual `byCategory` Map (populated from classified links), not by iterating a fixed CATEGORY_KEYWORDS or DOMAIN_RULES list. This ensures empty categories are never created (D-04) and 'Other' only appears if at least one link has no domain/metadata match (D-06).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both modules are fully wired. `classifier.js` produces classified nodes; `hierarchyBuilder.js` produces a valid hierarchy tree. These are consumed by the classify route in plan 04-02.

## Self-Check: PASSED

- src/classifier.js: FOUND
- src/hierarchyBuilder.js: FOUND
- test/classifier.test.js: FOUND
- test/hierarchyBuilder.test.js: FOUND
- Commit 36a3b58 (Task 1): FOUND
- Commit d83f228 (Task 2): FOUND
