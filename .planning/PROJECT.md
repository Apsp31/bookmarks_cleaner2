# Bookmark Cleaner

## What This Is

A local web app that takes an exported Chrome bookmark HTML file and produces a clean, well-organised version. It checks every link for validity, deduplicates entries and folders, merges similar folder names, and re-classifies bookmarks into a sensible hierarchy — then presents a side-by-side before/after tree so the user can review and tweak before exporting.

## Core Value

A single clean, importable bookmark file where every link works, nothing is duplicated, and everything is filed where you'd actually look for it.

## Requirements

### Validated

- [x] Parse Chrome bookmark HTML export format — *Validated in Phase 1: Foundation*
- [x] Export clean HTML bookmark file ready to import into Chrome — *Validated in Phase 1: Foundation*
- [x] Run as a local Node.js server — no cloud dependency, no account required — *Validated in Phase 1: Foundation*

### Active

- [ ] Check every URL via HTTP and remove dead links (non-2xx, timeouts, connection refused)
- [ ] Detect and remove exact duplicate bookmarks (same URL regardless of title/location)
- [ ] Detect and merge folders with identical or fuzzy-similar names (e.g. "Dev Tools" + "Developer Tools")
- [ ] Detect and collapse fully duplicated folder trees
- [ ] Classify bookmarks into a sensible category using: domain rules map → page metadata (fetched during link check) → free classification API fallback
- [ ] Propose a target folder hierarchy derived from the bookmark collection (not too deep, not too wide)
- [ ] Present before/after tree UI: original structure on left, cleaned structure on right
- [ ] Allow user to edit the proposed target structure before exporting (drag, rename, merge folders)
- [ ] Export clean HTML bookmark file ready to import into Chrome
- [ ] Run as a local Node.js server — no cloud dependency, no account required

### Out of Scope

- Cloud hosting / multi-user — personal tool first
- Browser extension — file-based workflow is simpler and more portable
- Firefox/Safari bookmark formats — Chrome export only for v1
- Real-time sync — one-shot import/clean/export workflow

## Context

- Chrome exports bookmarks as a Netscape Bookmark Format HTML file (NETSCAPE-Bookmark-file-1)
- Dead link checking requires a Node.js backend to avoid CORS — the same fetch also provides page metadata for classification
- Classification strategy (layered): (1) built-in domain→category map for well-known sites, (2) Open Graph / meta description from the page fetch, (3) free text classification API (e.g. uClassify) for unknowns
- User has a large, messy bookmark file with duplicated branches, duplicated trees, scattered similar-named folders, and many dead links
- Tool should be shareable — keep setup simple (clone + npm start)

## Constraints

- **Tech stack**: Node.js backend + browser frontend — no framework lock-in required
- **No API key required for core flow**: classification API is an enhancement, not a dependency
- **Folder depth**: proposed hierarchy should be max 3 levels deep
- **Self-contained**: all processing local, no data leaves the machine except URL health checks

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local web app over CLI | Need visual before/after review UI; dead link checking needs server anyway | — Pending |
| Layered classification (domain rules → metadata → API) | No API key required for 80-90% of bookmarks; API fills gaps for unknowns | — Pending |
| Before/after tree UI | User wants to see what changed and be able to adjust before committing | — Pending |
| Tool proposes structure, user edits | User wants sensible defaults but final control over hierarchy | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-23 — Phase 1 complete: parse/export contract, Express API, Alpine.js UI*
