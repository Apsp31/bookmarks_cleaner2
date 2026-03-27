# Phase 6: Classification Quality - Research

**Researched:** 2026-03-24
**Domain:** JavaScript classifier logic, Alpine.js UI patterns, Node.js test framework
**Confidence:** HIGH

## Summary

Phase 6 is entirely within the existing codebase — no new libraries, no external services, no new infrastructure. Every deliverable is a targeted code edit to `src/classifier.js`, `src/routes/classify.js`, `public/app.js`, and `public/index.html`. The research task is therefore about understanding the current code's shape precisely so the planner can write accurate, non-conflicting tasks.

The classifier pipeline is a pure three-step chain: domain rules → OG metadata keywords → 'Other'. Phase 6 extends this to four steps by inserting a `classifyByPath(url)` function between metadata and 'Other'. The hyphen-prefix preservation work extends `classifyTree` to accept a `preservedFolders` set and tag matching links without classifying them. The UI toggle wires into the established `renderTree` options-object callback pattern.

The golden-file regression test is the load-bearing safety gate for this phase. It must be written and committed before any `CATEGORY_KEYWORDS` changes, because iteration order over the keywords object is load-bearing (Development checks 'github', 'api' before Tools checks 'tool', 'editor') and any keyword edit could silently reclassify previously-correct bookmarks. The test framework is Node.js built-in `node:test` — no external test runner is needed.

**Primary recommendation:** Write the golden-file test first (Wave 0), then expand DOMAIN_RULES, then add `classifyByPath`, then hyphen-folder preservation + UI toggle, then tighten CATEGORY_KEYWORDS last (because it is the highest-risk edit and needs the golden file to guard it).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Path & Subdomain Signal Mapping**
- D-01: Add URL-path hints as a 3rd fallback step (after domain rules AND metadata both fail): `/blog/`, `/news/` → News; `/docs/`, `/documentation/` → Reference; `/shop/`, `/store/` → Shopping; `/api/` → Development. Implemented as `classifyByPath(url)` in `classifier.js`.
- D-02: Add subdomain hints in the same step: `docs.*` → Reference; `blog.*` → News; `shop.*` → Shopping. Implemented as `classifyBySubdomain(url)` or folded into `classifyByPath`.
- D-03: No new top-level categories — all path/subdomain signals map to existing category labels.
- D-04: Pipeline order becomes: domain rules → OG/meta keywords → path/subdomain signals → 'Other'.

**Hyphen-Prefix Folder Preservation**
- D-05: Bookmarks whose source folder name starts with `-` are placed in a top-level folder with the original name in the classified hierarchy — they do NOT go through normal category classification.
- D-06: Preservation check happens in `classifyTree` or `buildHierarchy`: if a link's source folder name starts with `-`, the link is tagged with `category = originalFolderName`.
- D-07: The original folder name is preserved as-is, including the `-` prefix.
- D-08: The `classifyTree` call needs to know which source folder each link came from. The tree walk already traverses folder nodes; when entering a folder whose name starts with `-`, links inside are tagged rather than classified.

**Per-Folder Opt-In (CLASS-06)**
- D-09: Each hyphen-prefix folder in the left-panel tree (rendered during `status === 'checked'`) gets an inline toggle: a small `[↺ reclassify]` badge/button appended to the folder row by `renderTree` when it detects a `-`-prefixed folder name.
- D-10: Toggled folder IDs (or names) are tracked in Alpine state as a `Set` (e.g., `reclassifyFolders: new Set()`). The `renderTree` call in the checked state passes an `onToggleReclassify` callback.
- D-11: Default is preserved (not toggled) — user must explicitly opt in per folder.
- D-12: `POST /api/classify` request body includes a `reclassifyFolders` array of folder names opted in. The classify route passes this to `classifyTree` so opted-in folders go through normal classification instead of preservation.

**Domain Expansion & Keyword Precision**
- D-13: `DOMAIN_RULES` expanded from ~50 to ~300 entries. Broad coverage across all existing categories — Claude's discretion on which domains to add, proportional across categories.
- D-14: Golden-file regression test written BEFORE any `CATEGORY_KEYWORDS` changes.
- D-15: `CATEGORY_KEYWORDS` tightened by removing or narrowing overloaded terms (e.g., "app", "web"). Claude's discretion on exact terms — goal is fewer false positives, not fewer entries overall.

