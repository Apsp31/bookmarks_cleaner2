# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-24
**Phases:** 5 | **Plans:** 13 | **Tasks:** 27

### What Was Built
- Netscape Bookmark HTML parser/exporter with full round-trip validation (cheerio-based, 23 tests)
- URL normalisation (7 rules) + dedup tree walk + Levenshtein folder matching + SHA-256 subtree fingerprinting
- Interactive merge review UI — inline badges, bulk approve, per-row keep/merge
- HEAD-first concurrent link checker with p-limit two-level ceiling, 429/403 semantics, OG metadata extraction
- SSE streaming progress UI for link checking with real-time count + URL display
- Keyword-based classifier (143 domain rules + OG fallback) + single-level hierarchy builder
- Two-column before/after tree with Alpine.js context menu (delete/keep/move) synced to POST /api/edit
- Summary panel showing pipeline stats; export prunes empty folders before serialisation

### What Worked
- TDD-first on all pure functions — meant zero debugging on integration; tests caught every regression immediately
- Deferring complex concerns explicitly (sub-categorisation, drag-and-drop) prevented scope creep
- structuredClone before session mutation made state management clean throughout
- SSE for link checker progress was the right call — polling would have been clunkier to implement
- Alpine.js CDN approach kept the frontend completely dependency-free at build time
- Wave-based execution (pure functions first, then wiring, then UI) matched the actual dependency graph perfectly

### What Was Inefficient
- Phase 4 classification deferred sub-categorisation but the consequence (large flat category folders) wasn't apparent until Phase 5 human verification — should have been caught during Phase 4 UAT with a real bookmark file
- ROADMAP.md had Phase 3 marked "In Progress" (1/2 plans) at milestone completion — a data inconsistency that slipped through; the phase was complete on disk

### Patterns Established
- `router-per-file` for Express routes — each route file exports a Router, mounted at `/api` in server.js
- `structuredClone(session.field)` before any mutation to avoid partial-update bugs
- `node:test` + `node:assert/strict` as the test framework — no extra dependencies
- TDD RED→GREEN→commit cycle per task, full suite run at plan end
- Human checkpoint tasks (`type="checkpoint:human-verify"`) at end of UI plans to verify visual output before SUMMARY.md is written

### Key Lessons
1. **Defer with explicit consequences** — "deferred" decisions need a TODO noting what the consequence looks like in production, not just "deferred to later". The single-level hierarchy decision was correct for v1 scope but surprised the user at review time.
2. **Test with a real file at each phase** — classifier quality issues would have been caught in Phase 4 UAT if a representative real bookmark file was part of the verification script.
3. **Plan wave ordering by dependency, not phase size** — the 3-wave structure for Phase 5 (pure functions → wiring → UI) was the right mental model; it prevented any re-work between tasks.

### Cost Observations
- Model mix: ~100% sonnet (executor + verifier agents), no opus or haiku usage
- Sessions: ~8 GSD sessions across 2 days
- Notable: Wave-based parallel execution kept each subagent context window fresh and lean; no context degradation observed across 13 plans

---

## Milestone: v1.1 — Quality & Navigation

**Shipped:** 2026-03-27
**Phases:** 3 (6–8) | **Plans:** 7 | **Tasks:** 11

### What Was Built
- Golden-file regression test (47 fixtures) + DOMAIN_RULES expanded 143 → 329 entries proportionally across all 10 categories
- URL path/subdomain signals as 3rd classify fallback (`/docs/`, `docs.*`, `/blog/`, `blog.*`, etc.)
- Hyphen-prefix folder preservation in classifyTree with Alpine opt-in reclassify toggle badge
- `fuzzyMatchCategory` with 33-synonym map + Levenshtein ≤ 2 fallback — bookmarks in personal folders get meaningful categories instead of "Other"
- Deterministic slug IDs replacing `crypto.randomUUID()` in `buildHierarchy` — edit ops survive hierarchy rebuilds
- Development sub-taxonomy: 6 sub-folders (Frontend/Backend/DevOps·Cloud/Tools/Learning/AI·ML) with 63 domain entries, threshold=20, coverage ratio=0.6 guards
- Native HTML5 drag-and-drop with `reorderNode` pure function, `/api/edit op:'reorder'` endpoint, BoundingClientRect midpoint drop indicator, and `isDraggingNode` context menu guard

### What Worked
- Gap closure plan (06-04) for CLASS-07 was the right call — classifying into "Other" was a real friction point for personal bookmark collections
- Golden-file test from Plan 01 paid off immediately in Plan 02: removed 11 overloaded keywords without any regressions
- TDD RED→GREEN on `reorderNode` took 2 minutes — backend logic was clean before a single line of frontend drag code was written
- Scoping sub-taxonomy to Development only was pragmatic — it covers the most common overflow category without over-engineering

### What Was Inefficient
- Phase count mismatch in gsd-tools output (reported 5 phases instead of 3) — tooling counts all roadmap phases rather than milestone-scoped phases; not worth fixing but worth noting
- HIER-06 (exporter round-trip tests for empty-DL after deletion) was deferred from Phase 7 and remains unaddressed — the gap was known but no plan was created to close it; it should enter v1.2 as an explicit requirement

### Patterns Established
- Golden-file before expansion: always establish a regression baseline before expanding domain rules or keywords
- Named constant exports for tunables: `SUBCATEGORY_THRESHOLD`, `SUBCATEGORY_MIN_COVERAGE_RATIO` — makes test overrides trivial and prevents magic numbers
- `folderHint` variable pattern: filter internal params in the calling function, keep called functions clean
- Alpine Set reactivity: replace via reassignment (`this.x = new Set(...)`) rather than mutating in place
- Fixed-position drop indicator appended to `document.body` to avoid scroll container stacking context issues

### Key Lessons
1. **Personal folders need a fallback classifier** — the "Other" bucket grows fast with user-named folders; `fuzzyMatchCategory` with a synonym map handles this far better than pure rule expansion.
2. **Scope sub-taxonomies conservatively** — Development was the only category that genuinely overflowed at 20+ links; other categories at that threshold would just fragment structure unnecessarily.
3. **Deferred HIER-06 = tech debt in flight** — when a requirement is knowingly skipped, write a tracking issue or add it to Active immediately; don't leave it as a "Pending" row in REQUIREMENTS.md.

### Cost Observations
- Model mix: ~100% sonnet (all phases executed by gsd-executor with sonnet)
- Sessions: ~5–6 GSD sessions over 3 days
- Notable: Phase 7 sub-taxonomy (63 domain entries) executed in 2 minutes flat — pure TDD function with pre-existing test infrastructure

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 5 | Baseline — first milestone on this project |
| v1.1 | ~5–6 | 3 | Gap closure plan pattern (06-04); golden-file guard before keyword changes |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Additions |
|-----------|-------|--------------------|
| v1.0 | 128 | 0 (all CDN or built-in) |
| v1.1 | 243 | 0 (fastest-levenshtein was already installed) |

### Top Lessons (Verified Across Milestones)

1. Defer decisions explicitly with stated consequences — surprises at review time are more expensive than slightly longer planning conversations.
2. TDD on pure functions eliminates integration debugging — the investment pays back within the same plan.
3. Establish regression baselines before expanding rules — golden-file pattern from v1.1 is the canonical example.
