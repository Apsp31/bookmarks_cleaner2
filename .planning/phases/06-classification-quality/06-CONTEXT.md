# Phase 6: Classification Quality - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve the accuracy and coverage of the classification pipeline without adding new top-level categories or HTTP fetches. Deliverables: expanded DOMAIN_RULES map (~300 entries), URL-path and subdomain pattern hints as a 3rd fallback step, tightened CATEGORY_KEYWORDS to reduce false positives, and first-class support for hyphen-prefix folder preservation with a per-folder opt-in toggle in the UI.

</domain>

<decisions>
## Implementation Decisions

### Path & Subdomain Signal Mapping
- **D-01:** Add URL-path hints as a 3rd fallback step (after domain rules AND metadata both fail): `/blog/`, `/news/` → News; `/docs/`, `/documentation/` → Reference; `/shop/`, `/store/` → Shopping; `/api/` → Development. Implemented as `classifyByPath(url)` in `classifier.js`.
- **D-02:** Add subdomain hints in the same step: `docs.*` → Reference; `blog.*` → News; `shop.*` → Shopping. Implemented as `classifyBySubdomain(url)` or folded into `classifyByPath`.
- **D-03:** No new top-level categories — all path/subdomain signals map to existing category labels (Development, Video, Social / Community, News, Shopping, Tools, Reference, Design, Finance, Learning, Other).
- **D-04:** Pipeline order becomes: domain rules → OG/meta keywords → path/subdomain signals → 'Other'.

### Hyphen-Prefix Folder Preservation
- **D-05:** Bookmarks whose source folder name starts with `-` are placed in a top-level folder with the original name (e.g., `-Pinned`) in the classified hierarchy — they do NOT go through normal category classification.
- **D-06:** Preservation check happens in `classifyTree` or `buildHierarchy`: if a link's source folder name starts with `-`, the link is tagged with `category = originalFolderName` (the `-`-prefixed name) so `buildHierarchy` groups it into a folder by that name.
- **D-07:** The original folder name is preserved as-is, including the `-` prefix.
- **D-08:** The `classifyTree` call needs to know which source folder each link came from. The tree walk already traverses folder nodes; when entering a folder whose name starts with `-`, links inside are tagged rather than classified.

### Per-Folder Opt-In (CLASS-06)
- **D-09:** Each hyphen-prefix folder in the left-panel tree (rendered during `status === 'checked'`) gets an inline toggle: a small `[↺ reclassify]` badge/button appended to the folder row by `renderTree` when it detects a `-`-prefixed folder name.
- **D-10:** Toggled folder IDs (or names) are tracked in Alpine state as a `Set` (e.g., `reclassifyFolders: new Set()`). The `renderTree` call in the checked state passes an `onToggleReclassify` callback.
- **D-11:** Default is preserved (not toggled) — user must explicitly opt in per folder.
- **D-12:** `POST /api/classify` request body includes a `reclassifyFolders` array of folder names opted in. The classify route passes this to `classifyTree` so opted-in folders go through normal classification instead of preservation.

### Domain Expansion & Keyword Precision
- **D-13:** `DOMAIN_RULES` expanded from ~50 to ~300 entries. Broad coverage across all existing categories — Claude's discretion on which domains to add, proportional across categories.
- **D-14:** Golden-file regression test written BEFORE any `CATEGORY_KEYWORDS` changes (per STATE.md warning: iteration order is load-bearing). The test fixture captures current classification output for a representative set of URLs; no keyword change may alter previously correct results.
- **D-15:** `CATEGORY_KEYWORDS` tightened by removing or narrowing overloaded terms (e.g., "app", "web"). Claude's discretion on exact terms — goal is fewer false positives, not fewer entries overall.

### Claude's Discretion
- Exact domain entries added to the ~300-entry DOMAIN_RULES map
- Whether `classifyByPath` and `classifyBySubdomain` are one function or two
- Exact path prefix list beyond the examples above
- Keyword terms to remove/narrow in CATEGORY_KEYWORDS
- Golden-file test fixture format (JSON snapshot of URL → category pairs)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Classification Quality — CLASS-01 through CLASS-06 (exact acceptance criteria)
- `.planning/ROADMAP.md` §Phase 6 — Success criteria (5 items)

