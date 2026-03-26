# Phase 7: Sub-Categorisation - Research

**Researched:** 2026-03-26
**Domain:** Node.js tree manipulation, deterministic ID schemes, bookmark hierarchy restructuring
**Confidence:** HIGH

## Summary

This phase is a pure refactor of `src/hierarchyBuilder.js` with supporting changes to `src/shared/treeOps.js` and `src/routes/edit.js`. No new libraries are required. All decisions are locked in CONTEXT.md, leaving only implementation detail choices to discretion. The codebase is well-understood from prior phases — every integration point has been explicitly mapped.

The two technical challenges are: (1) replacing `crypto.randomUUID()` with a collision-safe deterministic slug scheme, and (2) inserting a sub-folder split step into `buildHierarchy`'s group-by-category pipeline without breaking the existing tree structure guarantees. Both are well-scoped code edits with clear entry points and existing test helpers to build on.

The existing `maxDepth` helper in `test/hierarchyBuilder.test.js` already asserts depth = 2 (root→category→link). After sub-categorisation, the test must assert depth = 3 (root→category→sub-folder→link) as the new maximum, but the max-depth invariant itself is unchanged — just the expected value shifts from 2 to 3.

**Primary recommendation:** Work in three sequential steps — (1) deterministic IDs first (HIER-01), (2) sub-folder split with Development taxonomy (HIER-02 through HIER-05), (3) pruneEmptyFolders + depth-cap test updates (HIER-06). Each step has a clear test target.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Node ID Strategy (HIER-01)**
- D-01: Change `crypto.randomUUID()` folder IDs in `buildHierarchy` (lines 63, 71 of `src/hierarchyBuilder.js`) to deterministic IDs derived from the category title — a stable slug such as `folder-development`.
- D-02: Handle slug collisions with a counter suffix (e.g. `folder-development-2`) OR prefer a hash of the full path from root.
- D-03: Edit operations in `src/routes/edit.js` find nodes by `id` via tree-walk — deterministic folder IDs ensure `targetFolderId` from a previous render remains valid after a classify re-run.

**Sub-Categorisation Placement (HIER-02, HIER-03, HIER-04, HIER-05)**
- D-04: Sub-folder logic lives entirely inside `buildHierarchy`. After grouping by top-level category, if a group's link count exceeds `SUBCATEGORY_THRESHOLD` (default 20), split into sub-folders.
- D-05: `classifier.js` is NOT modified. Sub-categorisation is purely structural.
- D-06: Sub-taxonomy for Development only: Frontend, Backend, DevOps/Cloud, Tools, Learning, AI/ML. Other categories exceeding threshold get an "Other" sub-folder for unmatched links.
- D-07: AI/ML sub-category explicitly covers openai.com, huggingface.co, etc. (already classified as Development by classifier.js).
- D-08: `SUBCATEGORY_THRESHOLD` (default 20) and `SUBCATEGORY_MIN_COVERAGE_RATIO` (default 0.6) are named constants in `hierarchyBuilder.js`, not hardcoded inline.
- D-09: Sub-taxonomy domain-to-sub-category mapping lives in `hierarchyBuilder.js`, not in `classifier.js`.

**Depth Cap and Empty Folder Pruning (HIER-06)**
- D-10: Depth cap by design: max 3 levels — root → category → sub-category → links as leaves.
- D-11: `pruneEmptyFolders(tree)` utility in `src/shared/treeOps.js`, called from `src/routes/edit.js` after every mutation.
- D-12: `src/exporter.js` is NOT modified.

**Test Coverage (HIER-06)**
- D-13: New tests in `test/hierarchyBuilder.test.js` covering: sub-folder creation, AI/ML sub-categorisation, depth cap (max = 3), and SUBCATEGORY_MIN_COVERAGE_RATIO skip behaviour.
- D-14: New test in `test/exporter.test.js` for "no empty `<DL>` blocks" round-trip assertion.
- D-15: Use existing `node:test` + `node:assert/strict` pattern.

**Hyphen-prefix folder rule (from Phase 6)**
- D-05 to D-07 in Phase 6: folders whose name starts with `-` are preserved as top-level folders. `buildHierarchy` must NOT apply sub-categorisation to these folders.

### Claude's Discretion

