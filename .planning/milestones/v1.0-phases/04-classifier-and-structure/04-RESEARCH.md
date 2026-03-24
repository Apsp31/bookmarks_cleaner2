# Phase 4: Classifier and Structure - Research

**Researched:** 2026-03-23
**Domain:** Bookmark classification pipeline + hierarchy construction (pure in-memory, no external dependencies)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Classification Data Source**
- D-01: Classification uses two sources in priority order: (1) a built-in domain→category rules map keyed by `new URL(url).hostname`, then (2) `BookmarkNode.metadata` fields (`og:title`, `og:description`, `<meta name="description">`) already captured by Phase 3's link checker.
- D-02: No additional HTTP fetches in Phase 4. For HEAD-only successes where `metadata` is absent, the domain rules map is the sole classifier — if it also misses, the bookmark lands in "Other".
- D-03: Domain rules map is a plain JS object/Map (or JSON file) with ~50–100 well-known hostnames. Examples: `github.com → Development`, `youtube.com → Video`, `reddit.com → Community`. Map covers common domains; OG metadata handles the long tail.

**Taxonomy Design**
- D-04: Top-level category set is NOT a fixed imposed list — it is derived from actual classification results. Categories with 0 members are dropped.
- D-05: Starter set of category labels: `Development`, `Video`, `Social / Community`, `News`, `Shopping`, `Tools`, `Reference`, `Design`, `Finance`, `Learning`. These are target labels from domain rules map and OG-based classification.
- D-06: Bookmarks where neither domain rules nor metadata yields a confident category are placed in `Other`. "Other" only appears if at least one bookmark lands there.
- D-07: Sub-categories (level 2 and 3) emerge from the collection via simple keyword matching on category/metadata fields. Simple keyword matching is sufficient for v1.
- D-08: Max folder depth is 3 levels (root → category → sub-category) — hard constraint from PROJECT.md.
- D-09: Single-bookmark categories are kept as-is. Phase 5 lets the user reorganise manually.

**Session State Extension**
- D-10: `src/session.js` gains a `classifiedTree` field (initially `null`), following the immutable-stage pattern.
- D-11: Export priority chain in `src/routes/export.js` extended to: `classifiedTree → checkedTree → cleanTree → tree`.
- D-12: `BookmarkNode.category` field (already stubbed in `src/shared/types.js`) is populated during classification.

**Route and Module Boundaries**
- D-13: New module `src/classifier.js` — classification pipeline. No Express dependency.
- D-14: New module `src/hierarchyBuilder.js` — takes classified tree, produces category-organised BookmarkNode tree.
- D-15: New route `src/routes/classify.js` — `POST /classify`, reads `session.checkedTree` (or `cleanTree` fallback), writes `session.classifiedTree`, returns `classifiedTree` as JSON.
- D-16: TDD first — unit tests for `classifier.js` and `hierarchyBuilder.js` before implementation.

**Frontend Trigger**
- D-17: "Classify Bookmarks" button triggers `POST /api/classify`. Response stored in Alpine state, rendered via existing `renderTree()`.
- D-18: Simple loading state during classification (same pattern as "Run Cleanup"). No SSE needed — classification is in-memory and fast.

### Claude's Discretion
- Exact domain rules map entries beyond the ~10 examples from requirements (fill to ~50–100 common domains)
- OG-to-category keyword matching heuristics (title/description scanning for category keywords)
- Sub-category naming within a top-level category
- Whether to persist `classifiedTree` to the session or recompute on each classify call

### Deferred Ideas (OUT OF SCOPE)
- uClassify text API fallback (CLASS-04 in v2 requirements)
- Configurable similarity threshold (CLASS-05, v2)
- Dynamic taxonomy inference from bookmark text (LLM-powered)
- Re-classification trigger if user edits the proposed structure in Phase 5
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLASS-01 | App classifies each bookmark using a built-in domain→category rules map (github.com→Development, youtube.com→Video, reddit.com→Community, etc.) | Domain rules map design section; hostname extraction via `new URL(url).hostname` |
| CLASS-02 | App extracts Open Graph tags and meta description from pages already fetched during link checking to classify domains not in the rules map | `BookmarkNode.metadata` shape confirmed from `src/linkChecker.js` lines 48–64; OG keyword matching heuristics documented |
| STRUCT-01 | App proposes a new folder hierarchy derived from the bookmark collection, max 3 levels deep | `hierarchyBuilder.js` design; depth-guard enforcement pattern documented |
| STRUCT-02 | Proposed hierarchy uses a sensible top-level taxonomy derived from the actual collection (not a fixed imposed structure) | Dynamic category emergence pattern; drop-empty-categories algorithm documented |
</phase_requirements>