### Claude's Discretion
- Exact domain entries added to the ~300-entry DOMAIN_RULES map
- Whether `classifyByPath` and `classifyBySubdomain` are one function or two
- Exact path prefix list beyond the examples above
- Keyword terms to remove/narrow in CATEGORY_KEYWORDS
- Golden-file test fixture format (JSON snapshot of URL → category pairs)

### Deferred Ideas (OUT OF SCOPE)
- Sub-taxonomies beyond Development (Design, Finance, Shopping sub-folders) — Phase 7 or Future Requirements
- User-defined category rules (custom domain → category mappings) — Future Requirements
- NLP/ML classification — explicitly Out of Scope per REQUIREMENTS.md
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLASS-01 | Classifier uses an expanded `DOMAIN_RULES` map (~300 entries) covering more domains across all categories | DOMAIN_RULES is a plain JS object export in `classifier.js` — add ~250 entries following existing key format (bare hostname, no www.) |
| CLASS-02 | Classifier applies URL path pattern hints as a 3rd fallback step | Implement `classifyByPath(url)` using `new URL(url).pathname` + `new URL(url).hostname`; insert between `classifyByMetadata` and `'Other'` in `classifyNode()` |
| CLASS-03 | Classifier applies sub-domain pattern hints (`docs.*` → Reference, etc.) | Subdomain detection: `new URL(url).hostname` before stripping www. — check if hostname starts with `docs.`, `blog.`, `shop.`; fold into `classifyByPath` or split per Claude discretion |
| CLASS-04 | `CATEGORY_KEYWORDS` tightened to reduce false positives | Edit keyword arrays in `classifier.js`; must happen AFTER golden-file test is committed (D-14) |
| CLASS-05 | Bookmarks in `-`-prefixed folders preserved in their original folder in classified output | Extend `classifyTree(node, preservedFolders)` signature; thread folder name through tree walk; tag links with `category = folderName` when in preserved folder |
| CLASS-06 | User can opt in to classify hyphen-prefixed folder contents normally | Add `reclassifyFolders: new Set()` to Alpine state; add `onToggleReclassify` callback to `renderTree` options in checked state; include array in `POST /api/classify` body; route passes to `classifyTree` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Tech stack: Node.js backend + browser frontend — no framework lock-in; no build step
- No API key required for core flow — classification is entirely rule-based
- Folder depth: proposed hierarchy max 3 levels deep (not changed by this phase)
- Self-contained: all processing local, no data leaves except URL health checks
- Alpine.js via CDN only — no npm install for frontend
- `"type": "module"` in package.json — all server code is ESM
- Test runner: `node --test test/**/*.test.js` (Node built-in, no Jest/Vitest)
- GSD workflow enforcement: edits go through `/gsd:execute-phase`

## Standard Stack

### Core (unchanged from existing project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 24.14.0 (installed) | Runtime | Required >=20; built-in `node:test`, ESM |
| Express | 5.2.1 | HTTP server | Already in use |
| Alpine.js | 3.x (CDN) | Frontend reactivity | Already in use, no build step |
| Node built-in `node:test` | (built-in) | Test runner | Already in use for all 128 existing tests |

### No New Dependencies
This phase adds zero new npm packages. All work is pure logic in existing modules.

**Installation:** None required.

## Architecture Patterns

### Existing Project Structure (relevant files)
```
src/
├── classifier.js          # DOMAIN_RULES, CATEGORY_KEYWORDS, classifyByDomain,
│                          # classifyByMetadata, classifyNode, classifyTree
├── routes/
│   └── classify.js        # POST /api/classify — calls classifyTree + buildHierarchy
└── hierarchyBuilder.js    # buildHierarchy — groups classified links by category

public/
├── app.js                 # Alpine component — classifyBookmarks(), renderTree(), state
└── index.html             # checked state UI (status === 'checked') + CSS

test/
└── classifier.test.js     # Existing unit tests — extend for new functions
```