- Exact domain-to-sub-category mapping for the Development sub-taxonomy (which domains map to Frontend vs Backend vs Tools etc.)
- Whether sub-taxonomy mapping is a `Map`, plain object, or switch statement inside `buildHierarchy`
- The precise slug/hash algorithm for deterministic IDs, as long as collisions are handled
- Whether `pruneEmptyFolders` is called on every edit mutation or only before export (edit pipeline preferred per D-11, but timing is open)

### Deferred Ideas (OUT OF SCOPE)

- Sub-taxonomies beyond Development (Design, Finance, Shopping, News sub-folders)
- User-defined category rules (custom domain → category mappings)
- `SUBCATEGORY_MIN_COVERAGE_RATIO` tuning against a real collection — expose constant and tune during execution
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HIER-01 | `buildHierarchy` uses deterministic node IDs (not `crypto.randomUUID()`) so edit operations survive hierarchy rebuilds | Replace lines 63 and 71 in hierarchyBuilder.js; slug from title; collision counter or path hash |
| HIER-02 | Sub-folders created automatically when a top-level category exceeds the configured link threshold (default: 20) | Insert split step after group-by-category loop; guarded by SUBCATEGORY_MIN_COVERAGE_RATIO |
| HIER-03 | Predefined sub-taxonomy for Development: Frontend, Backend, DevOps/Cloud, Tools, Learning, AI/ML | Local constant map in hierarchyBuilder.js; domain-to-sub-category lookup per link URL |
| HIER-04 | AI/ML is a recognised sub-category of Development (covering openai.com, huggingface.co, etc.) | openai.com and huggingface.co already in DOMAIN_RULES → Development; redistribution targets AI/ML sub-folder |
| HIER-05 | Threshold is a named constant in `hierarchyBuilder.js` (not hardcoded inline) | `SUBCATEGORY_THRESHOLD = 20` and `SUBCATEGORY_MIN_COVERAGE_RATIO = 0.6` at top of file |
| HIER-06 | Folder depth capped at 3 levels; round-trip tests assert max depth and no empty `<DL>` blocks in export | pruneEmptyFolders in treeOps.js; update maxDepth assertion; exporter round-trip test |
</phase_requirements>

---

## Standard Stack

### Core (no new dependencies — all built-in to existing project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `crypto` | built-in | Hash generation for deterministic IDs | `crypto.createHash('sha1')` produces a stable hex string from a path string; already imported indirectly via existing crypto.randomUUID() usage |
| `node:test` + `node:assert/strict` | built-in (Node 18+) | Test framework | Matches all existing test files in the project |
| `fastest-levenshtein` | 1.0.16 | Already used in classifier for fuzzy matching | Not needed for this phase — sub-taxonomy is domain-lookup, not fuzzy match |

**No new npm packages are needed for this phase.**

**Current Node.js on this machine:** v24.14.0 (above the >=20 minimum). All features available.

**Test command (existing):**
```bash
node --test test/**/*.test.js
```

**Per-file test command:**
```bash
node --test test/hierarchyBuilder.test.js
node --test test/exporter.test.js
```

---

## Architecture Patterns

### Existing buildHierarchy Pipeline (src/hierarchyBuilder.js)

Current flow (verified by reading source):
```
collectLinks(classifiedTree)          // flatten all links recursively
  → group by link.category → Map      // byCategory Map<string, BookmarkNode[]>
  → sort alphabetically
  → map each [cat, catLinks] to folder node with crypto.randomUUID() id
  → return root node with crypto.randomUUID() id
```

Phase 7 inserts a sub-folder step between "group by category" and "build folder nodes":

```
collectLinks(classifiedTree)
  → group by link.category → Map (byCategory)
  → [NEW] for each group: if count > SUBCATEGORY_THRESHOLD
      → attempt split using DEVELOPMENT_SUBTAXONOMY map
      → if coverage >= SUBCATEGORY_MIN_COVERAGE_RATIO: build sub-folders
      → else: keep links flat in category folder
  → build folder nodes with deterministic IDs (slug from title)
  → return root with deterministic ID ('folder-root')
```

### Pattern 1: Deterministic Slug IDs

**What:** Replace `crypto.randomUUID()` with a slug derived from the folder title, with collision handling.

