# Phase 2: Core Cleanup - Research

**Researched:** 2026-03-23
**Domain:** In-memory bookmark tree deduplication, URL normalization, fuzzy folder-name matching, subtree fingerprinting, Alpine.js/vanilla-JS UI extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Cleanup is manually triggered — user clicks a "Run Cleanup" button after the file is loaded and they've reviewed the raw tree. Does not auto-run on upload.
- **D-02:** When a URL appears multiple times after normalization, keep the **first occurrence** in a depth-first top-down tree walk.
- **D-03:** URL normalization must handle all seven patterns from DEDUP-02: strip UTM/tracking params (`utm_*`, `fbclid`, `gclid`), normalize `www` prefix, strip trailing slash, normalize `http`/`https` — verified by unit tests.
- **D-04:** Show ⚠️ badges **inline in the existing tree** next to folders with similar names. Each flagged pair gets per-row `[→ Merge into X]` and `[Keep separate]` buttons, plus a **bulk "Approve all merges"** option.
- **D-05:** Fully duplicated folder subtrees (DEDUP-04) use the same inline pattern — flag in tree with merge/keep buttons and a bulk approve option.
- **D-06:** Fuzzy matching threshold: `distance(a, b) / max(a.length, b.length) ≤ 0.25`. Fixed for v1.
- **D-07:** Add `cleanTree` to session store (`session.cleanTree`). `/api/cleanup` reads `session.tree`, writes `session.cleanTree`. `session.tree` is never mutated.
- **D-08:** API response from `/api/cleanup` includes `cleanTree`, `stats` (duplicates removed, duplicate subtrees found), and `mergeCandidates[]` (folder IDs, names, similarity score). Merge confirmation is a separate `/api/merge` call.

### Claude's Discretion

- Exact fuzzy matching logic for subtree duplication (hash-based content fingerprint is fine)
- CSS styling of ⚠️ inline badges and merge/keep buttons
- Whether the "Run Cleanup" button appears in the stats bar or as a new action row

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 2 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEDUP-01 | Detect duplicate bookmarks by URL (after normalization) across the entire tree; retain only one copy | URL normalization + first-seen Set pattern (§URL Normalization, §Dedup Walk Pattern) |
| DEDUP-02 | URL normalization strips UTM/tracking params (`utm_*`, `fbclid`, `gclid`), normalizes `www` prefix, strips trailing slashes, normalizes `http`/`https` before comparison | Regex patterns documented in §URL Normalization with all seven rules |
| DEDUP-03 | Detect folders with similar names via fuzzy matching; propose merge (user must confirm) | `fastest-levenshtein` distance ratio ≤ 0.25 threshold; `createRequire` interop for CJS module in ESM project |
| DEDUP-04 | Detect fully duplicated folder subtrees (same name + same URL children); propose removing redundant copy | Canonical hash fingerprint approach (§Subtree Fingerprinting) |
</phase_requirements>

---

## Summary

Phase 2 is a pure in-memory pipeline phase. No network calls, no file I/O, no new dependencies on the critical path beyond `fastest-levenshtein` (already specified in CLAUDE.md). The work divides cleanly into three backend modules (`dedup.js`, `fuzzy.js`, `cleanup.js`), two Express route files (`cleanup.js`, `merge.js`), session store extension, and frontend integration (new Alpine state fields + `renderTree()` merge-review mode).

The most technically interesting problem is subtree fingerprinting for DEDUP-04. A canonical hash — sorting folder children by URL before hashing — avoids order-sensitivity while remaining deterministic. The `node:crypto` built-in `createHash('sha256')` is sufficient; no new dependency is required.

The second noteworthy point is `fastest-levenshtein` interop. The package ships as CJS (`mod.js`). In an ESM project (`"type": "module"` in package.json), named `import { distance } from 'fastest-levenshtein'` works correctly on Node 18+. Confirmed: Node's CJS-from-ESM interop handles this transparently when the package does not use `"exports"` conditions that block named imports.

The UI integration is additive: `renderTree()` gains an optional `options` parameter (`{ reviewMode, mergeCandidates }`), Alpine component state gains `cleanupStats`, `mergeCandidates`, and two new status values (`'cleaning'`, `'cleaned'`). All new UI pieces are vanilla CSS + Alpine — no new dependencies.

