# Roadmap: Bookmark Cleaner

## Overview

Five phases deliver a local web app that takes a messy Chrome bookmark export and produces a clean, importable file. The pipeline must be correct before the UI has anything meaningful to show, so phases build strictly on each other: parse and export together (round-trip confidence), then pure cleanup logic (deduplication, folder merging), then the network-heavy link checker with real-time progress, then classification and hierarchy proposal, and finally the editable before/after tree that lets the user review and export. Each phase is validated with a real bookmark file before the next begins.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Types, parser, exporter, and round-trip validation — the file I/O contract (completed 2026-03-23)
- [ ] **Phase 2: Core Cleanup** - Deduplication and fuzzy folder merging — pure pipeline logic, no network calls
- [ ] **Phase 3: Link Checker** - Concurrent dead-link detection with real-time SSE progress stream
- [ ] **Phase 4: Classifier and Structure** - Category assignment and proposed 3-level hierarchy
- [ ] **Phase 5: Editable UI** - Before/after tree view, context menu editing, summary panel, and export

## Phase Details

### Phase 1: Foundation
**Goal**: Users can load a Chrome bookmark file and download a structurally intact clean file, validating the parse/export contract
**Depends on**: Nothing (first phase)
**Requirements**: FILE-01, FILE-02, FILE-03
**Success Criteria** (what must be TRUE):
  1. User can load a Chrome bookmark HTML export via drag-and-drop or file picker and see the file accepted
  2. App immediately shows a backup was saved before any processing begins
  3. User can click Export and receive a valid Netscape HTML file that Chrome can import without error
  4. A round-trip test (parse the original, export, re-parse the export) produces identical bookmark and folder counts
**Plans:** 3/3 plans complete
Plans:
- [x] 01-01-PLAN.md — Project setup, types, parser, exporter, and round-trip tests
- [x] 01-02-PLAN.md — Express server, session store, upload and export API routes
- [x] 01-03-PLAN.md — Frontend landing page with drop zone, backup, tree display, and export

### Phase 2: Core Cleanup
**Goal**: Users can process a loaded bookmark file through deduplication and folder merging before any network calls are made
**Depends on**: Phase 1
**Requirements**: DEDUP-01, DEDUP-02, DEDUP-03, DEDUP-04
**Success Criteria** (what must be TRUE):
  1. Duplicate bookmarks (same URL after tracking-param normalization, www/http/trailing-slash normalization) are reduced to one copy in the output tree
  2. Folders with similar names (e.g., "Dev Tools" and "Developer Tools") are flagged and the user must confirm before they are merged
  3. Fully duplicated folder subtrees are detected and the user is prompted to remove the redundant copy
  4. URL normalization correctly strips UTM parameters, fbclid, gclid, normalizes www prefix, trailing slashes, and http/https variants — verified by unit tests covering all seven patterns
**Plans:** 2/3 plans executed
Plans:
- [x] 02-01-PLAN.md — TDD: URL normalization, dedup tree walk, fuzzy folder matching, subtree fingerprinting
- [x] 02-02-PLAN.md — Backend routes: /api/cleanup, /api/merge, session extension, export fallback
- [ ] 02-03-PLAN.md — Frontend: Run Cleanup button, merge review UI with inline badges, bulk approve

### Phase 3: Link Checker
**Goal**: Users can check every bookmark URL for liveness and see real-time progress while the checker runs
**Depends on**: Phase 2
**Requirements**: LINK-01, LINK-02, LINK-03, LINK-04, LINK-05
**Success Criteria** (what must be TRUE):
  1. App checks every bookmark URL and marks confirmed dead links (non-2xx, timeout, DNS failure); dead links are absent from the output tree
  2. URLs returning 429 are kept in the output and flagged as "could not verify" — they are not removed as dead
  3. URLs returning 401 or 403 are treated as alive and kept in the output
  4. User sees a live progress indicator during checking: count checked out of total, current URL being tested, and estimated time remaining
  5. Checker uses two-level concurrency control (global ceiling and per-domain ceiling of 1-2) so the local network is not overwhelmed and CDN rate limits are not triggered
**Plans**: TBD
**UI hint**: yes

### Phase 4: Classifier and Structure
**Goal**: Users receive a proposed, sensibly organised 3-level folder hierarchy derived from the actual bookmark collection
**Depends on**: Phase 3
**Requirements**: CLASS-01, CLASS-02, STRUCT-01, STRUCT-02
**Success Criteria** (what must be TRUE):
  1. Every bookmark is assigned a category using the built-in domain rules map (github.com → Development, youtube.com → Video, etc.) without any network call beyond what the link checker already made
  2. Bookmarks whose domains are not in the rules map are classified using Open Graph tags and meta description extracted during the link-check fetch — no additional fetch is made
  3. App proposes a folder hierarchy no deeper than 3 levels, with top-level folders derived from the actual collection rather than a fixed imposed list
  4. Proposed hierarchy avoids taxonomy explosion — top-level folder count is bounded and near-synonym categories are merged under one label
**Plans**: TBD

### Phase 5: Editable UI
**Goal**: Users can review the before/after tree, adjust the proposed structure, and export the final clean bookmark file
**Depends on**: Phase 4
**Requirements**: CLASS-03, UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. User sees a side-by-side view with the original structure on the left (read-only) and the cleaned proposed structure on the right
  2. User can right-click any bookmark or folder in the proposed tree to move it, mark it as keep, or delete it
  3. User sees a summary panel showing: dead links removed, duplicates removed, folders merged, and total bookmarks remaining
  4. Empty folders are absent from the exported file after all operations have run
  5. User can click Export and receive the final cleaned Netscape HTML file ready to import into Chrome
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete   | 2026-03-23 |
| 2. Core Cleanup | 2/3 | In Progress|  |
| 3. Link Checker | 0/? | Not started | - |
| 4. Classifier and Structure | 0/? | Not started | - |
| 5. Editable UI | 0/? | Not started | - |