**When to use:** Every folder node created in `buildHierarchy`.

**Simple slug approach (recommended for this project):**
```javascript
// Source: project conventions — no external library needed
function toFolderSlug(title) {
  return 'folder-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
// 'Development' → 'folder-development'
// 'AI/ML' → 'folder-ai-ml'
// 'DevOps/Cloud' → 'folder-devops-cloud'
// 'Social / Community' → 'folder-social-community'
// 'root' → 'folder-root'
```

For sub-folders, include parent to guarantee uniqueness:
```javascript
// 'Development' > 'Frontend' → 'folder-development-frontend'
// 'Development' > 'AI/ML' → 'folder-development-ai-ml'
```

This approach is collision-free for the known taxonomy (10 top-level categories + 6 Development sub-categories). No counter or hash needed because the taxonomy is predefined and there are no two folders with identical titles at the same depth.

**Why this matters (D-03):** After `buildHierarchy` runs, the frontend sends edit ops via `/edit` with `targetFolderId`. With `crypto.randomUUID()`, every classify re-run regenerates IDs — any saved `targetFolderId` silently fails the `findNodeById` tree walk. Deterministic slugs fix this.

**Test change required:** The existing test at line 139–146 (`category folder ids are valid UUIDs`) asserts UUID format. This test MUST be updated to assert the new slug format instead.

### Pattern 2: Sub-Folder Split Inside buildHierarchy

**What:** After grouping links by category, split large groups into sub-folders using a domain-to-sub-category map.

**When to use:** Only when `catLinks.length > SUBCATEGORY_THRESHOLD` AND the category has a defined sub-taxonomy (Development). Other categories that exceed threshold get a flat structure (no sub-folders) because only Development has a sub-taxonomy defined in this phase.

**SUBCATEGORY_MIN_COVERAGE_RATIO guard:**
```javascript
// Before committing to sub-folders for a category:
// - Assign each link to a sub-category (or 'Other' if no match)
// - Count non-'Other' assignments
// - If (nonOtherCount / totalCount) < SUBCATEGORY_MIN_COVERAGE_RATIO → skip sub-splitting, keep flat
```

**Hyphen-prefix guard (from Phase 6 D-05 to D-07):**
```javascript
// In buildHierarchy, when building category folders:
// If a preserved folder name starts with '-', DO NOT sub-split it.
// These arrive as top-level category folders from classifyTree and must stay flat.
```

Note: Hyphen-prefix folders are preserved by classifyTree with their original name as the `category` on links. `buildHierarchy` groups them into a folder with that hyphen-prefix name. The guard is: if `cat.startsWith('-')`, skip sub-splitting regardless of link count.

### Pattern 3: Development Sub-Taxonomy Map

**What:** A constant map from hostname → Development sub-category, defined in `hierarchyBuilder.js`.

**Structure (recommended — plain object for consistency with DOMAIN_RULES in classifier.js):**