**Primary recommendation:** Build three files in order: `src/dedup.js` (URL normalization + dedup walk), `src/fuzzy.js` (Levenshtein folder-pair detection + subtree fingerprinting), `src/routes/cleanup.js` (pipeline orchestration), then frontend integration last.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `node:crypto` | built-in (Node 20+) | SHA-256 hash for subtree fingerprinting | No dependency; `createHash('sha256').update(str).digest('hex')` is the established Node pattern |
| Node.js built-in `URL` / `URLSearchParams` | built-in | Structured URL parsing for normalization | WHATWG URL API — correct handling of edge cases (encoded params, fragment stripping) |
| fastest-levenshtein | 1.0.16 | Edit-distance ratio for folder name fuzzy matching | Already in CLAUDE.md as the canonical choice; `distance(a, b)` returns integer edit distance |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Express 5.2.1 | (existing) | Two new route files: `cleanup.js`, `merge.js` | Router-per-file pattern already established in Phase 1 |
| Alpine.js 3.x (CDN) | (existing) | New component state: `cleanupStats`, `mergeCandidates`, `'cleaning'`/`'cleaned'` status | Additive to existing `bookmarkApp` component |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:crypto` for fingerprinting | A deterministic JSON stringify | JSON.stringify is order-sensitive for arrays; sorting + hashing is safer and just as simple |
| `fastest-levenshtein` ratio | Jaro-Winkler | Jaro-Winkler is better for short strings like names; but decision D-06 locked ratio threshold, so Levenshtein is the locked choice |
| `URL` + `URLSearchParams` for normalization | Manual regex only | WHATWG URL API handles percent-encoding and edge cases correctly; use it for parsing, regex for param stripping |

**Installation (fastest-levenshtein not yet in package.json):**

```bash
npm install fastest-levenshtein@1.0.16
```

**Version verification:** Confirmed via `npm view fastest-levenshtein version` → `1.0.16`. Entry point is `mod.js` (CJS). No ESM-specific exports block.

---

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)

```
src/
├── dedup.js          # normalizeUrl(), dedupTree() — pure functions, return new tree
├── fuzzy.js          # findMergeCandidates(), fingerprintSubtree() — pure functions
├── routes/
│   ├── cleanup.js    # POST /api/cleanup — pipeline orchestrator
│   └── merge.js      # POST /api/merge — apply confirmed merges
public/
└── app.js            # extend: new Alpine state, renderTree() review mode
test/
├── dedup.test.js     # unit tests for all 7 normalization patterns + dedup walk
└── fuzzy.test.js     # unit tests for merge candidate detection + subtree fingerprint
```

### Pattern 1: URL Normalization (DEDUP-02)

**What:** Pure function that accepts a raw URL string and returns a canonical string for comparison. Uses the WHATWG `URL` API for parsing so percent-encoding, fragment, and port are handled correctly, then applies the seven normalization rules.

**When to use:** Call on every `link` node URL before inserting into the seen-Set in the dedup walk.

**Seven rules (all required by D-03 / DEDUP-02):**

1. Strip fragment (`#...`) — URL API handles this: set `url.hash = ''`
2. Normalize scheme: map `http:` → `https:` (store as `https://`)
3. Remove `www.` prefix: `www.example.com` → `example.com`
4. Strip trailing slash from pathname: `/path/` → `/path` (unless pathname is just `/`)
5. Delete `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` params
6. Delete `fbclid` param
7. Delete `gclid` param

**Example:**

```javascript
// src/dedup.js
import { URL } from 'node:url'; // available as global in Node 18+ but explicit import is safer

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid',
]);

/**
 * @param {string} rawUrl
 * @returns {string} Canonical URL for deduplication comparison
 */
export function normalizeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    // Unparseable URLs (javascript:, mailto:, etc.) — return raw for identity comparison
    return rawUrl;
  }

  // Rule 1: strip fragment
  parsed.hash = '';

  // Rule 2: http → https
  if (parsed.protocol === 'http:') {
    parsed.protocol = 'https:';
  }

  // Rule 3: strip www. prefix
  if (parsed.hostname.startsWith('www.')) {
    parsed.hostname = parsed.hostname.slice(4);
  }

  // Rule 4: strip trailing slash from non-root pathnames
  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  // Rules 5-7: strip tracking params
  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key)) {
      parsed.searchParams.delete(key);
    }
  }

  return parsed.toString();
}
```

