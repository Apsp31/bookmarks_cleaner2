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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 5 | Baseline — first milestone on this project |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Additions |
|-----------|-------|--------------------|
| v1.0 | 128 | 0 (all CDN or built-in) |

### Top Lessons (Verified Across Milestones)

1. Defer decisions explicitly with stated consequences — surprises at review time are more expensive than slightly longer planning conversations.
2. TDD on pure functions eliminates integration debugging — the investment pays back within the same plan.