```javascript
// Source: researched from DOMAIN_RULES entries already in src/classifier.js
const DEVELOPMENT_SUBTAXONOMY = {
  // Frontend
  'angular.io':          'Frontend',
  'vuejs.org':           'Frontend',
  'reactjs.org':         'Frontend',
  'svelte.dev':          'Frontend',
  'nextjs.org':          'Frontend',
  'nuxt.com':            'Frontend',
  'webpack.js.org':      'Frontend',
  'vitejs.dev':          'Frontend',
  'storybook.js.org':    'Frontend',
  'tailwindcss.com':     'Frontend',   // NOTE: also in Design — Development context wins at this stage
  'codepen.io':          'Frontend',
  'jsfiddle.net':        'Frontend',
  'codesandbox.io':      'Frontend',

  // Backend
  'spring.io':           'Backend',
  'rust-lang.org':       'Backend',
  'go.dev':              'Backend',
  'elixir-lang.org':     'Backend',
  'ruby-lang.org':       'Backend',
  'php.net':             'Backend',
  'deno.land':           'Backend',
  'bun.sh':              'Backend',
  'node.js.org':         'Backend',
  'fastapi.tiangolo.com': 'Backend',
  'expressjs.com':       'Backend',

  // DevOps/Cloud
  'docker.com':          'DevOps/Cloud',
  'hub.docker.com':      'DevOps/Cloud',
  'kubernetes.io':       'DevOps/Cloud',
  'aws.amazon.com':      'DevOps/Cloud',
  'cloud.google.com':    'DevOps/Cloud',
  'azure.microsoft.com': 'DevOps/Cloud',
  'digitalocean.com':    'DevOps/Cloud',
  'terraform.io':        'DevOps/Cloud',
  'heroku.com':          'DevOps/Cloud',
  'vercel.com':          'DevOps/Cloud',
  'netlify.com':         'DevOps/Cloud',
  'nginx.org':           'DevOps/Cloud',
  'apache.org':          'DevOps/Cloud',

  // Tools (dev tooling, not the 'Tools' top-level category)
  'github.com':          'Tools',
  'gitlab.com':          'Tools',
  'bitbucket.org':       'Tools',
  'stackoverflow.com':   'Tools',
  'stackexchange.com':   'Tools',
  'npmjs.com':           'Tools',
  'pypi.org':            'Tools',
  'crates.io':           'Tools',
  'replit.com':          'Tools',
  'devdocs.io':          'Tools',
  'regex101.com':        'Tools',
  'typescriptlang.org':  'Tools',
  'eslint.org':          'Tools',
  'prettier.io':         'Tools',
  'jestjs.io':           'Tools',
  'vitest.dev':          'Tools',
  'playwright.dev':      'Tools',
  'cypress.io':          'Tools',
  'git-scm.com':         'Tools',

  // Learning (dev learning, distinct from 'Learning' top-level category)
  'developer.mozilla.org': 'Learning',
  'docs.python.org':     'Learning',
  'docs.rs':             'Learning',
  'graphql.org':         'Learning',
  'pkg.go.dev':          'Learning',
  'rubygems.org':        'Learning',

  // AI/ML
  'openai.com':          'AI/ML',
  'huggingface.co':      'AI/ML',
  'anthropic.com':       'AI/ML',
  'deepmind.com':        'AI/ML',
  'mistral.ai':          'AI/ML',
  'replicate.com':       'AI/ML',
  'stability.ai':        'AI/ML',
  'cohere.com':          'AI/ML',
  'langchain.com':       'AI/ML',
};
```

The sub-taxonomy lookup uses URL hostname extraction (same pattern as `classifyByDomain`): strip `www.` prefix, look up in the map, return sub-category label or `null` (falls to 'Other' within Development).

### Pattern 4: pruneEmptyFolders in treeOps.js

**What:** A pure tree-walk that removes folder nodes with no children (after recursive pruning of their children).

**Pattern (follows deleteNode/moveNode conventions in treeOps.js):**
```javascript
// Source: mirrors pattern of existing deleteNode in src/shared/treeOps.js
export function pruneEmptyFolders(node) {
  if (node.type !== 'folder') return node;
  const prunedChildren = (node.children ?? [])
    .map(child => pruneEmptyFolders(child))
    .filter(child => child.type !== 'folder' || (child.children && child.children.length > 0));
  return { ...node, children: prunedChildren };
}
```

**Call site in edit.js:** After `deleteNode`, `moveNode`, or `markKeep`, before writing back to `session.classifiedTree`:
```javascript
session.classifiedTree = pruneEmptyFolders(updated);
```

### Anti-Patterns to Avoid

- **Calling pruneEmptyFolders inside buildHierarchy itself:** The sub-folder builder creates sub-folders only for links that exist — no empty folders are created there. pruneEmptyFolders is needed only to clean up after user deletes. Putting it in buildHierarchy adds unnecessary work on every classify re-run.
- **Modifying classifier.js for sub-taxonomy:** D-05 is locked — sub-categorisation is a structural step only. classifier.js returns a category string; buildHierarchy redistributes within that category.
- **Using random UUIDs for sub-folder IDs:** Sub-folders get deterministic slugs too (e.g. `folder-development-frontend`), not just top-level category folders. Otherwise re-run still silently breaks move ops targeting sub-folders.
- **Sub-splitting hyphen-prefix folders:** These are organisational markers (Phase 6 D-05). The guard must check `cat.startsWith('-')` before applying the threshold check.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hostname extraction for sub-taxonomy lookup | Custom URL parser | `new URL(link.url).hostname.replace(/^www\./, '')` | Already the pattern in classifyByDomain; one-liner built-in |
| Unique sub-folder IDs | UUID or random suffix | Slug from `${parentSlug}-${subCategorySlug}` | Paths are unique by definition since taxonomy has no duplicate sub-category names |
| Empty folder removal | Manual tree rebuilds | `pruneEmptyFolders` pure tree walk | 10-line recursive filter, same pattern as deleteNode already in treeOps.js |