### Pattern 1: Classifier Pure Functions
**What:** Each classify step is a pure function: `(input) → category | null`. No Express or session dependencies. `classifyNode` chains them.
**When to use:** All new classify steps (`classifyByPath`) must follow this same signature: `(url: string) => string | null`.
**Example:**
```javascript
// Existing pattern in src/classifier.js
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

### Pattern 2: classifyNode Chain Extension
**What:** `classifyNode` short-circuits on first non-null result. Adding a 3rd step is a one-line insertion.
**Current chain:** `classifyByDomain ?? classifyByMetadata ?? 'Other'`
**New chain:** `classifyByDomain ?? classifyByMetadata ?? classifyByPath ?? 'Other'`
```javascript
// New classifyNode after Phase 6
export function classifyNode(node) {
  if (node.type !== 'link') return node;
  const category =
    classifyByDomain(node.url) ??
    classifyByMetadata(node.metadata) ??
    classifyByPath(node.url) ??
    'Other';
  return { ...node, category };
}
```

### Pattern 3: renderTree Options Object (callback pattern)
**What:** `renderTree(node, container, depth, options)` accepts an options object with optional callbacks. Existing callbacks: `onMerge`, `onKeep`, `onRemoveDupe`, `onKeepDupe`, `onContextMenu`.
**When to use:** The `onToggleReclassify` callback follows the same pattern — passed by `renderTree` caller, invoked when the toggle button is clicked, not wired to globals.
```javascript
// Existing callback pattern example from app.js
header.addEventListener('click', (e) => {
  e.stopPropagation();
  if (options.onMerge) options.onMerge(mergeCandidate);
});
```

### Pattern 4: Alpine State via $data / property assignment
**What:** All Alpine state is declared in the `bookmarkApp()` function body as plain properties. New state is added there.
**New state to add:**
```javascript
/** Set of folder names opted in to reclassification */
reclassifyFolders: new Set(),
```
**Note:** `Set` is not serialisable to JSON directly. When sending to the server in `classifyBookmarks()`, convert: `Array.from(this.reclassifyFolders)`.

### Pattern 5: Immutable Tree Operations
**What:** Every tree function returns a new tree — no mutation of the input. `classifyTree` already follows this. When extending `classifyTree` to accept `preservedFolders`, the immutability invariant must be preserved.
```javascript
// Immutable pattern — must be preserved when extending classifyTree
export function classifyTree(node, preservedFolders = new Set()) {
  if (node.type === 'link') return classifyNode(node);
  return {
    ...node,
    children: (node.children ?? []).map(child => classifyTree(child, preservedFolders)),
  };
}
```

### Pattern 6: Golden-File Test (new for this phase)
**What:** A snapshot test that records URL → category pairs for a fixed set of representative URLs. Any future keyword or domain change that silently changes these mappings causes the test to fail.
**Format (Claude's discretion per D-14 — recommendation):**
```javascript
// test/classifier.golden.test.js
const GOLDEN = {
  'https://github.com/foo':          'Development',
  'https://youtube.com/watch?v=abc': 'Video',
  'https://reddit.com/r/prog':       'Social / Community',
  // ... ~20-30 representative entries across all categories
};
for (const [url, expected] of Object.entries(GOLDEN)) {
  it(`classifyByDomain('${url}') === '${expected}'`, () => {
    assert.equal(classifyNode({ type: 'link', url }).category, expected);
  });
}
```
**Key constraint:** This test must cover at least one URL per current category, plus URLs that exercise the metadata fallback. It is written and committed before any `CATEGORY_KEYWORDS` changes.

### Anti-Patterns to Avoid
- **Subdomain detection via regex on full URL string:** Use `new URL(url).hostname` decomposition — it handles ports, IPv6, and edge cases that string matching misses.
- **Checking subdomain after stripping www.:** Subdomain check needs the original hostname (before www-stripping) to detect `docs.example.com`. The www-strip in `classifyByDomain` is correct for domain lookup but wrong for subdomain detection.
- **Mutating the `reclassifyFolders` Set then calling rerenderTree:** Alpine does not observe Set mutations — use `this.reclassifyFolders = new Set(this.reclassifyFolders)` after toggle to trigger reactivity if needed, or track as a plain array.
- **Placing the toggle button in the classified state:** Per D-09 and CONTEXT.md specifics, the toggle appears in the **checked** state left panel — not in the classified state. The checked state uses `x-ref="treeContainer"` with `rerenderTree()`.
- **Path-hint overriding domain rules:** `github.com/blog/` posts must stay in Development (domain rule wins). Path hints only fire when `classifyByDomain` AND `classifyByMetadata` both return null.
- **Leaving CATEGORY_KEYWORDS iteration order implicit:** Object.entries order is insertion order in V8 (guaranteed for string keys). The existing order is intentional — specific categories first, generic last. Any new keyword must be added in the correct position.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL parsing for path/subdomain | Custom string splitting | `new URL(url)` built-in | Handles query strings, ports, IPv6, percent-encoding correctly |
| Snapshot/golden-file testing | Custom diff framework | `assert.deepEqual` with a GOLDEN constant | Node `node:test` + assert is sufficient; no library needed |
| Toggling Set membership | Custom array diff logic | `new Set(existing)` + `.add()` / `.delete()` | Simple; the real concern is Alpine reactivity (see anti-patterns) |

**Key insight:** This phase is pure logic and CSS — no new algorithms, no new data structures beyond what already exists in the codebase.

## Common Pitfalls

### Pitfall 1: classifyTree Signature Change Breaks Route
**What goes wrong:** Extending `classifyTree(node)` to `classifyTree(node, preservedFolders)` is backward-compatible (default parameter = empty Set). But `src/routes/classify.js` calls `classifyTree(source)` and currently does not pass `reclassifyFolders` from the request body. If the route is not updated, hyphen-folder preservation silently applies to everything with no opt-in possible.
**Why it happens:** The route and the classifier are separate files; it's easy to update the classifier and forget the route.
**How to avoid:** Update `src/routes/classify.js` in the same plan wave as the classifier change. The route must read `req.body.reclassifyFolders` (array) and convert to a Set before passing.
**Warning signs:** Test for `classifyTree` passes but the UI toggle has no effect on output.

### Pitfall 2: Folder Name Not Threaded Through Tree Walk
**What goes wrong:** `classifyTree` walks the tree recursively. When it enters a folder node, it recurses into children — but the current implementation does not track "which folder am I currently inside". The preservation logic requires knowing the immediate parent folder's name when classifying a link node.
**Why it happens:** The current tree walk passes no context to child calls. Adding preservation requires threading a `currentFolderName` parameter through the recursion.
**How to avoid:** The recursive call becomes `classifyTree(child, preservedFolders, folderName)` where `folderName` is set when entering a folder node. Link nodes check if `folderName` starts with `-` and is not in `preservedFolders` (opted-in for reclassification).
**Warning signs:** All links get classified normally regardless of folder name, or all links in any folder are preserved.

### Pitfall 3: Alpine Set Reactivity
**What goes wrong:** `this.reclassifyFolders.add(name)` mutates the Set in place. Alpine 3.x does not track mutation of objects/sets — it only detects property assignment. The UI may not update after a toggle.
**Why it happens:** Alpine's reactivity system tracks property writes, not mutations of values pointed to by properties.
**How to avoid:** On toggle, reassign the property: `this.reclassifyFolders = new Set([...this.reclassifyFolders, name])` for add, or filter-reconstruct for delete. Alternatively, store as an array and use array methods that return new arrays.
**Warning signs:** Clicking the toggle button has no visual effect; the badge state does not change.

### Pitfall 4: Golden-File Test Written After Keyword Change
**What goes wrong:** If `CATEGORY_KEYWORDS` is tightened before the golden file is written, the golden file captures the post-change state, not the pre-change baseline. It provides no regression protection against the keyword edit.
**Why it happens:** It feels natural to do all the changes and then add tests.
**How to avoid:** Enforce D-14 strictly in the plan wave order: golden file committed → keyword changes applied → verify golden file still passes.
**Warning signs:** None visible at test time, but the regression protection is absent.

### Pitfall 5: www-Strip Happens Before Subdomain Check
**What goes wrong:** `classifyByDomain` strips `www.` before lookup. If `classifyByPath` reuses the already-stripped hostname to check for `docs.` prefix, it would miss `docs.example.com` (which has no `www.`). But it would also wrongly check `example.com` after stripping instead of `docs.example.com`.
**Why it happens:** Reusing the www-stripped hostname from `classifyByDomain` for subdomain detection.
**How to avoid:** `classifyByPath` must extract the hostname fresh from the URL via `new URL(url).hostname` — do not reuse the stripped hostname. The subdomain check is on the raw hostname: `hostname.startsWith('docs.')`.
**Warning signs:** `docs.example.com` classified as 'Other' instead of 'Reference'.

### Pitfall 6: Toggle Button Renders in Wrong State
**What goes wrong:** The `onToggleReclassify` badge is rendered in the classified state (status === 'classified') left panel instead of the checked state (status === 'checked') panel.
**Why it happens:** There are multiple `renderTree` call sites. The checked state uses `x-ref="treeContainer"` + `rerenderTree()`. The classified state uses `x-ref="leftPanel"` with `renderTree(tree, $el, 0, {})`. It is easy to add the option to the wrong call site.
**How to avoid:** Add `onToggleReclassify` only to the `rerenderTree()` call path (the `getTreeOptions()` equivalent for the checked state). The classified state left panel is read-only.
**Warning signs:** Toggle buttons appear in the classified state left panel where they have no effect.

## Code Examples

### classifyByPath — recommended implementation structure
```javascript
// Source: src/classifier.js (new function for Phase 6)
// Subdomain and path hints — 3rd fallback step in classifyNode.
// Returns category string or null.
// Uses raw hostname (not www-stripped) for subdomain check.
export function classifyByPath(url) {
  let pathname, hostname;
  try {
    const parsed = new URL(url);
    pathname = parsed.pathname.toLowerCase();
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }

  // Subdomain hints (check raw hostname, before any stripping)
  if (hostname.startsWith('docs.') || hostname.startsWith('documentation.')) return 'Reference';
  if (hostname.startsWith('blog.'))  return 'News';
  if (hostname.startsWith('shop.') || hostname.startsWith('store.')) return 'Shopping';

  // Path hints (checked in order from most specific to least specific)
  if (pathname.includes('/docs/') || pathname.startsWith('/docs') || pathname.includes('/documentation/')) return 'Reference';
  if (pathname.includes('/blog/') || pathname.startsWith('/blog') || pathname.includes('/news/')) return 'News';
  if (pathname.includes('/shop/') || pathname.startsWith('/shop') || pathname.includes('/store/')) return 'Shopping';
  if (pathname.includes('/api/') || pathname.startsWith('/api')) return 'Development';

  return null;
}
```

### classifyTree with folder-context threading
```javascript
// Source: src/classifier.js (extended for Phase 6 D-05 through D-08)
export function classifyTree(node, preservedFolders = new Set(), _sourceFolderName = null) {
  if (node.type === 'link') {
    // If inside a preserved folder, tag with original folder name
    if (_sourceFolderName !== null
        && _sourceFolderName.startsWith('-')
        && !preservedFolders.has(_sourceFolderName)) {
      return { ...node, category: _sourceFolderName };
    }
    return classifyNode(node);
  }
  // Folder node: thread folder name to children
  const folderName = node.title ?? null;
  return {
    ...node,
    children: (node.children ?? []).map(child =>
      classifyTree(child, preservedFolders, folderName)
    ),
  };
}
```
**Note:** `preservedFolders` contains names of folders opted IN to reclassification (despite hyphen prefix). A folder starting with `-` that is NOT in `preservedFolders` → preserve. A folder starting with `-` that IS in `preservedFolders` → classify normally.

### Route update for reclassifyFolders
```javascript
// Source: src/routes/classify.js (updated for Phase 6 D-12)
router.post('/classify', (req, res) => {
  const source = session.checkedTree ?? session.cleanTree;
  if (!source) {
    return res.status(400).json({ error: 'No checked tree available. Run link check first.' });
  }
  const reclassifyFolders = new Set(Array.isArray(req.body?.reclassifyFolders)
    ? req.body.reclassifyFolders
    : []);
  const classified = classifyTree(source, reclassifyFolders);
  const classifiedTree = buildHierarchy(classified);
  session.classifiedTree = classifiedTree;
  res.json({ classifiedTree });
});
```

### Frontend toggle wiring in classifyBookmarks()
```javascript
// Source: public/app.js — updated classifyBookmarks()
async classifyBookmarks() {
  this.isClassifying = true;
  this.status = 'classifying';
  this.errorMsg = '';
  try {
    const res = await fetch('/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reclassifyFolders: Array.from(this.reclassifyFolders),
      }),
    });
    // ... rest unchanged
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 2-step classify chain (domain → metadata → Other) | 3-step chain (domain → metadata → path/subdomain → Other) | Phase 6 | Better coverage for long-tail domains without API |
| All bookmarks reclassified regardless of folder name | Hyphen-prefix folders preserved by default | Phase 6 | User intent expressed via folder naming is respected |
| No keyword regression guard | Golden-file test gates CATEGORY_KEYWORDS changes | Phase 6 | Prevents silent reclassification from keyword edits |

