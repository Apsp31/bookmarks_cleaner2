# Bookmark Cleaner

## What This Is

A local web app that takes an exported Chrome bookmark HTML file and produces a clean, well-organised version. It checks every link for validity, deduplicates entries and folders, merges similar folder names, re-classifies bookmarks into a category hierarchy with automatic sub-categorisation for large folders, and presents a side-by-side before/after tree so the user can review, drag-reorder, and edit via context menu before exporting.

## Core Value

A single clean, importable bookmark file where every link works, nothing is duplicated, and everything is filed where you'd actually look for it.

## Requirements

### Validated

- ✓ Parse Chrome bookmark HTML export format — v1.0
- ✓ Export clean HTML bookmark file ready to import into Chrome — v1.0
- ✓ Run as a local Node.js server — no cloud dependency, no account required — v1.0
- ✓ Check every URL via HTTP and mark confirmed dead links (non-2xx, timeouts, connection refused) — v1.0
- ✓ Detect and remove exact duplicate bookmarks (same URL after normalisation) — v1.0
- ✓ Detect and merge folders with identical or fuzzy-similar names — v1.0
- ✓ Detect and collapse fully duplicated folder subtrees — v1.0
- ✓ Classify bookmarks into a sensible category using domain rules map → page metadata — v1.0
- ✓ Propose a target folder hierarchy derived from the bookmark collection — v1.0 (single-level only)
- ✓ Present before/after tree UI: original structure on left, cleaned structure on right — v1.0
- ✓ Allow user to edit the proposed target structure before exporting (delete, keep, move) — v1.0
- ✓ Empty folders absent from exported file — v1.0
- ✓ Classification quality: domain rules expanded (143→329), URL path/subdomain hints, golden-file regression, keyword tightening — v1.1
- ✓ Hyphen-prefix folder preservation with opt-in reclassify toggle — v1.1
- ✓ Source folder name fallback via fuzzyMatchCategory (personal folders → meaningful categories) — v1.1
- ✓ Sub-categorisation: deterministic slug IDs, Development sub-taxonomy (6 sub-folders, 63 domains), threshold/coverage guards — v1.1 ⚠ HIER-06 gap: exporter round-trip tests for max-depth/empty-DL absent
- ✓ Drag-and-drop folder reordering in the review UI with drop indicator and context menu guard — v1.1

### Active (v1.2)

- [ ] Cross-parent drag: move bookmarks/folders into a different parent folder via drag
- [ ] Fuzzy folder matching improvement: reduce near-duplicate folder creation
- [ ] Skip/bypass liveness check (link-check step) — user should be able to skip it
- [ ] Time remaining indicator: round and simplify to avoid spurious precision
- [ ] Right-click move folder: tree re-renders after move (no re-render bug)

### Out of Scope

- Cloud hosting / multi-user — personal tool first
- Browser extension — file-based workflow is simpler and more portable
- Firefox/Safari bookmark formats — Chrome export only for v1
- Real-time sync — one-shot import/clean/export workflow
- Free text classification API (uClassify) — uncertain longevity; domain rules + OG metadata cover the majority
- Expand sub-taxonomies beyond Development — deferred until user feedback warrants it

## Context

**v1.1 shipped 2026-03-27** — 3 phases (6–8), 7 plans, ~5,303 LOC JavaScript.

Tech stack: Node.js 20+ / Express 5, Alpine.js (CDN), cheerio, p-limit, fastest-levenshtein.

**Known Issues:**
- HIER-06 debt: exporter round-trip tests for max-depth and empty-DL-after-deletion absent — known deferred gap from Phase 7
- Deduplication fuzzy matching not working for near-duplicate folders ("cakes" vs "cakes (2)", "Sarah" vs "Sarah's bits")
- Move folder context menu: no arrow key support, list window too small for mousing

## Constraints

- **Tech stack**: Node.js backend + browser frontend — no framework lock-in required
- **No API key required for core flow**: classification API is an enhancement, not a dependency
- **Folder depth**: proposed hierarchy should be max 3 levels deep
- **Self-contained**: all processing local, no data leaves the machine except URL health checks

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local web app over CLI | Need visual before/after review UI; dead link checking needs server anyway | ✓ Good — setup is simple, UI works well |
| Layered classification (domain rules → metadata → API) | No API key required for 80-90% of bookmarks; API fills gaps for unknowns | ⚠ Revisit — domain rules cover common sites but coarse for personal collections |
| Before/after tree UI side-by-side | User wants to see what changed and be able to adjust before committing | ✓ Good — two-column layout works cleanly |
| Tool proposes structure, user edits via context menu | Sensible defaults + final control; drag-and-drop deferred for simplicity | ✓ Good — right-click menu sufficient for v1 |
| v1 buildHierarchy single-level only | Avoids taxonomy explosion; deferred sub-categorisation | ✓ Resolved in Phase 7 — Development splits to 6 sub-categories |
| Deterministic slug IDs in buildHierarchy | crypto.randomUUID() silently broke edit ops after hierarchy rebuild — Phase 7 pre-req for drag-and-drop | ✓ Good — slug IDs (folder-development-ai-ml) survive classify re-runs |
| Development-only sub-taxonomy in Phase 7 | maybeSplitIntoSubfolders scoped to Development; other categories stay flat | ✓ Pragmatic — covers main overflow category; extend in future if needed |
| HEAD-first link checker, GET fallback on 405 | Minimises bandwidth; 401/403=ok, 429=uncertain | ✓ Good — semantics correct and well-tested |
| structuredClone before session mutation | Immutable-stage pattern prevents partial updates | ✓ Good — clean and safe |
| router-per-file pattern (classify.js, edit.js, etc.) | Consistent Express routing, easy to extend | ✓ Good |
| Golden-file test before DOMAIN_RULES expansion | CATEGORY_KEYWORDS iteration order is load-bearing — baseline needed before any keyword changes | ✓ Good — caught zero regressions; guards future changes |
| classifyByPath and classifyBySubdomain merged | Single function simpler; both use same hostname/pathname pattern | ✓ Good — cleaner API, equal testability |
| fuzzyMatchCategory with GENERIC_FOLDER_NAMES blocklist | Browser-default folder names (root, bookmarks bar) must not become categories | ✓ Good — handles edge cases cleanly |
| Native HTML5 Drag API over SortableJS | renderTree() uses imperative DOM, not Alpine x-for lists; @alpinejs/sort has known x-for DOM sync bug | ✓ Good — no library dependency, full control |
| Drop indicator fixed-position appended to body | Avoids stacking context issues with tree scroll containers | ✓ Good — works reliably across scroll positions |
| isDraggingNode flag prevents context menu during drag | Drag + right-click conflict was a known risk | ✓ Good — clean guard, no false positives |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-27 after v1.1 milestone (Quality & Navigation)*