---

## Common Pitfalls

### Pitfall 1: UUID Test Assertion Must Be Updated

**What goes wrong:** `test/hierarchyBuilder.test.js` line 139–146 asserts `result.children[0].id` matches a UUID regex. After the ID change, this test will fail.

**Why it happens:** The test was written when `crypto.randomUUID()` was the implementation.

**How to avoid:** Update the assertion to check slug format (e.g. starts with `folder-`, no uppercase, no UUID pattern). The TDD approach (D-13 in CONTEXT.md) means writing the new assertion first.

**Warning signs:** If you run tests after changing ID generation without updating the UUID assertion, you get a confusing failure that looks like the ID is wrong format rather than "test needs updating."

### Pitfall 2: Depth Assertion Value Change

**What goes wrong:** `test/hierarchyBuilder.test.js` line 79–86 asserts `maxDepth(result) === 2`. After sub-folders are added, a Development folder with 21+ links will have sub-folders, pushing max depth to 3. The test input uses only 2 links across 2 categories — it will still pass because neither category exceeds the threshold of 20. But any new test using 21+ Development links will produce depth 3.

**Why it happens:** The existing test has < 20 links, so sub-splitting never triggers. The assertion value of 2 is correct for that test input.

**How to avoid:** Add a separate test that explicitly creates 21+ Development links and asserts `maxDepth === 3`. Do NOT change the existing depth-2 test — it remains correct (categories with < 20 links stay flat).

### Pitfall 3: SUBCATEGORY_MIN_COVERAGE_RATIO Skip Logic

**What goes wrong:** If a large Development category has mostly domains not in DEVELOPMENT_SUBTAXONOMY, sub-splitting produces a massive "Other" sub-folder and 5 tiny named sub-folders — worse than the flat layout.

**Why it happens:** The domain map in DEVELOPMENT_SUBTAXONOMY only covers known domains. Personal bookmarks for obscure dev tools won't match.

**How to avoid:** Implement the coverage ratio guard. If fewer than 60% of links get a named sub-category, skip sub-splitting for that group and keep links flat under the category folder. The constant is `SUBCATEGORY_MIN_COVERAGE_RATIO = 0.6`.

**Warning signs:** Sub-folder "Other" contains more than half the links in a category — the ratio guard should have prevented this.

### Pitfall 4: Sub-Taxonomy 'Tools' Name Conflict

**What goes wrong:** DEVELOPMENT_SUBTAXONOMY uses 'Tools' as a Development sub-category label. There is also a top-level category called 'Tools'. These are different things. If a link is in the Development category and sub-categorises to 'Tools', its parent is the Development folder — not the top-level Tools category. No actual conflict exists in the data model, but tests must be labelled clearly.

**Why it happens:** The sub-taxonomy label 'Tools' (dev tooling: GitHub, npm, etc.) reuses a top-level category name by coincidence.

**How to avoid:** In tests, always traverse from the root to verify: `root → Development → Tools` vs `root → Tools`. Never assert by title alone when checking sub-folder content.

### Pitfall 5: Empty DL Blocks in Export After Delete

**What goes wrong:** User deletes the last bookmark in a sub-folder. Sub-folder becomes empty. Exporter serialises it as `<DT><H3>Frontend</H3>\n<DL><p>\n\n</DL><p>`. Chrome import handles this, but it creates noise. REQUIREMENTS.md HIER-06 explicitly forbids this.

**Why it happens:** `exporter.js` serialises whatever it receives unconditionally (confirmed by reading source — no pruning logic exists there, by design per D-12).

**How to avoid:** `pruneEmptyFolders` must be called in the edit route after every mutation. The exporter should never receive empty folder nodes. The round-trip test in `test/exporter.test.js` verifies this by passing a tree with an empty folder and asserting no `<DL><p>\n</DL>` pattern in the output after pruning.