## Open Questions

1. **Toggle button state — visual feedback**
   - What we know: D-09 says a small `[↺ reclassify]` badge/button on the folder row; D-10 says toggled state tracked in `reclassifyFolders` Set.
   - What's unclear: Whether the button should show different text/style when toggled on (e.g., `[↺ keep]` to reverse).
   - Recommendation: Claude's discretion — implement as a toggle that changes button label between "↺ reclassify" and "✕ keep" to indicate current state. This is purely cosmetic and does not affect backend logic.

2. **Nested hyphen folders**
   - What we know: D-05 through D-08 cover the case where a folder whose name starts with `-` is a direct child of root or another folder.
   - What's unclear: If a `-Pinned` folder contains a sub-folder (not a link), what happens to that sub-folder's children?
   - Recommendation: Only check the immediate parent folder name against the `-` prefix. Sub-sub-folder children are not affected unless their direct parent also starts with `-`. This is consistent with D-08: "when entering a folder whose name starts with `-`, links inside are tagged."

3. **DOMAIN_RULES expansion: ~250 entries to add**
   - What we know: Target is ~300 total (from ~50 current). Proportional across all categories per D-13.
   - What's unclear: Exact domain list — left to Claude's discretion.
   - Recommendation: Aim for ~25-30 entries per category. Prioritise domains with high real-world bookmark frequency: dev tools, news sites, design resources, learning platforms, financial services. Avoid adding domains that are obviously covered by path/subdomain hints (e.g., `docs.anything.com`).