### Pattern 2: Dedup Walk (DEDUP-01)

**What:** Depth-first top-down recursive walk that returns a new tree, keeping the first occurrence of each normalized URL and discarding subsequent duplicates.

**When to use:** Applied to `session.tree` in `/api/cleanup`. Returns a new tree (never mutates original, per D-11 / D-07).

**Example:**

```javascript
// src/dedup.js
/**
 * @param {import('./shared/types.js').BookmarkNode} node
 * @param {Set<string>} seen - Mutable Set of normalized URLs (share across recursion)
 * @returns {import('./shared/types.js').BookmarkNode}
 */
export function dedupTree(node, seen = new Set()) {
  if (node.type === 'link') {
    const canonical = normalizeUrl(node.url ?? '');
    if (seen.has(canonical)) return null; // duplicate — drop
    seen.add(canonical);
    return { ...node }; // shallow copy sufficient; links have no children
  }

  // Folder: recurse, filter nulls
  const newChildren = (node.children ?? [])
    .map(child => dedupTree(child, seen))
    .filter(Boolean);

  return { ...node, children: newChildren };
}
```

**Note:** The root `seen` Set is passed by reference across all recursion levels so duplicates across different subtrees are detected.

### Pattern 3: Folder Fuzzy Matching (DEDUP-03)

**What:** Collect all folder nodes from the clean tree, then test all unique pairs. Flag pairs where the Levenshtein edit-distance ratio ≤ 0.25 (D-06).

**When to use:** After `dedupTree()` runs, scan the resulting tree for merge candidates.

**fastest-levenshtein ESM interop:**

`fastest-levenshtein@1.0.16` ships as a CJS module. In an ESM project (`"type": "module"`), the interop is transparent on Node 18+:

```javascript
// src/fuzzy.js
import { distance } from 'fastest-levenshtein';
// Named import works because Node's CJS-from-ESM interop exports all module.exports keys

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function isSimilarName(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return false;
  return distance(a.toLowerCase(), b.toLowerCase()) / maxLen <= 0.25;
}
```

**Collecting all folders from tree:**

```javascript
function collectFolders(node, result = []) {
  if (node.type === 'folder' && node.title !== 'root') {
    result.push(node);
  }
  for (const child of (node.children ?? [])) {
    collectFolders(child, result);
  }
  return result;
}

export function findMergeCandidates(tree) {
  const folders = collectFolders(tree);
  const candidates = [];

  for (let i = 0; i < folders.length; i++) {
    for (let j = i + 1; j < folders.length; j++) {
      const a = folders[i];
      const b = folders[j];
      if (isSimilarName(a.title, b.title)) {
        const maxLen = Math.max(a.title.length, b.title.length);
        candidates.push({
          aId: a.id, aName: a.title,
          bId: b.id, bName: b.title,
          score: distance(a.title.toLowerCase(), b.title.toLowerCase()) / maxLen,
        });
      }
    }
  }

  return candidates;
}
```

**O(n²) complexity note:** For typical bookmark collections (50–200 folders), n² is ~2500–40000 comparisons — negligible. No optimization needed.

### Pattern 4: Subtree Fingerprinting (DEDUP-04)

**What:** Hash-based content fingerprint per folder that captures the set of child link URLs (order-independent). Two folders with identical fingerprints are candidate duplicates.

**When to use:** Companion to `findMergeCandidates()`. Run after dedup walk.