---

## Code Examples

### Deterministic Slug Generation

```javascript
// Source: project conventions, built-in string methods only
function toFolderSlug(pathSegments) {
  // pathSegments: ['development'] for top-level, ['development', 'frontend'] for sub-folder
  return 'folder-' + pathSegments
    .map(s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .join('-');
}
// toFolderSlug(['root'])                     → 'folder-root'
// toFolderSlug(['development'])              → 'folder-development'
// toFolderSlug(['development', 'frontend'])  → 'folder-development-frontend'
// toFolderSlug(['development', 'ai/ml'])     → 'folder-development-ai-ml'
// toFolderSlug(['social / community'])       → 'folder-social-community'
```

### buildHierarchy with Sub-Folder Split (pseudocode)

```javascript
// Source: derived from existing buildHierarchy in src/hierarchyBuilder.js
export const SUBCATEGORY_THRESHOLD = 20;
export const SUBCATEGORY_MIN_COVERAGE_RATIO = 0.6;

export function buildHierarchy(classifiedTree) {
  const links = collectLinks(classifiedTree);

  const byCategory = new Map();
  for (const link of links) {
    const cat = link.category ?? 'Other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(link);
  }

  const categoryFolders = [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, catLinks]) => {
      const catId = toFolderSlug([cat]);
      const children = maybeSplitIntoSubfolders(cat, catLinks, catId);
      return { id: catId, type: 'folder', title: cat, children };
    });

  return { id: 'folder-root', type: 'folder', title: 'root', children: categoryFolders };
}

function maybeSplitIntoSubfolders(cat, links, parentSlug) {
  // Guard: hyphen-prefix folders never split
  if (cat.startsWith('-')) return links;
  // Guard: threshold
  if (links.length <= SUBCATEGORY_THRESHOLD) return links;
  // Guard: only Development has a sub-taxonomy defined in this phase
  if (cat !== 'Development') return links;

  // Assign each link to a sub-category
  const subGroups = new Map();
  let namedCount = 0;
  for (const link of links) {
    const sub = lookupDevSubcategory(link.url); // returns sub-label or null
    const label = sub ?? 'Other';
    if (sub) namedCount++;
    if (!subGroups.has(label)) subGroups.set(label, []);
    subGroups.get(label).push(link);
  }

  // Coverage guard
  if (namedCount / links.length < SUBCATEGORY_MIN_COVERAGE_RATIO) return links;

  // Build sub-folder nodes (omit 'Other' if empty)
  return [...subGroups.entries()]
    .filter(([, subLinks]) => subLinks.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sub, subLinks]) => ({
      id: toFolderSlug([cat, sub]),
      type: 'folder',
      title: sub,
      children: subLinks,
    }));
}
```

### pruneEmptyFolders (treeOps.js addition)

```javascript
// Source: mirrors deleteNode pattern in src/shared/treeOps.js
export function pruneEmptyFolders(node) {
  if (node.type !== 'folder') return node;
  const prunedChildren = (node.children ?? [])
    .map(child => pruneEmptyFolders(child))
    .filter(child => child.type !== 'folder' || (child.children && child.children.length > 0));
  return { ...node, children: prunedChildren };
}
```

### edit.js — pruneEmptyFolders call site

```javascript
// Source: src/routes/edit.js — add pruneEmptyFolders import and call
import { deleteNode, moveNode, markKeep, pruneEmptyFolders } from '../shared/treeOps.js';

// After each mutation:
session.classifiedTree = pruneEmptyFolders(updated);
```

### Empty-DL Round-Trip Test (exporter.test.js addition)