---

## Summary

Phase 4 is a pure in-memory pipeline: classify every `BookmarkNode` link with a category label, then restructure the flat checked tree into a 3-level category hierarchy. No new network I/O. No new npm packages required. The entire implementation draws on patterns already established in Phases 1–3.

The classification pipeline is layered: domain rules map first (fast, deterministic, ~50–100 hostname entries), then OG/meta keyword scan against `node.metadata` (already populated by Phase 3 link checker GET responses), then fallback to "Other". The hierarchy builder groups classified links under category folders, applies a hard depth=3 cap, and drops empty categories before returning the `classifiedTree`.

The codebase is ESM throughout with `"type": "module"` in `package.json`. Tests use Node.js built-in `node:test` runner (no Jest/Vitest). The TDD pattern is established: write `test/classifier.test.js` and `test/hierarchyBuilder.test.js` before any production code.

**Primary recommendation:** Two pure modules (`classifier.js`, `hierarchyBuilder.js`) + one route (`routes/classify.js`) + minimal Alpine state additions. All patterns are direct analogues of Phase 2 and Phase 3 equivalents already in the codebase.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `node:test` | built-in (Node >=18) | Unit test runner | Already used in all existing tests; no install needed |
| Node.js built-in `node:assert/strict` | built-in | Assertions | Already used in all existing tests |
| Express Router | 5.2.1 (already installed) | Route isolation | Router-per-file pattern established in Phase 1 |

No new npm packages are required for Phase 4.

### Supporting (already available)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `new URL(url).hostname` | built-in | Extract hostname for domain rules lookup | Called on every link node URL |
| `String.prototype.toLowerCase()` | built-in | Case-insensitive OG keyword matching | Applied to metadata.title + metadata.description before keyword scan |

### Alternatives Considered

| Recommended | Alternative | Tradeoff |
|-------------|-------------|----------|
| Plain JS object for domain rules map | JSON file | JSON file requires `createRequire` or `fs.readFileSync` in ESM; plain `export const DOMAIN_RULES = {...}` is simpler and statically analysable. Either works; inline object avoids file I/O. |
| Inline keyword array per category | Separate NLP tokeniser | Overkill for v1; a keyword match on lowercased title+description is sufficient per D-07. |
| Node built-in `node:test` | Jest / Vitest | Project established `node:test` from Phase 1 — do not introduce a new runner. |

**Installation:** No `npm install` needed for Phase 4.

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── classifier.js           # NEW — domain rules map + OG keyword matching
├── hierarchyBuilder.js     # NEW — group by category, enforce 3-level cap
├── routes/
│   └── classify.js         # NEW — POST /classify route
├── session.js              # EXTEND — add classifiedTree: null
├── routes/export.js        # EXTEND — classifiedTree first in priority chain
└── shared/
    └── types.js            # READ-ONLY — BookmarkNode.category already stubbed

public/
└── app.js                  # EXTEND — classifiedTree, isClassifying Alpine state

test/
├── classifier.test.js      # NEW — TDD first (D-16)
└── hierarchyBuilder.test.js # NEW — TDD first (D-16)
```

### Pattern 1: Domain Rules Map Lookup

**What:** A plain exported object mapping hostname → category label. Hostname extracted via `new URL(url).hostname` (strips `www.` variants need explicit entries or a normalization step).

**When to use:** Always, as first classifier pass. O(1) lookup.

**Key implementation note:** `new URL('https://www.github.com/foo').hostname` returns `"www.github.com"`, NOT `"github.com"`. The rules map must either include both `github.com` and `www.github.com`, or the lookup must strip a leading `www.` before checking.

**Recommended approach:** Strip leading `www.` in the lookup function, not in the map keys — keeps the map readable and halves its size.

```javascript
// src/classifier.js
export const DOMAIN_RULES = {
  'github.com':      'Development',
  'gitlab.com':      'Development',
  'stackoverflow.com': 'Development',
  'developer.mozilla.org': 'Development',
  'npmjs.com':       'Development',
  'youtube.com':     'Video',
  'vimeo.com':       'Video',
  'twitch.tv':       'Video',
  'reddit.com':      'Social / Community',
  'twitter.com':     'Social / Community',
  'x.com':           'Social / Community',
  'news.ycombinator.com': 'News',
  'bbc.co.uk':       'News',
  'theguardian.com': 'News',
  // ... ~50-100 entries total (Claude's discretion)
};