### Source files to read before implementing
- `src/classifier.js` — current DOMAIN_RULES map (~50 entries), CATEGORY_KEYWORDS, classifyByDomain, classifyByMetadata, classifyNode, classifyTree
- `src/hierarchyBuilder.js` — buildHierarchy: how it groups by category and constructs folder nodes
- `src/routes/classify.js` — POST /api/classify route; how it calls classifyTree and buildHierarchy
- `public/app.js` — classifyBookmarks(), renderTree(), Alpine state shape; how the checked-state tree is rendered in `x-ref="treeContainer"`
- `public/index.html` — classify step UI (status === 'checked'): the Classify Bookmarks button and tree container; classified state layout

### Prior phase context (locked decisions)
- `.planning/milestones/v1.0-phases/04-classifier-and-structure/04-CONTEXT.md` — D-01 through D-18: classification pipeline decisions, session state shape, immutable-stage pattern
- `.planning/milestones/v1.0-phases/05-editable-ui/05-CONTEXT.md` — renderTree options pattern, editMode, onContextMenu callback

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `classifyByDomain(url)` in `classifier.js`: strips `www.`, looks up `DOMAIN_RULES[hostname]` — new `classifyByPath`/`classifyBySubdomain` follows the same signature pattern
- `classifyByMetadata(metadata)` in `classifier.js`: keyword scan on OG title+desc — same pattern for the new step
- `classifyNode(node)` in `classifier.js`: chains domain → metadata → 'Other' — extend chain to domain → metadata → path/subdomain → 'Other'
- `renderTree(node, container, depth, options)` in `app.js`: accepts an `options` object with callbacks (`onContextMenu`) — add `onToggleReclassify` callback following this pattern

### Established Patterns
- **Immutable-stage**: `classifyTree` returns a new tree, never mutates input — preserve this
- **Classifier functions are pure**: no Express/session dependencies — `classifyByPath` must also be independently testable
- **TDD first**: prior phases wrote unit tests before implementation (see Phase 4 D-16)
- **`renderTree` options object**: callbacks passed via options, not globals — per-folder toggle uses same mechanism
- **Alpine state via `$data`**: `reclassifyFolders` added to the Alpine `x-data` object alongside existing state fields

### Integration Points
- `src/classifier.js`: Add `classifyByPath(url)`, extend `classifyNode()` chain
- `src/routes/classify.js`: Accept `reclassifyFolders` from request body, pass to `classifyTree`
- `classifyTree()` / tree walk: when entering a folder node, check if its name starts with `-` and whether it's in `reclassifyFolders`; if preserved, tag links with `category = folderName`
- `public/app.js`: Add `reclassifyFolders` Set to Alpine state; pass `onToggleReclassify` to `renderTree` in checked state; include in `POST /api/classify` body
- `public/index.html`: `renderTree` in checked state (`x-ref="treeContainer"`) needs the new callback option

</code_context>

<specifics>
## Specific Ideas

- Path/subdomain signals are the 3rd fallback only — they do NOT override domain rules or OG metadata matches. A `github.com/blog/` post stays in Development (domain rule wins), not News (path hint).
- The `-` folder naming convention is user intent ("I deliberately named this folder starting with dash to keep it separate") — preservation should be the default, opt-in to reclassify.
- The inline toggle sits on the folder row in the left panel during the **checked** state (before classification). Once classification runs, the left panel in the classified state shows the original `tree` read-only — no toggle needed there.

</specifics>

<deferred>
## Deferred Ideas

- Sub-taxonomies beyond Development (Design, Finance, Shopping sub-folders) — Phase 7 or Future Requirements
- User-defined category rules (custom domain → category mappings) — Future Requirements
- NLP/ML classification — explicitly Out of Scope per REQUIREMENTS.md

None — discussion stayed within Phase 6 scope.
</deferred>

---

*Phase: 06-classification-quality*
*Context gathered: 2026-03-24*