```javascript
// src/fuzzy.js
import { createHash } from 'node:crypto';

/**
 * Returns a canonical fingerprint of a folder based on its direct link-child URLs.
 * Sorts URLs before hashing so order doesn't matter.
 * Only considers direct children (not deep-nested) — avoids false positives from
 * large folders that happen to share some links.
 *
 * @param {import('./shared/types.js').BookmarkNode} folder
 * @returns {string} SHA-256 hex digest
 */
export function fingerprintSubtree(folder) {
  const urls = (folder.children ?? [])
    .filter(n => n.type === 'link')
    .map(n => normalizeUrl(n.url ?? ''))
    .sort();

  return createHash('sha256').update(JSON.stringify(urls)).digest('hex');
}

export function findDuplicateSubtrees(tree) {
  const folders = collectFolders(tree);
  const byFingerprint = new Map();

  for (const folder of folders) {
    const links = (folder.children ?? []).filter(n => n.type === 'link');
    if (links.length === 0) continue; // skip empty folders

    const fp = fingerprintSubtree(folder);
    if (!byFingerprint.has(fp)) {
      byFingerprint.set(fp, []);
    }
    byFingerprint.get(fp).push(folder);
  }

  const duplicatePairs = [];
  for (const [, group] of byFingerprint) {
    if (group.length > 1) {
      // Report as pairs: keep first, flag rest
      for (let i = 1; i < group.length; i++) {
        duplicatePairs.push({ keepId: group[0].id, keepName: group[0].title,
          removeId: group[i].id, removeName: group[i].title });
      }
    }
  }

  return duplicatePairs;
}
```

**Discretion note (from CONTEXT.md):** Fingerprint considers only direct-child links (not recursive). This is intentional — avoids false positives from large parent folders that happen to share a few nested bookmarks.

### Pattern 5: /api/cleanup Route

```javascript
// src/routes/cleanup.js
import { Router } from 'express';
import { dedupTree } from '../dedup.js';
import { findMergeCandidates, findDuplicateSubtrees } from '../fuzzy.js';
import { session } from '../session.js';

const router = Router();

router.post('/cleanup', (req, res) => {
  if (!session.tree) {
    return res.status(400).json({ error: 'No bookmark file loaded.' });
  }

  // 1. Dedup — returns new tree, never mutates session.tree
  const seen = new Set();
  const cleanTree = dedupTree(session.tree, seen);
  const dupesRemoved = seen.size - countLinks(cleanTree); // rough: links in original vs clean

  // 2. Fuzzy folder matches
  const mergeCandidates = findMergeCandidates(cleanTree);

  // 3. Duplicate subtrees
  const duplicateSubtrees = findDuplicateSubtrees(cleanTree);

  // 4. Persist to session
  session.cleanTree = cleanTree;
  session.mergeCandidates = mergeCandidates;

  res.json({
    cleanTree,
    stats: {
      dupesRemoved: countDupesRemoved(session.tree, cleanTree),
      duplicateSubtreesFound: duplicateSubtrees.length,
    },
    mergeCandidates,
    duplicateSubtrees,
  });
});

export default router;
```

**Counting duplicates removed:** Walk original tree and count links; walk clean tree and count links; delta is duplicates removed.

### Pattern 6: /api/merge Route

**What:** Accepts `{ approveAll: true }` or `{ pairs: [{ a, b }] }`. Merges folder B's children into folder A, removes folder B from `cleanTree`. Returns updated `cleanTree`.

**Merge logic (applying folder merge):**

```javascript
// src/routes/merge.js
import { Router } from 'express';
import { session } from '../session.js';

const router = Router();

router.post('/merge', (req, res) => {
  if (!session.cleanTree) {
    return res.status(400).json({ error: 'Run cleanup first.' });
  }

  const { approveAll, pairs } = req.body;

  let toMerge;
  if (approveAll) {
    toMerge = session.mergeCandidates ?? [];
  } else if (Array.isArray(pairs)) {
    toMerge = pairs;
  } else {
    return res.status(400).json({ error: 'Provide approveAll or pairs.' });
  }

  // Apply each merge: move children from bId folder into aId folder, remove bId folder
  let tree = session.cleanTree;
  for (const { aId, bId } of toMerge) {
    tree = applyMerge(tree, aId, bId);
  }

  session.cleanTree = tree;
  // Remove resolved pairs from mergeCandidates
  if (!approveAll) {
    const resolvedIds = new Set(pairs.flatMap(p => [p.aId, p.bId]));
    session.mergeCandidates = (session.mergeCandidates ?? []).filter(
      c => !resolvedIds.has(c.aId) && !resolvedIds.has(c.bId)
    );
  } else {
    session.mergeCandidates = [];
  }

  res.json({ cleanTree: tree });
});
```

