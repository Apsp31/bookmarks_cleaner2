# Stack Research

**Domain:** Local Node.js utility app — bookmark file processor with browser review UI
**Researched:** 2026-03-24 (v1.1 update — incremental additions only)
**Confidence:** HIGH (drag-and-drop), HIGH (sub-categorisation architecture), MEDIUM (classification improvement)

---

> **Scope note:** This file covers NEW additions for v1.1. The full v1.0 baseline stack
> (Node.js 20+, Express 5.2.1, Alpine.js 3.x CDN, cheerio 1.2.0, p-limit 7.3.0,
> fastest-levenshtein 1.0.16, ESM, no build step) is documented in CLAUDE.md and is
> NOT repeated here.

---

## New Additions for v1.1

### Drag-and-Drop

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| SortableJS | 1.15.7 | Folder drag-and-drop reordering in the review tree UI | Most widely used vanilla drag-and-drop library (13M+ downloads/month via jsDelivr). No jQuery. Supports nested lists natively via the `group` option. Available via CDN — no build step. Confirmed version via npm registry 2026-03-24. |
| @alpinejs/sort | 3.15.8 | Optional: Alpine wrapper for SortableJS | Official Alpine plugin. CDN-compatible. Adds `x-sort` / `x-sort:item` directives. However: see "Integration Notes" below — the Alpine wrapper has a known issue with `x-for` + `x-sort` DOM sync that makes it unreliable for nested tree structures. Prefer direct SortableJS unless the folder list is flat. |

**CDN links (load before Alpine core in HTML `<head>`):**

```html
<!-- If using SortableJS directly (recommended for nested tree) -->
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/Sortable.min.js"></script>

<!-- If using the Alpine sort plugin (flat lists only) -->
<script defer src="https://cdn.jsdelivr.net/npm/@alpinejs/[email protected]/dist/cdn.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/[email protected]/dist/cdn.min.js"></script>
```

**Integration pattern for nested trees (direct SortableJS via Alpine `x-init`):**

```javascript
// In Alpine x-init on the folder list container:
x-init="
  Sortable.create($refs.folderList, {
    group: 'folders',
    animation: 150,
    fallbackOnBody: true,
    swapThreshold: 0.65,
    onEnd(evt) { $dispatch('folder-reordered', { oldIndex: evt.oldIndex, newIndex: evt.newIndex }) }
  })
"
```