## Environment Availability

Step 2.6: All work is pure code editing in an existing project. No external services, databases, or new CLI tools required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime + test runner | Yes | v24.14.0 | — |
| npm | Package management | Yes | 11.12.0 | — |
| node:test (built-in) | Test suite | Yes | built-in | — |

**No missing dependencies.**

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | none — invoked via npm script |
| Quick run command | `node --test test/classifier.test.js` |
| Full suite command | `npm test` (runs all `test/**/*.test.js`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLASS-01 | DOMAIN_RULES has ~300 entries, spot-check known domains across categories | unit | `node --test test/classifier.test.js` | Yes (extend existing) |
| CLASS-02 | `classifyByPath` returns correct category for known path patterns | unit | `node --test test/classifier.test.js` | Yes (extend existing) |
| CLASS-03 | `classifyByPath` returns correct category for known subdomains | unit | `node --test test/classifier.test.js` | Yes (extend existing) |
| CLASS-04 | CATEGORY_KEYWORDS change does not reclassify golden-file URLs | golden-file regression | `node --test test/classifier.golden.test.js` | No — Wave 0 |
| CLASS-05 | Links in `-Pinned` folder get `category = '-Pinned'` after classifyTree | unit | `node --test test/classifier.test.js` | Yes (extend existing) |
| CLASS-06 | Links in `-Pinned` folder get normal classification when folder in reclassifyFolders | unit | `node --test test/classifier.test.js` | Yes (extend existing) |

### Sampling Rate
- **Per task commit:** `node --test test/classifier.test.js`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (`npm test`, 128+ tests passing) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/classifier.golden.test.js` — covers CLASS-04 baseline regression; must be written and passing BEFORE any CATEGORY_KEYWORDS edits

*(All other test infrastructure exists — `test/classifier.test.js` is extended in-place for CLASS-01 through CLASS-03 and CLASS-05 through CLASS-06.)*

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/classifier.js` — DOMAIN_RULES (50 entries), CATEGORY_KEYWORDS (10 categories), classifyByDomain, classifyByMetadata, classifyNode, classifyTree
- Direct code inspection: `src/routes/classify.js` — route handler, session usage
- Direct code inspection: `src/hierarchyBuilder.js` — buildHierarchy, collectLinks
- Direct code inspection: `public/app.js` — Alpine state, renderTree options pattern, classifyBookmarks(), rerenderTree()
- Direct code inspection: `public/index.html` — checked state (status === 'checked'), classified state layout
- Direct code inspection: `test/classifier.test.js` — 128 passing tests, node:test framework
- Node.js v24.14.0 built-in `node:test` — confirmed available
- `package.json` — `"type": "module"`, test script, all dependencies confirmed

### Secondary (MEDIUM confidence)
- Alpine.js 3.x reactivity model for Set mutations — well-known limitation, documented in Alpine community

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — directly inspected all source files, 128 tests passing
- Architecture: HIGH — code patterns read directly, no inference needed
- Pitfalls: HIGH — derived from actual code structure (tree walk threading, Alpine Set reactivity) not speculation
- Test strategy: HIGH — existing test framework confirmed working

**Research date:** 2026-03-24
**Valid until:** Stable — no external dependencies; valid until source files are changed