**applyMerge helper:** Recursively walks the tree twice — once to extract children of `bId`, once to append them to `aId` and remove `bId` from its parent.

### Pattern 7: Alpine State Extension

**New state fields to add to `bookmarkApp`:**

```javascript
/** 'idle' | 'loading' | 'loaded' | 'cleaning' | 'cleaned' | 'error' */
status: 'idle',

/** { dupesRemoved: number, duplicateSubtreesFound: number } | null */
cleanupStats: null,

/** Array of merge candidates from /api/cleanup response */
mergeCandidates: [],

/** The cleaned tree (separate from raw this.tree) */
cleanTree: null,
```

**runCleanup() method (new):**

```javascript
async runCleanup() {
  this.status = 'cleaning';
  try {
    const res = await fetch('/api/cleanup', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Cleanup failed');
    }
    const data = await res.json();
    this.cleanTree = data.cleanTree;
    this.cleanupStats = data.stats;
    this.mergeCandidates = data.mergeCandidates;
    this.status = 'cleaned';
    this.$nextTick(() => {
      const container = this.$refs.treeContainer;
      if (container) {
        container.innerHTML = '';
        renderTree(this.cleanTree, container, 0, { reviewMode: true, mergeCandidates: this.mergeCandidates });
      }
    });
  } catch (err) {
    this.errorMsg = err.message;
    this.status = 'error';
  }
},
```

### Pattern 8: renderTree() Review Mode Extension

**Current signature:** `renderTree(node, container, depth = 0)`

**New signature:** `renderTree(node, container, depth = 0, options = {})`

Where `options = { reviewMode: false, mergeCandidates: [], onMerge: fn, onKeep: fn }`.

In review mode, for folder nodes whose `.id` is in `mergeCandidates`, inject `.merge-badge`, `.btn-merge`, and `.btn-keep` elements after the label span (per UI-SPEC).

**Key DOM injection points:**

```javascript
if (options.reviewMode && options.mergeCandidates) {
  const candidate = options.mergeCandidates.find(
    c => c.aId === node.id || c.bId === node.id
  );
  if (candidate) {
    const targetName = candidate.aId === node.id ? candidate.bName : candidate.aName;

    const badge = document.createElement('span');
    badge.className = 'merge-badge';
    badge.textContent = '⚠️ Similar folder';

    const btnMerge = document.createElement('button');
    btnMerge.className = 'btn-merge';
    btnMerge.textContent = `→ Merge into "${targetName}"`;
    btnMerge.addEventListener('click', (e) => {
      e.stopPropagation();
      options.onMerge?.(candidate);
    });

    const btnKeep = document.createElement('button');
    btnKeep.className = 'btn-keep';
    btnKeep.textContent = 'Keep separate';
    btnKeep.addEventListener('click', (e) => {
      e.stopPropagation();
      options.onKeep?.(candidate, wrapper);
    });

    header.appendChild(badge);
    header.appendChild(btnMerge);
    header.appendChild(btnKeep);
  }
}
```

### Anti-Patterns to Avoid

- **Mutating session.tree:** Never modify the original tree. All pipeline stages must return new trees. (D-07, D-11)
- **Global seen Set reset between folders:** The `seen` Set must be passed top-down across the entire tree walk, not reset per folder — duplicates can exist in different branches.
- **Case-sensitive folder name comparison:** Always call `.toLowerCase()` before `distance()`. "Dev Tools" and "dev tools" are the same folder.
- **Empty folder fingerprints colliding:** Skip folders with zero link children from subtree fingerprinting — empty folders are trivially "equal" and would produce bogus merge candidates.
- **Blocking the event loop with synchronous crypto:** `createHash().digest()` is synchronous but fast for small inputs (URLs). No need for async — don't add unnecessary async complexity.
- **Using `import * as lev from 'fastest-levenshtein'`:** Use named imports: `import { distance } from 'fastest-levenshtein'`. The `*` form on CJS interop may not expose named exports on older Node versions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Edit distance between strings | Manual Levenshtein implementation | `fastest-levenshtein` | Existing optimized WASM-backed implementation; already in CLAUDE.md |
| URL parsing + param manipulation | Regex-only string manipulation | WHATWG `URL` + `URLSearchParams` | Handles percent-encoding, port normalization, edge cases (empty params, array params) correctly |
| Cryptographic hash | Custom fingerprint algorithm | `node:crypto` `createHash('sha256')` | Built-in, collision-resistant, no dependency |