This bypasses `x-sort` entirely — Alpine handles data state, SortableJS handles the DOM drag mechanics. Avoids the `x-for` + `x-sort` DOM sync bug (Alpine discussion #4157, resolved in PR #4361 but still fragile for nested cases).

### Sub-Categorisation

**No new npm package required.**

Sub-categorisation is a code extension of `hierarchyBuilder.js`. The existing architecture already supports it — `buildHierarchy` produces `root → category → links` (depth 2). The v1.1 change extends it to `root → category → subcategory → links` (depth 3, within the existing D-08 max-3-level constraint) for categories that exceed a threshold (e.g., > 20 links).

Required changes are confined to two existing files:

| File | Change |
|------|--------|
| `src/classifier.js` | Add `SUBCATEGORY_RULES` map: `category → { subcategory → [domain patterns / keywords] }`. Extend `classifyNode` to set `node.subcategory` in addition to `node.category`. |
| `src/hierarchyBuilder.js` | In `buildHierarchy`, after grouping by category, group large categories by subcategory before building folder nodes. Skip sub-grouping for small categories (< threshold) to avoid over-nesting. |

No new library is needed — `fastest-levenshtein` (already installed) handles fuzzy dedup of any auto-generated subcategory folder names, same as it does for top-level categories.

**Subcategory threshold recommendation:** Apply sub-grouping only when a top-level category has > 15 links. Below that, flat is cleaner.

### Classification Quality

**No new npm package required.** The classification improvement is domain expansion + keyword precision, not ML.

Current state: `DOMAIN_RULES` has ~143 entries across 10 categories. `CATEGORY_KEYWORDS` provides keyword fallback. The problems are:
- `Development` is over-broad (AI tools, cloud infra, package registries, code playgrounds all land there)
- Keyword patterns are short strings (e.g. `'docs'`) that over-match unrelated pages

The v1.1 fix is:
1. Expand `DOMAIN_RULES` to ~300 entries (more regional news sites, more niche dev tools, music, health, travel, food categories)
2. Add `SUBCATEGORY_RULES` as described above (e.g., `Development → { 'AI / ML': ['openai.com', 'huggingface.co', ...], 'DevOps': ['docker.com', 'kubernetes.io', ...] }`)
3. Tighten `CATEGORY_KEYWORDS` patterns — replace short fragments with longer, more specific phrases

**Why not NLP/ML libraries:**
- `natural` (v8.1.1, ESM, Node.js 20+): Provides Naive Bayes classifier and TF-IDF. Would require building a training corpus of (title, category) pairs to be useful. For a rules-based classifier that already covers 80-90% of common domains, the training overhead is not justified. Adds ~3MB.
- `wink-nlp` (v2.4.0): CJS-only entry point (`src/wink-nlp.js`), would need `createRequire` shim in ESM project. Overkill for keyword matching.
- `compromise` (v14.15.0, ESM): English-only NLP, useful for POS tagging. Not useful for URL/domain classification where the "text" is a site title + description.

The classification gap in v1.0 is coverage (unknown domains) and coarseness (broad categories), not algorithmic quality. Expanding the rules map addresses both without dependencies.

---

## Alternatives Considered

| Feature | Recommended | Alternative | Why Not |
|---------|-------------|-------------|---------|
| Drag-and-drop | SortableJS 1.15.7 (direct, CDN) | `@alpinejs/sort` plugin | Alpine plugin is a thin wrapper over SortableJS and introduces DOM sync issues with `x-for` in nested lists (Alpine discussion #4157). Use SortableJS directly for tree-level reordering. |
| Drag-and-drop | SortableJS (CDN) | Native HTML5 drag events | HTML5 drag events are workable for flat lists but require significant custom code for nested reorder, ghost element positioning, and drop-zone hit testing. SortableJS handles all of this for ~45KB. |
| Drag-and-drop | SortableJS (CDN) | `dragula` | dragula is unmaintained (last release 2016). |
| Classification | Expanded DOMAIN_RULES map | `natural` Naive Bayes classifier | Requires labelled training data. Rules map already handles the common case. Naive Bayes is better for open-ended text classification, not structured URL patterns. |
| Classification | Expanded DOMAIN_RULES map | External API (Klazify, uClassify) | Klazify: 100 req/day free tier. uClassify URL API: deprecated. Both violate the "no API key for core flow" constraint. |
| Sub-categorisation | Code-only extension of `buildHierarchy` | Separate taxonomy npm package | No maintained npm taxonomy package matches the project's custom category set. Rolling the subcategory map inline keeps the rules co-located with the domain rules, easy to extend. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `natural` npm package | 3MB, requires training corpus to be useful for this domain, adds CJS/ESM friction for v8 | Extend `CATEGORY_KEYWORDS` with more specific patterns |
| `wink-nlp` npm package | CJS entry point requires `createRequire` shim in ESM project; overkill for keyword matching | Expand `DOMAIN_RULES` inline |
| `compromise` npm package | Useful for English grammar/POS; not useful for URL/domain classification | Not applicable |
| `@alpinejs/sort` plugin | Fragile with `x-for` on nested structures (Alpine discussion #4157) | SortableJS directly via CDN in `x-init` |
| `react-sortable-tree` | React dependency, requires build step, violates no-build-step constraint | SortableJS nested example pattern |
| `dnd-kit` | React-only | SortableJS |
| `jsTree` | Requires jQuery | SortableJS + Alpine |
| jQuery | Build-era dependency, no place in a no-build CDN UI | Not needed |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| sortablejs | 1.15.7 | Node.js any (browser library), Alpine.js 3.x | No Node.js dependency — browser-only. Load via CDN. Works with `x-init` and `x-ref` in Alpine. |
| @alpinejs/sort | 3.15.8 | Alpine.js 3.15.8 | Must load before Alpine core. Use only for flat lists — known `x-for` sync issue in nested trees. |
| natural | 8.1.1 | Node.js >=0.4.10 (tested with 20+), ESM supported | NOT recommended for this project, documented here for completeness. Has ESM build (`rollup -c`). |

---

## Installation

No new `npm install` is required for the recommended approach. SortableJS and (optionally) `@alpinejs/sort` are loaded via CDN in HTML. Sub-categorisation and classification improvements are code-only changes to existing files.

```bash
# Nothing to install for the recommended stack additions.
# CDN links added to HTML — no npm packages.
```

If the team later decides to use the `@alpinejs/sort` npm build instead of CDN:

```bash
# Optional: npm build of Alpine sort plugin (not recommended — CDN is sufficient)
npm install @alpinejs/sort
```

---

## Sources

- Alpine.js Sort plugin docs: https://alpinejs.dev/plugins/sort — confirmed v3.x CDN approach, `x-sort:group` for cross-list moves, SortableJS dependency
- @alpinejs/sort npm registry: https://registry.npmjs.org/@alpinejs/sort/latest — confirmed v3.15.8
- jsDelivr @alpinejs/sort: https://www.jsdelivr.com/package/npm/@alpinejs/sort — confirmed v3.15.8, released 2026-02-02
- SortableJS npm registry: https://registry.npmjs.org/sortablejs/latest — confirmed v1.15.7
- jsDelivr sortablejs: https://www.jsdelivr.com/package/npm/sortablejs — confirmed v1.15.7, released 2026-02-11
- Alpine x-sort + x-for DOM sync issue: https://github.com/alpinejs/alpine/discussions/4157 — confirmed bug, resolved in PR #4361, still fragile for nested use
- natural npm registry: https://registry.npmjs.org/natural/latest — confirmed v8.1.1, ESM supported
- wink-nlp npm registry: https://registry.npmjs.org/wink-nlp/latest — confirmed v2.4.0, CJS main entry

---
*Stack research for: Bookmark Cleaner v1.1 — sub-categorisation, classification quality, drag-and-drop*
*Researched: 2026-03-24*