```javascript
// Source: follows existing test patterns in test/exporter.test.js
test('no empty DL blocks after exporting a tree with empty folder nodes', () => {
  const tree = makeFolder('root', [
    makeFolder('Development', [
      makeFolder('Frontend', []),  // empty sub-folder — should be pruned before export
    ]),
    makeLink('GitHub', 'https://github.com/'),
  ]);
  // NOTE: The test must apply pruneEmptyFolders before calling exportToNetscape,
  // mirroring the production flow (edit route prunes, exporter serialises result).
  const pruned = pruneEmptyFolders(tree);
  const html = exportToNetscape(pruned);
  // Pattern: an empty DL block is <DL><p> followed by whitespace then </DL><p>
  const emptyDL = /<DL><p>\s*<\/DL><p>/;
  assert.ok(!emptyDL.test(html), 'No empty DL blocks should appear in export');
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `crypto.randomUUID()` folder IDs | Deterministic slug IDs | Phase 7 | Edit ops survive classify re-runs |
| Flat category folders (root→cat→link) | Category→sub-folder→link for large groups | Phase 7 | Navigable hierarchy at 3 levels |
| No empty folder cleanup | `pruneEmptyFolders` in edit pipeline | Phase 7 | HIER-06 compliant export |

---

## Open Questions

1. **Sub-taxonomy for non-Development categories that exceed threshold**
   - What we know: D-06 says only Development has a sub-taxonomy in this phase. Other categories over threshold remain flat.
   - What's unclear: Should a 25-link "Video" category silently stay flat, or should the UI or logs hint that it would benefit from a sub-taxonomy?
   - Recommendation: Stay flat and silent — no UI changes in this phase. The concern is noted in STATE.md blockers; nothing actionable in Phase 7.

2. **tailwindcss.com sub-taxonomy placement**
   - What we know: `tailwindcss.com` appears in both `DOMAIN_RULES` as Development AND in the Design category via direct DOMAIN_RULES entry. In DOMAIN_RULES it maps to Development. So bookmarks to tailwindcss.com arrive in buildHierarchy with `category = 'Development'`.
   - What's unclear: Should it map to Frontend or Tools within Development?
   - Recommendation: Map to 'Frontend' since Tailwind is a CSS framework used on the frontend. This is Claude's discretion per CONTEXT.md.

3. **Sub-folder ID for 'Social / Community' slug**
   - What we know: `toFolderSlug(['social / community'])` → `'folder-social-community'`. The slash and spaces collapse cleanly.
   - What's unclear: No ambiguity — confirmed by tracing the regex.
   - Recommendation: No action needed.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/config changes within the existing Node.js project. No external tools, services, databases, or CLI utilities beyond the already-confirmed Node.js v24.14.0 runtime are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` (built-in, Node 18+) |
| Config file | none — test runner invoked directly |
| Quick run command | `node --test test/hierarchyBuilder.test.js test/exporter.test.js` |
| Full suite command | `node --test test/**/*.test.js` |

### Phase Requirements to Test Map

| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| HIER-01 | Folder IDs are deterministic slugs, not UUIDs | unit | `node --test test/hierarchyBuilder.test.js` | Existing file; UUID assertion needs updating |
| HIER-01 | Same classify run produces identical IDs | unit | `node --test test/hierarchyBuilder.test.js` | Wave 0 gap — new test needed |
| HIER-02 | Category with > 20 links gains sub-folders | unit | `node --test test/hierarchyBuilder.test.js` | Wave 0 gap — new test needed |
| HIER-02 | Category with <= 20 links stays flat | unit | `node --test test/hierarchyBuilder.test.js` | Wave 0 gap — new test needed |
| HIER-03 | Development links route to correct sub-folder (Frontend/Backend/etc.) | unit | `node --test test/hierarchyBuilder.test.js` | Wave 0 gap — new test needed |
| HIER-04 | openai.com / huggingface.co land in AI/ML sub-folder | unit | `node --test test/hierarchyBuilder.test.js` | Wave 0 gap — new test needed |
| HIER-05 | SUBCATEGORY_THRESHOLD constant exported and used | unit | `node --test test/hierarchyBuilder.test.js` | Wave 0 gap — verify by import |
| HIER-06 (depth cap) | Max depth of result tree is 3 after sub-split | unit | `node --test test/hierarchyBuilder.test.js` | Existing maxDepth test — update expected value for sub-split case |
| HIER-06 (empty DL) | No empty `<DL>` blocks in exported HTML | unit | `node --test test/exporter.test.js` | Wave 0 gap — new test needed |
| HIER-06 (prune) | pruneEmptyFolders removes empty folder nodes | unit | `node --test test/hierarchyBuilder.test.js` (or separate treeOps test) | Wave 0 gap — new test needed |
| HIER-06 (min coverage) | Category stays flat when coverage < 0.6 | unit | `node --test test/hierarchyBuilder.test.js` | Wave 0 gap — new test needed |

