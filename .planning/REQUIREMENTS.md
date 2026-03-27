# Requirements: Bookmark Cleaner

**Defined:** 2026-03-24
**Core Value:** A single clean, importable bookmark file where every link works, nothing is duplicated, and everything is filed where you'd actually look for it.

## v1.1 Requirements

### Classification Quality

- [x] **CLASS-01**: Classifier uses an expanded `DOMAIN_RULES` map (~300 entries) covering more domains across all categories
- [x] **CLASS-02**: Classifier applies URL path pattern hints as a 3rd fallback step (`/blog/`, `/docs/`, `/shop/`, `/api/`, etc.)
- [x] **CLASS-03**: Classifier applies sub-domain pattern hints (`docs.*` → Documentation, `shop.*` → Shopping, `blog.*` → Blog/News)
- [x] **CLASS-04**: `CATEGORY_KEYWORDS` tightened to reduce false positives from overloaded terms (e.g. "app", "web")
- [x] **CLASS-05**: Bookmarks in folders whose names start with `-` are preserved in their original folder in the classified output (not reclassified)
- [x] **CLASS-06**: User can opt in to classify hyphen-prefixed folder contents normally (checkbox or button in the classify step UI)
- [x] **CLASS-07**: When a bookmark cannot be classified by any pipeline rule, its source folder name is used as the category (fuzzy-matched against standard categories if close enough, otherwise preserved as-is); root-level bookmarks with no source folder still fall to "Other"

### Sub-Categorisation

- [x] **HIER-01**: `buildHierarchy` uses deterministic node IDs (not `crypto.randomUUID()`) so edit operations survive hierarchy rebuilds
- [x] **HIER-02**: Sub-folders created automatically when a top-level category exceeds the configured link threshold (default: 20)
- [x] **HIER-03**: Predefined sub-taxonomy for Development: Frontend, Backend, DevOps/Cloud, Tools, Learning, AI/ML
- [x] **HIER-04**: AI/ML is a recognised sub-category of Development (covering openai.com, huggingface.co, etc.)
- [x] **HIER-05**: Threshold is a named constant in `hierarchyBuilder.js` (not hardcoded inline)
- [ ] **HIER-06**: Folder depth is capped at 3 levels; round-trip tests assert max depth and no empty `<DL>` blocks in export

### Drag-and-Drop

- [x] **DND-01**: User can drag folders to reorder them within the same parent level in the review tree UI
- [ ] **DND-02**: Drop targets are visually highlighted during drag; invalid targets are not highlighted
- [x] **DND-03**: Reorder persists to session (survives page refresh during the review workflow)
- [ ] **DND-04**: Drag interactions do not conflict with existing right-click context menu

## Future Requirements

### Classification

- Expand sub-taxonomies beyond Development (Design, Finance, Shopping, News sub-folders)
- User-defined category rules (custom domain → category mappings)

### Drag-and-Drop

- Drag bookmarks between folders (cross-folder move via drag)
- Touch/mobile drag support

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cross-folder bookmark drag | Existing context menu covers this; DnD cross-folder requires SortableJS group config + significant state sync |
| NLP/ML classification | Coverage and coarseness gaps are fixable with rule expansion; algorithm quality is not the bottleneck |
| uClassify / external classification API | Uncertain longevity; rules + OG metadata cover the majority without API dependency |
| Cloud hosting / multi-user | Personal tool first |
| Firefox/Safari bookmark formats | Chrome export only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLASS-01 | Phase 6 | Complete |
| CLASS-02 | Phase 6 | Complete |
| CLASS-03 | Phase 6 | Complete |
| CLASS-04 | Phase 6 | Complete |
| CLASS-05 | Phase 6 | Complete |
| CLASS-06 | Phase 6 | Complete |
| CLASS-07 | Phase 6 | Pending (gap closure — 06-04-PLAN.md) |
| HIER-01 | Phase 7 | Complete |
| HIER-02 | Phase 7 | Complete |
| HIER-03 | Phase 7 | Complete |
| HIER-04 | Phase 7 | Complete |
| HIER-05 | Phase 7 | Complete |
| HIER-06 | Phase 7 | Pending |
| DND-01 | Phase 8 | Complete |
| DND-02 | Phase 8 | Pending |
| DND-03 | Phase 8 | Complete |
| DND-04 | Phase 8 | Pending |

**Coverage:**
- v1.1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-25 after CLASS-07 gap identified*
