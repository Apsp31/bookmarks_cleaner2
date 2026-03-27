---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Quality & Navigation
status: Ready to execute
stopped_at: Completed 08-01-PLAN.md
last_updated: "2026-03-27T00:03:02.095Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 7
  completed_plans: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** A single clean, importable bookmark file where every link works, nothing is duplicated, and everything is filed where you'd actually look for it.
**Current focus:** Phase 08 — drag-and-drop

## Current Position

Phase: 08 (drag-and-drop) — EXECUTING
Plan: 2 of 2

## Performance Metrics

**Velocity:**

- Total plans completed: 13
- Average duration: ~50s
- Total execution time: ~11 min (v1.0)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | ~38s | ~13s |
| 02-core-cleanup | 3 | ~35s | ~12s |
| 03-link-checker | 2 | ~37s | ~19s |
| 04-classifier-and-structure | 2 | ~272s | ~136s |
| 05-editable-ui | 3 | ~185s | ~62s |

*Updated after each plan completion*
| Phase 06-classification-quality P01 | 320 | 1 tasks | 3 files |
| Phase 06-classification-quality P02 | 126 | 2 tasks | 3 files |
| Phase 06-classification-quality P03 | 1 | 1 tasks | 2 files |
| Phase 06-classification-quality P04 | 300 | 1 tasks | 2 files |
| Phase 07-sub-categorisation P01 | 148 | 2 tasks | 2 files |
| Phase 08-drag-and-drop P01 | 104 | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 06]: CATEGORY_KEYWORDS iteration order is load-bearing — golden-file regression test must precede any keyword expansion
- [Phase 07]: buildHierarchy must use deterministic hash-based IDs before any edit wiring — crypto.randomUUID() silently breaks editOp after rebuild
- [Phase 07]: SUBCATEGORY_THRESHOLD and SUBCATEGORY_MIN_COVERAGE_RATIO exposed as named constants (not hardcoded inline)
- [Phase 08]: Native HTML5 Drag API preferred over SortableJS — renderTree() uses imperative DOM, not Alpine x-for lists
- [Phase 08]: @alpinejs/sort ruled out — known x-for + nested list DOM sync bug (Alpine discussion #4157)
- [Phase 08]: isDraggingNode flag prevents context menu opening during active drag
- [Phase 06-classification-quality]: classifyByPath and classifyBySubdomain merged into one function (D-02 option: fold into classifyByPath)
- [Phase 06-classification-quality]: Golden-file written before any DOMAIN_RULES changes to establish baseline (D-14)
- [Phase 06-classification-quality]: preservedFolders Set opt-in: folders in the set are reclassified normally; hyphen-prefix folders NOT in the set are preserved
- [Phase 06-classification-quality]: classifyTree threads only direct parent folder name — folderName resets at each level, so only direct children of hyphen-prefix folders are preserved
- [Phase 06-classification-quality]: onToggleReclassify always present in getTreeOptions (not gated by reviewMode) — badge must show in checked state with or without merge candidates
- [Phase 06-classification-quality]: Alpine Set reactivity: replace Set via reassignment (this.x = new Set(x)) rather than mutating in place
- [Phase 06-classification-quality]: fuzzyMatchCategory returns null for generic folder names (root, bookmarks bar) via GENERIC_FOLDER_NAMES blocklist ensuring they always fall to Other
- [Phase 06-classification-quality]: Hyphen-prefix folders opted into preservedFolders pass null as folderHint to classifyNode — hyphen names are organisational markers, not category hints
- [Phase 07-sub-categorisation]: Deterministic slug IDs replace crypto.randomUUID() so edit ops survive classify re-runs (HIER-01)
- [Phase 07-sub-categorisation]: SUBCATEGORY_THRESHOLD=20 and SUBCATEGORY_MIN_COVERAGE_RATIO=0.6 exported as named constants
- [Phase 07-sub-categorisation]: maybeSplitIntoSubfolders only splits Development in this phase; other oversized categories stay flat
- [Phase 08-drag-and-drop]: reorderNode takes parentFolderId as explicit param — symmetric with newIndex and avoids ambiguity during traversal
- [Phase 08-drag-and-drop]: newIndex is post-removal index (splice semantics) — clamped after removal so max valid index equals children.length post-splice

### Pending Todos

- BUG: Allow skip/bypass of liveness check (link-check step) — user should be able to skip it
- BUG: Time remaining indicator shows spurious precision — messy display, needs rounding/simplification
- BUG: Deduplication fuzzy matching not working — "cakes" and "cakes (2)" shown as separate folders; "Sarah" and "Sarah's bits" shown as separate — near-duplicate folder detection needs fixing
- BUG: Right-click move folder — works but tree doesn't update after move (no re-render)
- BUG: Move folder context menu is hard to navigate — no arrow key support, list window too small for mousing
- FEATURE: Drag to rearrange folders in tree (Phase 8 drag-and-drop tracks this)
- FEATURE: Drag-based folder arrangement should inform clustering logic for next run (user arrangement as training signal)

### Blockers/Concerns

- HIER-06 debt: exporter round-trip tests for max-depth and empty-DL-after-deletion absent — known deferred gap from Phase 7; HIER-06 remains in REQUIREMENTS.md as Pending
- Phase 8 (Drag-and-Drop): Three-zone drop geometry (top/middle/bottom strips with getBoundingClientRect) not yet prototyped against renderTree() DOM — needs careful stopPropagation design.

## Session Continuity

Last session: 2026-03-27T00:03:02.091Z
Stopped at: Completed 08-01-PLAN.md
Resume file: None
