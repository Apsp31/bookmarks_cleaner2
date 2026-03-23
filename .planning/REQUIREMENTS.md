# Requirements: Bookmark Cleaner

**Defined:** 2026-03-23
**Core Value:** A single clean, importable bookmark file where every link works, nothing is duplicated, and everything is filed where you'd actually look for it.

---

## v1 Requirements

### File I/O

- [ ] **FILE-01**: User can load a Chrome bookmark HTML export via drag-and-drop or file picker
- [ ] **FILE-02**: App automatically saves a backup of the original file on load (shown to user before any action)
- [ ] **FILE-03**: User can export the final bookmark tree as a Chrome-importable Netscape HTML file

### Dead Link Checking

- [ ] **LINK-01**: App checks every bookmark URL via HTTP (HEAD-first, GET fallback) and marks confirmed dead links (non-2xx, timeout, DNS failure)
- [ ] **LINK-02**: Confirmed dead links are removed from the output tree
- [ ] **LINK-03**: Rate-limited URLs (429 responses) are flagged as "could not verify" and kept in the output
- [ ] **LINK-04**: URLs returning 401 or 403 are treated as alive (protected pages exist)
- [ ] **LINK-05**: User sees real-time progress during link checking: checked/total count, current URL being checked, estimated time remaining

### Deduplication

- [ ] **DEDUP-01**: App detects duplicate bookmarks by URL (after normalization) across the entire tree and retains only one copy
- [ ] **DEDUP-02**: URL normalization strips UTM/tracking parameters (utm_*, fbclid, gclid), normalizes www prefix, strips trailing slashes, and normalizes http/https before comparison
- [ ] **DEDUP-03**: App detects folders with similar names via fuzzy matching and proposes merging them (user must confirm before merge)
- [ ] **DEDUP-04**: App detects fully duplicated folder subtrees (same name, same URL children) and proposes removing the redundant copy

### Classification

- [ ] **CLASS-01**: App classifies each bookmark using a built-in domain→category rules map (github.com→Development, youtube.com→Video, reddit.com→Community, etc.)
- [ ] **CLASS-02**: App extracts Open Graph tags and meta description from pages already fetched during link checking to classify domains not in the rules map
- [ ] **CLASS-03**: App removes empty folders from the output after all other operations

### Structure

- [ ] **STRUCT-01**: App proposes a new folder hierarchy derived from the bookmark collection, max 3 levels deep
- [ ] **STRUCT-02**: Proposed hierarchy uses a sensible top-level taxonomy derived from the actual collection (not a fixed imposed structure)

### User Interface

- [ ] **UI-01**: User sees a before/after tree view: original structure on the left, cleaned/proposed structure on the right
- [ ] **UI-02**: User can right-click any bookmark or folder in the proposed tree to: move to a different folder, mark as keep, or delete
- [ ] **UI-03**: User sees a summary panel after processing: dead links removed, duplicates removed, folders merged, total bookmarks remaining

---

## v2 Requirements

### Editing

- **EDIT-01**: User can drag-and-drop bookmarks and folders within the proposed tree to rearrange before exporting
- **EDIT-02**: User can undo the last edit action in the proposed tree

### Classification

- **CLASS-04**: Free classification API fallback (uClassify text API) for bookmarks not classified by domain rules or page metadata
- **CLASS-05**: Configurable similarity threshold for fuzzy folder merge (default ~85%)

### Format Support

- **FORMAT-01**: Support Firefox bookmark HTML export format as input
- **FORMAT-02**: Support Safari bookmark export format as input

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud sync / account system | Bookmarks are sensitive; local-only is a trust and privacy feature |
| Browser extension | Manifest V3 constraints, Web Store review, out of scope for file-based tool |
| LLM-powered categorization | API cost, rate limits, and latency for 1000+ bookmarks; domain rules + OG metadata is sufficient |
| Automatic scheduling / background cleanup | Turns a simple tool into a daemon; one-shot workflow is the product |
| Tag system | Tags don't survive Chrome import/export round-trip; not supported by Netscape bookmark format |
| Real-time link re-checking on open | Hostile to networks; one-shot check per session |

---

## Traceability

*Populated during roadmap creation.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| FILE-01 | Phase 1 | Pending |
| FILE-02 | Phase 1 | Pending |
| FILE-03 | Phase 1 | Pending |
| LINK-01 | Phase 3 | Pending |
| LINK-02 | Phase 3 | Pending |
| LINK-03 | Phase 3 | Pending |
| LINK-04 | Phase 3 | Pending |
| LINK-05 | Phase 3 | Pending |
| DEDUP-01 | Phase 2 | Pending |
| DEDUP-02 | Phase 2 | Pending |
| DEDUP-03 | Phase 2 | Pending |
| DEDUP-04 | Phase 2 | Pending |
| CLASS-01 | Phase 4 | Pending |
| CLASS-02 | Phase 4 | Pending |
| CLASS-03 | Phase 2 | Pending |
| STRUCT-01 | Phase 4 | Pending |
| STRUCT-02 | Phase 4 | Pending |
| UI-01 | Phase 5 | Pending |
| UI-02 | Phase 5 | Pending |
| UI-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after initial definition*