/**
 * @param {string} url
 * @returns {string|null}  category label or null if not in map
 */
export function classifyByDomain(url) {
  let hostname;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
  return DOMAIN_RULES[hostname] ?? null;
}
```

### Pattern 2: OG Metadata Keyword Classification

**What:** When domain rules miss, scan `node.metadata.title` and `node.metadata.description` for category-associated keywords. Returns the first category whose keywords match.

**When to use:** Only when `classifyByDomain()` returns null AND `node.metadata` is non-null.

**Key implementation note:** Keyword matching should be done on lowercased concatenated title + description. Category keyword arrays should be ordered from most specific to least (avoid generic words like "tool" appearing in a "Development" keyword list swamping the "Tools" category).

```javascript
// src/classifier.js
const CATEGORY_KEYWORDS = {
  'Development': ['github', 'code', 'programming', 'api', 'developer', 'documentation', 'library', 'npm', 'open source'],
  'Video':       ['video', 'watch', 'stream', 'episode', 'playlist', 'channel'],
  'Social / Community': ['forum', 'community', 'discussion', 'post', 'tweet', 'feed'],
  'News':        ['news', 'article', 'breaking', 'report', 'headline', 'journalism'],
  'Shopping':    ['shop', 'buy', 'price', 'cart', 'checkout', 'product', 'store'],
  'Design':      ['design', 'ui', 'ux', 'figma', 'sketch', 'typography', 'color', 'icon'],
  'Finance':     ['finance', 'invest', 'stock', 'crypto', 'bank', 'budget', 'tax'],
  'Learning':    ['course', 'tutorial', 'learn', 'lesson', 'training', 'education', 'mooc'],
  'Reference':   ['wiki', 'reference', 'glossary', 'dictionary', 'specification', 'docs'],
  'Tools':       ['tool', 'generator', 'converter', 'calculator', 'editor', 'playground'],
};

export function classifyByMetadata(metadata) {
  if (!metadata) return null;
  const text = [metadata.title, metadata.description].filter(Boolean).join(' ').toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) return category;
  }
  return null;
}
```

### Pattern 3: Full Classification Pipeline

**What:** Combines domain lookup, OG fallback, and "Other" sentinel into a single `classifyNode()` function.

```javascript
// src/classifier.js
/**
 * Classify a single BookmarkNode link.
 * Mutates node.category in a new cloned node — does NOT mutate input.
 * @param {import('./shared/types.js').BookmarkNode} node
 * @returns {import('./shared/types.js').BookmarkNode}
 */
export function classifyNode(node) {
  if (node.type !== 'link') return node;
  const category =
    classifyByDomain(node.url) ??
    classifyByMetadata(node.metadata) ??
    'Other';
  return { ...node, category };
}

/**
 * Deep-walk a BookmarkNode tree, classifying all link nodes.
 * @param {import('./shared/types.js').BookmarkNode} node
 * @returns {import('./shared/types.js').BookmarkNode}
 */
export function classifyTree(node) {
  if (node.type === 'link') return classifyNode(node);
  return {
    ...node,
    children: (node.children ?? []).map(classifyTree),
  };
}
```

### Pattern 4: Hierarchy Builder

**What:** Takes the classified tree (all link nodes have `.category`), flattens all links, groups by top-level category, then applies sub-category grouping within each top-level folder. Enforces max depth = 3.

**When to use:** Called once after `classifyTree()`, in the classify route.

**Key implementation note:** The hierarchy output is a NEW root `BookmarkNode` of type `'folder'`. Category folders are its direct children (depth 1). Sub-category folders are depth 2. Links are depth 3 (or depth 2 if no sub-categories emerge). This satisfies the max-3-levels hard constraint from D-08.

```javascript
// src/hierarchyBuilder.js

/**
 * Collect all link nodes from a tree (recursive).
 * @param {import('./shared/types.js').BookmarkNode} node
 * @returns {import('./shared/types.js').BookmarkNode[]}
 */