### Sampling Rate

- **Per task commit:** `node --test test/hierarchyBuilder.test.js`
- **Per wave merge:** `node --test test/**/*.test.js`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Update UUID assertion in `test/hierarchyBuilder.test.js` line 139–146 to assert slug format
- [ ] Add test: deterministic IDs — same input produces same output IDs on two calls
- [ ] Add test: 21 Development links → sub-folders created
- [ ] Add test: 19 Development links → stays flat (below threshold)
- [ ] Add test: Development links → correct sub-category routing (Frontend, Backend, DevOps/Cloud, Tools, Learning, AI/ML)
- [ ] Add test: openai.com and huggingface.co → AI/ML sub-folder
- [ ] Add test: SUBCATEGORY_MIN_COVERAGE_RATIO = 0.6 skip behaviour (mostly unrecognised domains → stays flat)
- [ ] Add test: maxDepth assertion for sub-split case (expected 3, not 2)
- [ ] Add test: `pruneEmptyFolders` removes empty folder node
- [ ] Add test: `pruneEmptyFolders` preserves non-empty siblings
- [ ] Add test in `test/exporter.test.js`: no empty `<DL><p>` pattern after pruning

---

## Sources

### Primary (HIGH confidence)

- Direct file read: `src/hierarchyBuilder.js` — confirmed `crypto.randomUUID()` at lines 63, 71; confirmed buildHierarchy pipeline structure
- Direct file read: `src/shared/treeOps.js` — confirmed deleteNode/moveNode/markKeep pure function patterns; confirmed no findNodeById (used inline in moveNode)
- Direct file read: `src/routes/edit.js` — confirmed mutation pattern and session write-back location for pruneEmptyFolders call
- Direct file read: `src/classifier.js` — confirmed DOMAIN_RULES entries for Development category (openai.com, huggingface.co, angular.io, reactjs.org, etc.)
- Direct file read: `src/exporter.js` — confirmed unconditional children serialisation; no pruning; by design per D-12
- Direct file read: `test/hierarchyBuilder.test.js` — confirmed maxDepth helper at lines 19–22; depth assertion at lines 79–86 (asserts === 2); UUID assertion at lines 139–146
- Direct file read: `test/exporter.test.js` — confirmed no empty-DL test exists; confirmed test structure and helpers
- Direct file read: `.planning/config.json` — confirmed `nyquist_validation: true`
- Direct file read: `package.json` — confirmed `node --test test/**/*.test.js` command; Node.js >=20 requirement
- Runtime check: Node.js v24.14.0 confirmed installed

### Secondary (MEDIUM confidence)

- CONTEXT.md decisions D-01 through D-15 — locked decisions from /gsd:discuss-phase, treated as authoritative
- STATE.md accumulated decisions — corroborates CONTEXT.md for deterministic IDs and named constants

---

## Project Constraints (from CLAUDE.md)

All of the following apply to this phase:

| Directive | Impact on Phase 7 |
|-----------|-------------------|
| No framework lock-in; Node.js backend + browser frontend | No new libraries. All changes are in existing .js files. |
| No API key required for core flow | Sub-categorisation is domain-rules-only; no API calls |
| Folder depth max 3 levels | Enforced by design in buildHierarchy; depth cap is a phase requirement |
| Self-contained, all processing local | No external calls added |
| Alpine.js 3.x via CDN for frontend | No frontend changes in this phase |
| `node:test` + `node:assert/strict` for tests (inferred from existing pattern) | All new tests follow this pattern per D-15 |
| `"type": "module"` in package.json | All new code uses ESM import/export syntax |
| Node.js >=20 required | Node 24 confirmed on machine; no issue |
| TDD first (prior phases D-16, D-14) | Write tests before implementation |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; confirmed by package.json and file reads
- Architecture patterns: HIGH — derived directly from reading source files
- Pitfalls: HIGH — derived from existing test assertions and code structure
- Sub-taxonomy domain map: MEDIUM — assignments are Claude's discretion; reasonable but not verified against a real bookmark collection

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable — no external dependencies, no version-sensitive APIs)
