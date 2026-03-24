# Bookmark Cleaner

## What This Is

A local web app that takes an exported Chrome bookmark HTML file and produces a clean, well-organised version. It checks every link for validity, deduplicates entries and folders, merges similar folder names, and re-classifies bookmarks into a category hierarchy — then presents a side-by-side before/after tree so the user can review and tweak via context menu before exporting.

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
- ✓ Propose a target folder hierarchy derived from the bookmark collection — v1.0 (single-level only — see Known Issues)
- ✓ Present before/after tree UI: original structure on left, cleaned structure on right — v1.0
- ✓ Allow user to edit the proposed target structure before exporting (delete, keep, move) — v1.0
- ✓ Empty folders absent from exported file — v1.0

### Active (v1.1 candidates)

- [ ] Sub-categorisation: hierarchy should be 2-3 levels deep for large collections, not just one flat level
- [ ] Classification quality: domain rules map covers common sites but misclassifies many — needs expansion or smarter fallback
- [ ] Drag-and-drop folder reordering in the review UI

### Out of Scope

- Cloud hosting / multi-user — personal tool first
- Browser extension — file-based workflow is simpler and more portable
- Firefox/Safari bookmark formats — Chrome export only for v1
- Real-time sync — one-shot import/clean/export workflow
- Free text classification API (uClassify) — uncertain longevity; domain rules + OG metadata cover the majority

## Context

**v1.0 shipped 2026-03-24** — 5 phases, 13 plans, 4,366 LOC JavaScript.

Tech stack: Node.js 20+ / Express 5, Alpine.js (CDN), cheerio, p-limit, fastest-levenshtein.

**Known Issues (from v1.0 release):**
- Classification is single-level only — `buildHierarchy` deferred sub-categorisation in v1 (per D-04). Large categories (e.g. "Development") can contain hundreds of bookmarks with no sub-folders.
- Taxonomy coarseness — the 143-entry domain rules map produces broad categories that don't always match how a user mentally organises their bookmarks.

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
| v1 buildHierarchy single-level only | Avoids taxonomy explosion; deferred sub-categorisation | ⚠ Revisit — large categories are unwieldy without sub-folders |
| HEAD-first link checker, GET fallback on 405 | Minimises bandwidth; 401/403=ok, 429=uncertain | ✓ Good — semantics correct and well-tested |
| structuredClone before session mutation | Immutable-stage pattern prevents partial updates | ✓ Good — clean and safe |
| router-per-file pattern (classify.js, edit.js, etc.) | Consistent Express routing, easy to extend | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-24 after v1.0 milestone*