function collectLinks(node) {
  if (node.type === 'link') return [node];
  return (node.children ?? []).flatMap(collectLinks);
}

/**
 * Build a sub-category folder for a list of links within one top-level category.
 * Simple keyword matching on metadata to detect sub-themes.
 * If no sub-categories emerge, return links as direct children (depth 2, not 3).
 *
 * @param {import('./shared/types.js').BookmarkNode[]} links
 * @param {string} category  e.g. 'Development'
 * @returns {import('./shared/types.js').BookmarkNode[]}  children for the category folder
 */
function buildSubCategories(links, category) {
  // v1: return links flat (no sub-categorisation to avoid over-engineering)
  // Claude's discretion: add keyword grouping here in subsequent task
  return links;
}

/**
 * Build the proposed hierarchy tree from a classified tree.
 * @param {import('./shared/types.js').BookmarkNode} classifiedTree
 * @returns {import('./shared/types.js').BookmarkNode}
 */
export function buildHierarchy(classifiedTree) {
  const links = collectLinks(classifiedTree);

  // Group by category
  const byCategory = new Map();
  for (const link of links) {
    const cat = link.category ?? 'Other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(link);
  }

  // Build category folders (drop empty categories automatically — per D-04)
  const categoryFolders = [...byCategory.entries()].map(([cat, catLinks]) => ({
    id: crypto.randomUUID(),
    type: 'folder',
    title: cat,
    children: buildSubCategories(catLinks, cat),
  }));

  return {
    id: crypto.randomUUID(),
    type: 'folder',
    title: 'root',
    children: categoryFolders,
  };
}
```

### Pattern 5: Classify Route (analogous to cleanup.js)

**What:** `POST /classify` reads `session.checkedTree ?? session.cleanTree`, runs the pipeline, stores `session.classifiedTree`.

```javascript
// src/routes/classify.js
import { Router } from 'express';
import { session } from '../session.js';
import { classifyTree } from '../classifier.js';
import { buildHierarchy } from '../hierarchyBuilder.js';

const router = Router();

router.post('/classify', (req, res) => {
  const source = session.checkedTree ?? session.cleanTree;
  if (!source) {
    return res.status(400).json({ error: 'No checked tree available. Run link check first.' });
  }

  const classified = classifyTree(source);
  const classifiedTree = buildHierarchy(classified);
  session.classifiedTree = classifiedTree;

  res.json({ classifiedTree });
});

export default router;
```

### Anti-Patterns to Avoid

- **Mutating input nodes:** All classification and hierarchy building must deep-clone or spread — never assign `node.category = ...` on the input object. The immutable-stage pattern from Phase 2 is established and must be continued.
- **Fixed category list with 0-member entries:** D-04 is explicit — categories not present in the collection must be dropped from the output. Never return folders with empty `children` arrays.
- **Depth > 3:** The 3-level cap must be enforced as a hard guard in `buildHierarchy`, not merely a convention. A bookmark at depth 4 should be promoted to its parent.
- **Calling `new URL()` without try/catch:** Malformed URLs will throw. Pattern established in Phase 3: always wrap in try/catch and return null/dead.
- **Using `node:test` `mock` with static ESM imports:** Phase 3 tests discovered that `globalThis.fetch` must be assigned at call time (not imported as a binding) so test mocks propagate. `classifier.js` and `hierarchyBuilder.js` have no external I/O — this pitfall does not apply to them. But any route tests that import `session` must be aware the session is a module-level singleton.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hostname extraction from URL | Custom string parser (split on `/`, etc.) | `new URL(url).hostname` built-in | Built-in handles protocol-relative, ports, IPv6; custom parsers miss edge cases |
| UUID generation for new folder nodes | Math.random() or counter | `crypto.randomUUID()` built-in (Node >=14.17) | Already used throughout the codebase for `BookmarkNode.id` |
| Tree deep-clone | lodash cloneDeep | Object spread `{...node, children: ...}` | Already established in linkChecker.js `buildCheckedTree()`; no dependency needed |
| Test runner | Jest, Vitest | `node:test` + `node:assert/strict` | Already established in all test files; adding another runner creates conflict |

**Key insight:** Phase 4 is pure data transformation. No external I/O, no new dependencies. Every pattern needed already exists in the codebase.

---

## Common Pitfalls

### Pitfall 1: www. prefix in domain rules map lookups

**What goes wrong:** `new URL('https://www.github.com/foo').hostname` returns `"www.github.com"`. If the rules map only has `"github.com"`, the lookup returns undefined and the bookmark falls through to OG metadata or "Other".

**Why it happens:** The Netscape Bookmark Format stores URLs as-is — users may have bookmarked both `github.com` and `www.github.com` variants.

**How to avoid:** Strip `www.` prefix in the lookup function before checking the map: `hostname.replace(/^www\./, '')`. Do NOT strip it in the raw URL or in the map keys — stripping only at lookup time is safest.

**Warning signs:** Test against a URL like `https://www.youtube.com/watch?v=abc` — it should still classify as 'Video'. If it returns null, the www-stripping is missing.