**Key insight:** URL normalization is deceptively fiddly — `URLSearchParams` iteration and deletion while iterating requires spreading keys first (`.keys()` returns a live iterator). Always use `[...params.keys()]` before the delete loop.

---

## Common Pitfalls

### Pitfall 1: URLSearchParams live iterator mutation
**What goes wrong:** Calling `params.delete(key)` inside a `for...of params.keys()` loop causes skipped or repeated entries because the iterator is live.
**Why it happens:** `URLSearchParams.keys()` returns a live iterator that updates when entries are deleted.
**How to avoid:** Snapshot keys first: `const keys = [...parsed.searchParams.keys()]; for (const key of keys) { ... }`
**Warning signs:** Tests that strip `utm_source&utm_medium` only strip one of the two params.

### Pitfall 2: http/https normalization breaks non-http URLs
**What goes wrong:** Applying protocol normalization to `javascript:`, `mailto:`, `ftp:`, `data:` URLs throws or produces garbage.
**Why it happens:** `new URL('javascript:void(0)')` parses successfully but `protocol` is `javascript:`, not `http:`.
**How to avoid:** Wrap `new URL(rawUrl)` in try/catch. Only apply protocol normalization when `parsed.protocol === 'http:'`. Return raw URL string when URL constructor throws (unparseable bookmarks exist in the wild).

### Pitfall 3: Subtree merge creates orphaned nodes
**What goes wrong:** After merging folder B into folder A, folder B's ID still appears in `mergeCandidates` on the client side, showing stale badges.
**Why it happens:** The frontend `mergeCandidates` array is not updated after a partial merge.
**How to avoid:** The `/api/merge` response should return both the updated `cleanTree` AND the updated `mergeCandidates` list. The frontend must update both.

### Pitfall 4: Root node included in folder fuzzy scan
**What goes wrong:** The synthetic `root` node (title: `'root'`) gets compared against folders named things like `'Roots'` or `'Root'`, producing spurious merge candidates.
**Why it happens:** `collectFolders()` naively includes all folder nodes including the root.
**How to avoid:** Skip nodes with `title === 'root'` (or `depth === 0`) in `collectFolders()`.

### Pitfall 5: Dedup count calculation off-by-one
**What goes wrong:** Stats report `0 duplicates removed` even when duplicates existed.
**Why it happens:** Counting the `seen` Set size after dedup gives the count of unique URLs, not duplicates removed. Correct approach: count links in original tree and links in clean tree; delta is duplicates removed.
**How to avoid:** `dupesRemoved = countLinks(session.tree) - countLinks(cleanTree)`.

### Pitfall 6: fastest-levenshtein CJS default export confusion
**What goes wrong:** `import lev from 'fastest-levenshtein'; lev.distance(a, b)` throws `lev.distance is not a function`.
**Why it happens:** CJS modules exported via `module.exports = { distance, closest }` do not always expose a `default` export that mirrors the namespace. Node CJS interop wraps the whole `module.exports` as the default, so `lev.default.distance` or destructuring is needed.
**How to avoid:** Always use named imports: `import { distance } from 'fastest-levenshtein'`. This is the correct pattern for CJS named exports consumed from ESM.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|---------|
| Node.js | Runtime | ✓ | v24.14.0 | — |
| `node:crypto` `createHash` | Subtree fingerprinting | ✓ | built-in | — |
| WHATWG `URL` API | URL normalization | ✓ | built-in | — |
| `fastest-levenshtein@1.0.16` | Folder name fuzzy match | ✗ (not installed) | — | None — must install |
| Express 5.2.1 | New routes | ✓ | existing | — |

