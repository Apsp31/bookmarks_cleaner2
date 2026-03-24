# Roadmap: Bookmark Cleaner

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-03-24) — [archive](.planning/milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Quality & Navigation** — Phases 6–8 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–5) — SHIPPED 2026-03-24</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-03-23
- [x] Phase 2: Core Cleanup (3/3 plans) — completed 2026-03-23
- [x] Phase 3: Link Checker (2/2 plans) — completed 2026-03-23
- [x] Phase 4: Classifier and Structure (2/2 plans) — completed 2026-03-23
- [x] Phase 5: Editable UI (3/3 plans) — completed 2026-03-24

</details>

### 🚧 v1.1 Quality & Navigation (In Progress)

**Milestone Goal:** Upgrade classification depth and accuracy, add sub-categorisation for large folders, and introduce drag-and-drop folder reordering in the review UI.

- [ ] **Phase 6: Classification Quality** — Expand domain rules coverage, add URL/subdomain pattern hints, tighten keyword precision, and preserve hyphen-prefixed folders
- [ ] **Phase 7: Sub-Categorisation** — Automatic sub-folders for large categories with a predefined taxonomy, deterministic node IDs, depth cap, and recursive empty-folder pruning
- [ ] **Phase 8: Drag-and-Drop** — Folder reordering via native HTML5 drag in the right review panel with visual feedback and session persistence

## Phase Details

### Phase 6: Classification Quality
**Goal**: The classifier produces more accurate category assignments for a broader range of bookmarks
**Depends on**: Phase 5 (complete v1.0 baseline)
**Requirements**: CLASS-01, CLASS-02, CLASS-03, CLASS-04, CLASS-05, CLASS-06
**Success Criteria** (what must be TRUE):
  1. Bookmarks for common long-tail domains (outside the original 143-entry map) are classified into a recognisable category rather than falling to "Other"
  2. A URL on a `docs.*` subdomain or with a `/blog/` path is classified using that structural signal when the domain rule is absent
  3. A bookmark inside a folder whose name starts with `-` appears in its original folder in the classified output, not in a reclassified category
  4. A checkbox or button in the classify step UI lets the user opt in to reclassify hyphen-prefixed folder contents normally
  5. Expanding CATEGORY_KEYWORDS does not silently reclassify previously correct bookmarks (golden-file test covers the baseline)
**Plans:** 2/3 plans executed
Plans:
- [x] 06-01-PLAN.md — Golden-file test, DOMAIN_RULES expansion, classifyByPath function
- [x] 06-02-PLAN.md — Hyphen-prefix folder preservation, classify route update, keyword tightening
- [ ] 06-03-PLAN.md — Reclassify toggle UI and human verification

### Phase 7: Sub-Categorisation
**Goal**: Large category folders are automatically split into named sub-folders so the hierarchy is navigable at 2–3 levels deep
**Depends on**: Phase 6
**Requirements**: HIER-01, HIER-02, HIER-03, HIER-04, HIER-05, HIER-06
**Success Criteria** (what must be TRUE):
  1. A category folder with more than 20 links gains sub-folders named from the predefined taxonomy (e.g. Development splits into Frontend, Backend, DevOps/Cloud, Tools, Learning, AI/ML)
  2. AI/ML-related bookmarks (openai.com, huggingface.co, etc.) appear in a dedicated AI/ML sub-folder within Development rather than in a generic "Other"
  3. After a hierarchy rebuild, drag and edit operations continue to work correctly — no silent no-ops from changed node IDs
  4. No exported bookmark file contains folders nested deeper than 3 levels (root → category → sub-category → link)
  5. No empty `<DL>` blocks appear in the exported HTML after the user deletes bookmarks from sub-folders
**Plans**: TBD
**UI hint**: yes

### Phase 8: Drag-and-Drop
**Goal**: Users can reorder folders within the same parent level in the right review panel by dragging
**Depends on**: Phase 7
**Requirements**: DND-01, DND-02, DND-03, DND-04
**Success Criteria** (what must be TRUE):
  1. A user can drag a folder row to a new position within the same parent and the tree reflects the new order immediately
  2. A visible insertion line appears at valid drop positions during a drag; no highlight appears over invalid targets
  3. Folder order set by drag persists after a page refresh during the review workflow
  4. Right-clicking a folder during or after a drag opens the context menu normally without triggering an unintended edit operation
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-23 |
| 2. Core Cleanup | v1.0 | 3/3 | Complete | 2026-03-23 |
| 3. Link Checker | v1.0 | 2/2 | Complete | 2026-03-23 |
| 4. Classifier and Structure | v1.0 | 2/2 | Complete | 2026-03-23 |
| 5. Editable UI | v1.0 | 3/3 | Complete | 2026-03-24 |
| 6. Classification Quality | v1.1 | 2/3 | In Progress|  |
| 7. Sub-Categorisation | v1.1 | 0/? | Not started | - |
| 8. Drag-and-Drop | v1.1 | 0/? | Not started | - |