### Pitfall 2: Session singleton holds stale classifiedTree across file re-uploads

**What goes wrong:** User uploads file A, classifies, sees classifiedTree. User uploads file B (new upload resets `session.tree`, `session.cleanTree`, etc.), but `session.classifiedTree` still holds file A's classified hierarchy.

**Why it happens:** The upload route (Phase 1) resets known session fields but won't know about `classifiedTree` unless it's explicitly included.

**How to avoid:** When adding `classifiedTree: null` to `session.js`, also verify that `src/routes/upload.js` resets ALL session fields (or resets the whole object). Check the upload route's reset logic.

**Warning signs:** After uploading a second file, clicking "Classify" should produce a fresh tree, not show the previous file's categories.

### Pitfall 3: Empty category folders in proposed hierarchy

**What goes wrong:** `buildHierarchy()` creates a category folder for every category in `CATEGORY_KEYWORDS`, even when no bookmarks match that category.

**Why it happens:** Iterating over the fixed keyword map rather than the grouped results.

**How to avoid:** Iterate over the `byCategory` Map (built from actual classified links), not over `CATEGORY_KEYWORDS`. Categories absent from `byCategory` never get a folder.

**Warning signs:** A test with 3 bookmarks all classified as 'Development' should produce exactly 1 top-level folder, not 10 (one for each category in the predefined set).

### Pitfall 4: node:test module-level session mutation in tests

**What goes wrong:** `src/session.js` is a module-level singleton. If one test mutates `session.classifiedTree`, subsequent tests see stale state.

**Why it happens:** Node.js module cache is shared across tests in the same process — module-level state persists.

**How to avoid:** In test files, reset the session object's fields in a `beforeEach` hook. The pattern already exists in `linkChecker.test.js` — follow it.

### Pitfall 5: OG keyword matching is too greedy

**What goes wrong:** A bookmark titled "GitHub Actions Documentation" matches "tool" in the Tools keyword array before "code" in Development, landing it in the wrong category.

**Why it happens:** Generic keywords (tool, doc, guide) appear in many pages; ordering of the keyword map matters.

**How to avoid:** Order `CATEGORY_KEYWORDS` entries so that Development checks its specific keywords (github, npm, api) before Tools checks its generic keywords. Also place more specific categories earlier in the iteration order. Document the ordering rationale in comments.

**Warning signs:** A test classifying a node with `metadata.title = "GitHub Actions Tutorial"` should return 'Development', not 'Learning' or 'Tools'.

---

## Code Examples

### Existing metadata shape (from src/linkChecker.js, lines 48–64)

```javascript
// BookmarkNode.metadata is:
// { title?: string, description?: string, image?: string }
// where:
//   title       = og:title meta content
//   description = og:description OR meta[name="description"] content
//   image       = og:image content
// metadata is ONLY set on nodes that received a GET response (not HEAD-only)
// For HEAD-only successes: node.metadata is ABSENT (undefined, not null)
```

### Existing export priority chain (src/routes/export.js, line 12)

```javascript
// BEFORE Phase 4:
const html = exportToNetscape(session.checkedTree ?? session.cleanTree ?? session.tree);

// AFTER Phase 4 (D-11):
const html = exportToNetscape(session.classifiedTree ?? session.checkedTree ?? session.cleanTree ?? session.tree);
```

### Existing session singleton extension point (src/session.js, line 14)

```javascript
// BEFORE Phase 4:
const session = { tree: null, originalHtml: null, cleanTree: null, checkedTree: null, mergeCandidates: [], duplicateSubtrees: [] };

// AFTER Phase 4 (D-10):
const session = { tree: null, originalHtml: null, cleanTree: null, checkedTree: null, mergeCandidates: [], duplicateSubtrees: [], classifiedTree: null };
```