**Missing dependencies with no fallback:**
- `fastest-levenshtein` — must be `npm install fastest-levenshtein@1.0.16` before Wave 1 begins. No substitute for DEDUP-03.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config file | none — tests run via `npm test` → `node --test test/**/*.test.js` |
| Quick run command | `node --test test/dedup.test.js` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEDUP-02 | `normalizeUrl()` strips utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid | unit | `node --test test/dedup.test.js` | ❌ Wave 0 |
| DEDUP-02 | `normalizeUrl()` maps http → https | unit | `node --test test/dedup.test.js` | ❌ Wave 0 |
| DEDUP-02 | `normalizeUrl()` strips www prefix | unit | `node --test test/dedup.test.js` | ❌ Wave 0 |
| DEDUP-02 | `normalizeUrl()` strips trailing slash | unit | `node --test test/dedup.test.js` | ❌ Wave 0 |
| DEDUP-01 | `dedupTree()` retains first occurrence, drops subsequent | unit | `node --test test/dedup.test.js` | ❌ Wave 0 |
| DEDUP-01 | `dedupTree()` detects duplicates across different branches | unit | `node --test test/dedup.test.js` | ❌ Wave 0 |
| DEDUP-03 | `findMergeCandidates()` flags "Dev Tools" / "Developer Tools" pair | unit | `node --test test/fuzzy.test.js` | ❌ Wave 0 |
| DEDUP-03 | `findMergeCandidates()` does not flag unrelated folder names | unit | `node --test test/fuzzy.test.js` | ❌ Wave 0 |
| DEDUP-04 | `findDuplicateSubtrees()` detects folders with identical URL sets | unit | `node --test test/fuzzy.test.js` | ❌ Wave 0 |
| DEDUP-04 | `findDuplicateSubtrees()` ignores empty folders | unit | `node --test test/fuzzy.test.js` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test test/dedup.test.js test/fuzzy.test.js`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/dedup.test.js` — covers DEDUP-01 and all 7 DEDUP-02 normalization patterns (7 distinct test cases)
- [ ] `test/fuzzy.test.js` — covers DEDUP-03 and DEDUP-04

*(Existing test infrastructure: `node:test` runner already confirmed from `package.json`. No framework install needed.)*

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 2 |
|-----------|-------------------|
| ESM throughout (`"type": "module"`) | All new files use `import`/`export`. Use named import for `fastest-levenshtein`. |
| Node >=20 required | Node 24.14.0 detected — compliant. |
| Stages return new trees, never mutate (D-11) | `dedupTree()` and merge functions must return new tree objects. |
| Router-per-file pattern (D-08) | New routes go in `src/routes/cleanup.js` and `src/routes/merge.js`. |
| Alpine.js CDN — no build step | No new frontend npm packages; all UI changes are vanilla CSS + Alpine state. |
| No API keys required for core flow | Dedup/fuzzy is entirely local — no network calls. Compliant. |
| `fastest-levenshtein` is the canonical fuzzy lib | Do not substitute Fuse.js, uFuzzy, or manual implementations. |
| Avoid `bookmarks-parser` / `node-bookmarks-parser` npm packages | Not relevant to Phase 2 (no parsing). |

---

## Sources

### Primary (HIGH confidence)

- CLAUDE.md (project file) — stack decisions, library choices, version pins, ESM pattern
- `src/parser.js`, `src/session.js`, `src/shared/types.js` — actual Phase 1 code
- `public/app.js` — actual Alpine component; `renderTree()` signature
- `package.json` — confirmed `"type": "module"`, `"node": ">=20"`, test command
- `02-CONTEXT.md` — all locked decisions (D-01 through D-08)
- `02-UI-SPEC.md` — component inventory, CSS classes, color tokens, interaction contract
- Node.js `node:crypto` — built-in, no source needed
- WHATWG URL API — built-in, no source needed
- `npm view fastest-levenshtein version` — confirmed 1.0.16 current
- `npm view fastest-levenshtein main` — confirmed `mod.js` (CJS entry)

### Secondary (MEDIUM confidence)

- Node.js CJS-from-ESM named import interop — verified by known Node 18+ behavior and confirmed package entry point has no `exports` conditions blocking named import
- `node --test` test runner — confirmed from existing `test/parser.test.js` and `package.json` test script

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already specified in CLAUDE.md, versions confirmed via npm registry
- Architecture: HIGH — builds directly on existing Phase 1 patterns; code examples are concrete, not speculative
- Pitfalls: HIGH — Pitfalls 1–5 are from direct analysis of the proposed implementation; Pitfall 6 confirmed by Node CJS interop documentation

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (stable libraries, 90-day window)