### Alpine state additions (public/app.js)

```javascript
// Add to bookmarkApp data object:
classifiedTree: null,
isClassifying: false,

// New method:
async classifyBookmarks() {
  this.isClassifying = true;
  this.errorMsg = '';
  try {
    const res = await fetch('/api/classify', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Classification failed');
    }
    const data = await res.json();
    this.classifiedTree = data.classifiedTree;
    // Render classified tree in the tree container
    this.$nextTick(() => {
      const container = this.$refs.treeContainer;
      if (!container) return;
      container.innerHTML = '';
      renderTree(this.classifiedTree, container, 0, {});
    });
  } catch (err) {
    this.errorMsg = 'Classification failed — ' + (err.message || 'unknown error');
  } finally {
    this.isClassifying = false;
  }
},
```

### Node.js built-in test runner pattern (from test/dedup.test.js)

```javascript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { classifyByDomain, classifyByMetadata, classifyNode } from '../src/classifier.js';

describe('classifyByDomain', () => {
  it('returns Development for github.com', () => {
    assert.equal(classifyByDomain('https://github.com/foo'), 'Development');
  });
  it('returns Development for www.github.com (strips www)', () => {
    assert.equal(classifyByDomain('https://www.github.com/foo'), 'Development');
  });
  it('returns null for unknown domain', () => {
    assert.equal(classifyByDomain('https://obscure-site-12345.com'), null);
  });
  it('returns null for malformed URL', () => {
    assert.equal(classifyByDomain('not-a-url'), null);
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Predefined fixed taxonomy imposed on all users | Taxonomy derived from actual collection (empty categories dropped) | Phase 4 design | Avoids "Finance" folder appearing when user has zero finance bookmarks |
| Third-party bookmark classifiers (bookmarks-parser, etc.) | Built-in domain rules + OG metadata | Phase 4 design (+ CLAUDE.md) | No unmaintained dependency; full control over classification logic |

**Deprecated/outdated:**
- `bookmarks-parser` npm package: inactive maintenance, per CLAUDE.md — do not use.
- uClassify URL API: deprecated per provider's own docs — do not use even as fallback in Phase 4.

---

## Open Questions

1. **Upload route reset for `classifiedTree`**
   - What we know: `src/routes/upload.js` was written in Phase 1 and resets known session fields.
   - What's unclear: Does it reset ALL session fields via object reassignment, or does it reset individual named fields? If named fields, `classifiedTree` needs to be added to the reset list.
   - Recommendation: Read `src/routes/upload.js` in Wave 0 before adding `classifiedTree` to the session, and add it to the reset explicitly.

2. **Sub-category granularity (Claude's discretion)**
   - What we know: D-07 says sub-categories emerge from the collection via simple keyword matching. D-09 says single-bookmark categories are kept.
   - What's unclear: How many bookmarks are needed before a sub-category makes sense? A threshold of ~5 per sub-category avoids creating folders with 1–2 items.
   - Recommendation: For v1, skip sub-categorisation entirely (implement `buildSubCategories` as a pass-through that returns links flat). Phase 5 lets the user organise manually. This satisfies STRUCT-01 and STRUCT-02 without taxonomy explosion risk.

3. **`classifiedTree` persistence vs. recompute (Claude's discretion)**
   - What we know: D-10 stores `classifiedTree` in the session. D-15 says each `POST /classify` call writes to it.
   - What's unclear: Should `POST /classify` be idempotent (always recomputes from `checkedTree`)? Yes — there's no user-editable state in `classifiedTree` until Phase 5.
   - Recommendation: Always recompute on each `POST /classify` call. Session persistence is just for the export route fallback chain.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 4 is purely in-memory data transformation. No external tools, services, databases, or CLIs are required beyond the already-running Node.js >=20 environment confirmed by Phase 1.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | None — test command in `package.json` scripts |
| Quick run command | `node --test test/classifier.test.js test/hierarchyBuilder.test.js` |
| Full suite command | `node --test test/**/*.test.js` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLASS-01 | `classifyByDomain('https://github.com/foo')` → `'Development'` | unit | `node --test test/classifier.test.js` | Wave 0 |
| CLASS-01 | `classifyByDomain('https://www.youtube.com/watch?v=abc')` → `'Video'` (www strip) | unit | `node --test test/classifier.test.js` | Wave 0 |
| CLASS-01 | `classifyByDomain('https://unknown.com')` → `null` | unit | `node --test test/classifier.test.js` | Wave 0 |
| CLASS-02 | `classifyByMetadata({title:'GitHub Actions Tutorial'})` → `'Development'` | unit | `node --test test/classifier.test.js` | Wave 0 |
| CLASS-02 | `classifyByMetadata(undefined)` → `null` (absent metadata graceful degradation) | unit | `node --test test/classifier.test.js` | Wave 0 |
| CLASS-02 | `classifyNode` with no domain match + metadata → uses metadata result | unit | `node --test test/classifier.test.js` | Wave 0 |
| CLASS-02 | `classifyNode` with no domain match + no metadata → `'Other'` | unit | `node --test test/classifier.test.js` | Wave 0 |
| STRUCT-01 | `buildHierarchy` output has max depth 3 | unit | `node --test test/hierarchyBuilder.test.js` | Wave 0 |
| STRUCT-01 | `buildHierarchy` returns valid `BookmarkNode` tree with all links present | unit | `node --test test/hierarchyBuilder.test.js` | Wave 0 |
| STRUCT-02 | `buildHierarchy` drops categories with 0 members | unit | `node --test test/hierarchyBuilder.test.js` | Wave 0 |
| STRUCT-02 | `buildHierarchy` with all bookmarks in one category → 1 top-level folder only | unit | `node --test test/hierarchyBuilder.test.js` | Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test test/classifier.test.js test/hierarchyBuilder.test.js`
- **Per wave merge:** `node --test test/**/*.test.js`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/classifier.test.js` — covers CLASS-01 and CLASS-02 (per D-16, TDD first)
- [ ] `test/hierarchyBuilder.test.js` — covers STRUCT-01 and STRUCT-02 (per D-16, TDD first)

*(No framework install needed — `node:test` is built-in. No shared fixture file needed — test data is constructed inline.)*

---

## Project Constraints (from CLAUDE.md)

All directives below are locked. Planner must verify each is respected in every task.

| Directive | Impact on Phase 4 |
|-----------|-------------------|
| Node.js >=20 backend + browser frontend, no framework lock-in | No new frameworks; `node:test` for tests |
| No API key required for core flow | Domain rules + OG metadata covers classification; no external API calls |
| Max folder depth 3 levels | Hard cap enforced in `hierarchyBuilder.js`; not a guideline |
| Self-contained — no data leaves machine except URL health checks | Phase 4 has zero network I/O — compliant by design |
| ESM throughout: `"type": "module"` in `package.json` | All new files use `import`/`export`; no `require()` |
| Do not use `bookmarks-parser` or `node-bookmarks-parser` npm packages | Not relevant to Phase 4 |
| Do not use uClassify URL API | Not relevant to Phase 4 (deferred to v2 CLASS-04) |
| Do not use React / Vue / Svelte / build tools | Alpine.js CDN for UI additions; no build step |
| Do not use jQuery / jsTree | Not relevant to Phase 4 |
| `fastest-levenshtein` for folder name similarity | Not needed for Phase 4 (fuzzy merge was Phase 2) |
| GSD workflow enforcement: start work through GSD command | N/A (this is the research phase) |

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `src/shared/types.js`, `src/session.js`, `src/routes/export.js`, `src/linkChecker.js`, `server.js`, `public/app.js` — all read directly
- `test/dedup.test.js`, `test/linkChecker.test.js` — test patterns confirmed
- `package.json` — confirmed `node:test` runner, `"type": "module"`, no test framework installed
- `04-CONTEXT.md` — all decisions read and reflected verbatim

### Secondary (MEDIUM confidence)

- CLAUDE.md — project constraint list read and cross-referenced against phase design
- `.planning/REQUIREMENTS.md` — CLASS-01, CLASS-02, STRUCT-01, STRUCT-02 acceptance criteria confirmed

### Tertiary (LOW confidence)

- None — all findings grounded in direct code inspection or CONTEXT.md locked decisions.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed; no new dependencies
- Architecture: HIGH — all patterns are direct analogues of established Phase 1–3 patterns in the codebase
- Pitfalls: HIGH — www-prefix and session mutation pitfalls derived from direct code inspection; OG greedy-matching is a common implementation issue

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (90 days — stable domain; no third-party packages to go stale)
