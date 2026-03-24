# Phase 1: Foundation - Research

**Researched:** 2026-03-23
**Domain:** Node.js + Express 5 greenfield setup; Netscape Bookmark Format parsing with cheerio; browser file I/O; round-trip fidelity
**Confidence:** HIGH — all locked decisions already verified in project research files; this phase's scope is narrow and well-understood

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Landing page shows a drop zone plus a brief 2-3 line description of what the tool does (check links, merge folders, propose clean structure).
- **D-02:** Drop zone is the visual centrepiece — description is secondary text, not a feature list.
- **D-03:** After loading, show stats ("Loaded 1,234 bookmarks across 47 folders") plus a read-only collapsible tree of the original structure.
- **D-04:** The tree in Phase 1 is read-only and for orientation only — no editing. Folder nodes collapsible, leaf nodes show title + URL.
- **D-05:** Immediately auto-download a copy of the original file to the user's Downloads folder when the file is loaded — browser-triggered download, no server persistence needed. Label it `bookmarks-backup-YYYY-MM-DD.html`.
- **D-06:** Show a visible confirmation after download: "Original saved to Downloads as bookmarks-backup-2026-03-23.html".
- **D-07:** ESM (`"type": "module"` in package.json), Node >=20 pinned — all imports use `import`, not `require`.
- **D-08:** Express 5.x for HTTP server. Single server file serves static frontend and API routes.
- **D-09:** Parse bookmark HTML with cheerio — DIY parser, no dedicated bookmark library.
- **D-10:** Alpine.js loaded via CDN (no build step). Vanilla JS for DOM; no React/Vue/Svelte.
- **D-11:** `BookmarkNode` interface defined in `shared/types.js` — used on both server and client. Stages return new trees, never mutate.
- **D-12:** Round-trip test is a required success gate: parse original → export → re-parse export → assert identical bookmark and folder counts.

### Claude's Discretion

- Exact wording of the brief tool description on the landing page
- Drop zone visual styling (dashed border, icon, etc.)
- Tree expand/collapse UX details (expand-all button, initial collapse state)
- Server startup behaviour — use auto-open browser for convenience

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 1 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FILE-01 | User can load a Chrome bookmark HTML export via drag-and-drop or file picker | Browser File API / drag-and-drop events; multer or express built-in body parsing for upload endpoint |
| FILE-02 | App automatically saves a backup of the original file on load (shown to user before any action) | Browser `<a download>` trigger pattern; backup filename with date; visible confirmation message |
| FILE-03 | User can export the final bookmark tree as a Chrome-importable Netscape HTML file | Exporter: serialize BookmarkNode tree → Netscape HTML; `Content-Disposition: attachment` response header |
</phase_requirements>

---

## Summary

Phase 1 is a greenfield project foundation. All major technology choices are already locked (D-07 through D-12). The research task is to document exactly HOW to implement those choices correctly — particularly the cheerio-based Netscape Bookmark Format parser, the browser-side file drop/backup pattern, the exporter, and the round-trip validation test.

The Netscape Bookmark Format is technically malformed HTML (no closing `</DT>` tags, unusual `<DL>/<DT>/<H3>/<A>` nesting). Cheerio handles it gracefully via htmlparser2's lenient mode, but the recursive tree walk requires careful handling of sibling order and the implicit folder/link distinction. The export path has a known-bad pitfall: unescaped `&` in titles will silently break Chrome's importer.

The backup delivery (D-05) is a pure-browser operation. The server sends the original file content to the browser, and the browser triggers a download via a hidden `<a>` element — no server-side temp file needed. This must happen before any other UI state updates (D-06).

**Primary recommendation:** Build in this order: `shared/types.js` → parser → exporter → round-trip test → server skeleton → upload route → backup delivery → read-only tree display. The test is a first-class deliverable, not an afterthought.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=20 LTS | Runtime | Locked (D-07). Required for ESM stability, AbortSignal.timeout, p-limit v7 compatibility. |
| Express | 5.2.1 | HTTP server | Locked (D-08). Stable since Oct 2024. Async errors auto-forwarded to error middleware. |
| cheerio | 1.2.0 | Netscape Bookmark HTML parsing | Locked (D-09). Uses htmlparser2 v10 internally — lenient HTML parsing handles malformed bookmark format. Supports both ESM and CJS. |
| Alpine.js | 3.x (CDN) | Frontend reactivity | Locked (D-10). Zero build step. Handles drop zone state, file upload, tree expand/collapse, and confirmation messages. |
| multer | 1.4.5-lts.1 | Multipart file upload middleware | Express 5-compatible version. Parses `multipart/form-data` for the `POST /api/upload` endpoint. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uuid (or crypto.randomUUID) | built-in | Stable node IDs | Assign `id` to each BookmarkNode at parse time. `crypto.randomUUID()` is built-in since Node 19 / available since Node 14.17 — prefer built-in, no dependency. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| multer | express built-in `req.body` | Express 5 does not parse multipart out of the box — multer is required for file uploads |
| crypto.randomUUID() | `uuid` npm package | Both work; built-in preferred to keep dependency count low |
| Alpine.js CDN | Vanilla JS only | Alpine costs nothing (CDN) and saves verbose DOM event wiring for drop zone and tree state |

**Installation:**

```bash
npm install express cheerio multer
# p-limit not needed in Phase 1 — no concurrency required yet
```

```json
// package.json
{
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  }
}
```

**Version note:** express@5.2.1, cheerio@1.2.0, multer@1.4.5-lts.1 confirmed against npm registry in project STACK.md research (2026-03-23).

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope)

```
bookmark-cleaner/
├── server.js                  # Express entry point — serves static + API routes
├── src/
│   ├── shared/
│   │   └── types.js           # BookmarkNode interface (JSDoc or plain JS object shape)
│   ├── parser.js              # Netscape HTML string → BookmarkNode tree
│   ├── exporter.js            # BookmarkNode tree → Netscape HTML string
│   └── session.js             # In-memory session store (Map keyed by session ID)
├── public/
│   ├── index.html             # Landing page: drop zone + description + tree panel
│   └── app.js                 # Alpine.js component — drop zone, upload, tree render
├── package.json
└── test/
    └── round-trip.test.js     # Round-trip validation (parse → export → re-parse → count)
```

**Note on JavaScript vs TypeScript:** CONTEXT.md D-07 specifies ESM with `.js` imports. ARCHITECTURE.md uses `.ts` throughout its recommended structure. Given D-10 (no build step), the implementation should use plain `.js` with JSDoc type annotations for the `BookmarkNode` type, or a minimal `// @ts-check` approach. No TypeScript compilation step is acceptable.

### Pattern 1: Cheerio-Based Netscape Bookmark Parser

**What:** Walk the `<DL>/<DT>/<H3>/<A>` structure recursively to build a `BookmarkNode` tree.

**When to use:** On every `POST /api/upload`.

**Key cheerio insight:** The Netscape Bookmark Format is not well-formed HTML. `<DT>` tags are not closed, and `<DL>` nesting encodes folder hierarchy. htmlparser2 (used by cheerio) handles this gracefully in lenient mode. The selector strategy: for each `<DT>`, check if its first child is `<H3>` (folder) or `<A>` (link). If `<H3>`, find the immediately following `<DL>` sibling for children.

**Example:**
```javascript
// src/parser.js
// Source: cheerio docs + Netscape Bookmark Format spec
import * as cheerio from 'cheerio';
import { randomUUID } from 'crypto';

export function parseBookmarkHtml(html) {
  const $ = cheerio.load(html, { xmlMode: false });

  function parseList($dl) {
    const nodes = [];
    $dl.children('dt').each((_, dt) => {
      const $dt = $(dt);
      const $h3 = $dt.children('h3').first();
      const $a = $dt.children('a').first();

      if ($h3.length) {
        // Folder: find the next sibling <dl>
        const $childDl = $dt.next('dl');
        nodes.push({
          id: randomUUID(),
          type: 'folder',
          title: $h3.text(),
          addDate: $h3.attr('add_date') ? parseInt($h3.attr('add_date'), 10) : undefined,
          children: $childDl.length ? parseList($childDl) : [],
        });
      } else if ($a.length) {
        nodes.push({
          id: randomUUID(),
          type: 'link',
          title: $a.text(),
          url: $a.attr('href'),
          addDate: $a.attr('add_date') ? parseInt($a.attr('add_date'), 10) : undefined,
        });
      }
    });
    return nodes;
  }

  // Root <dl> is the top-level list
  const $root = $('dl').first();
  return {
    id: randomUUID(),
    type: 'folder',
    title: 'root',
    children: parseList($root),
  };
}
```

**Gotcha — `$dt.next('dl')` vs `.siblings('dl')`:** Chrome exports use an implicit nesting where the `<DL>` for a folder is a sibling of the `<DT>`, not a child. Use `.next('dl')` not `.children('dl')`. If `<DD>` tags appear (descriptions), they sit between `<DT>` and the `<DL>` — use `.nextAll('dl').first()` to be safe.

### Pattern 2: Netscape HTML Exporter

**What:** Serialize a `BookmarkNode` tree back to Netscape Bookmark HTML.

**When to use:** `GET /api/export` route + in-browser backup delivery.

**Critical requirement:** All title text and URL attribute values MUST be HTML-entity-escaped before output. Unescaped `&` in titles silently breaks Chrome's importer (Pitfall 6).

**Example:**
```javascript
// src/exporter.js
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function serializeNode(node, indent = 1) {
  const pad = '    '.repeat(indent);
  if (node.type === 'link') {
    const addDate = node.addDate ? ` ADD_DATE="${node.addDate}"` : '';
    return `${pad}<DT><A HREF="${escapeHtml(node.url)}"${addDate}>${escapeHtml(node.title)}</A>`;
  }
  // folder
  const addDate = node.addDate ? ` ADD_DATE="${node.addDate}"` : '';
  const children = (node.children || [])
    .map(child => serializeNode(child, indent + 1))
    .join('\n');
  return `${pad}<DT><H3${addDate}>${escapeHtml(node.title)}</H3>\n${pad}<DL><p>\n${children}\n${pad}</DL><p>`;
}

export function exportToNetscape(rootNode) {
  const children = (rootNode.children || [])
    .map(child => serializeNode(child, 1))
    .join('\n');
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${children}
</DL><p>`;
}
```

### Pattern 3: Browser-Side File Drop + Backup Trigger

**What:** HTML5 drag-and-drop + `<input type="file">` fallback. On file acceptance, send to server, receive the file content back from the server's echo (or use the original File object), then trigger a browser download for the backup.

**Key insight:** The backup download (D-05) can be triggered entirely in the browser using the original `File` object — no server round-trip needed for the backup itself. Upload the file to the server for parsing, but simultaneously (or on success) create a download link from the original `File` object.

**Example (Alpine.js component in app.js):**
```javascript
// public/app.js
document.addEventListener('alpine:init', () => {
  Alpine.data('bookmarkApp', () => ({
    status: 'idle',       // 'idle' | 'loading' | 'loaded' | 'error'
    stats: null,          // { bookmarkCount, folderCount }
    tree: null,           // BookmarkNode root
    backupName: '',
    errorMsg: '',

    async handleFile(file) {
      if (!file || !file.name.endsWith('.html')) {
        this.errorMsg = 'Please upload a Chrome bookmark HTML export file.';
        return;
      }
      this.status = 'loading';

      // Trigger backup download FIRST (D-05, D-06)
      this.backupName = `bookmarks-backup-${new Date().toISOString().slice(0, 10)}.html`;
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.backupName;
      a.click();
      URL.revokeObjectURL(url);

      // Upload to server for parsing
      const formData = new FormData();
      formData.append('bookmarks', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) { this.status = 'error'; this.errorMsg = await res.text(); return; }
      const data = await res.json();
      this.tree = data.tree;
      this.stats = data.stats;
      this.status = 'loaded';
    },

    // Drag and drop handlers
    onDrop(e) {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      this.handleFile(file);
    },
    onDragOver(e) { e.preventDefault(); },
  }));
});
```

**Why `URL.createObjectURL` for backup:** The browser has the original `File` object in memory. No need to upload and re-download — use it directly. This eliminates server storage of the file (privacy) and avoids a round-trip.

### Pattern 4: Upload Route + Stats Extraction

**What:** `POST /api/upload` receives the file, parses it, counts bookmarks and folders, stores tree in session, responds with tree + stats.

**Example:**
```javascript
// server.js (relevant excerpt)
import express from 'express';
import multer from 'multer';
import { parseBookmarkHtml } from './src/parser.js';

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload', upload.single('bookmarks'), (req, res) => {
  const html = req.file.buffer.toString('utf-8');
  const tree = parseBookmarkHtml(html);
  const stats = countNodes(tree);
  // store in session (simple Map keyed by session ID or single-user singleton)
  session.set('tree', tree);
  res.json({ tree, stats });
});

function countNodes(node) {
  let bookmarks = 0, folders = 0;
  function walk(n) {
    if (n.type === 'link') bookmarks++;
    else { folders++; (n.children || []).forEach(walk); }
  }
  walk(node);
  return { bookmarkCount: bookmarks, folderCount: folders };
}
```

### Pattern 5: Export Route

**What:** `GET /api/export` serializes the in-memory tree and returns it as a downloadable file.

**Example:**
```javascript
app.get('/api/export', (req, res) => {
  const tree = session.get('tree');
  if (!tree) return res.status(404).send('No bookmark file loaded.');
  const html = exportToNetscape(tree);
  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks-clean.html"');
  res.send(html);
});
```

### Pattern 6: Round-Trip Test

**What:** Node.js test script (or `node:test` built-in) that parses a fixture file, exports, re-parses, and asserts counts match.

**Example:**
```javascript
// test/round-trip.test.js
import { readFileSync } from 'fs';
import { strict as assert } from 'assert';
import { test } from 'node:test';
import { parseBookmarkHtml } from '../src/parser.js';
import { exportToNetscape } from '../src/exporter.js';

test('round-trip: bookmark and folder counts are identical', async () => {
  const original = readFileSync('./test/fixtures/sample-bookmarks.html', 'utf-8');
  const tree1 = parseBookmarkHtml(original);
  const exported = exportToNetscape(tree1);
  const tree2 = parseBookmarkHtml(exported);

  function count(node) {
    let b = 0, f = 0;
    function walk(n) {
      if (n.type === 'link') b++;
      else { f++; (n.children || []).forEach(walk); }
    }
    walk(node);
    return { b, f };
  }

  const c1 = count(tree1);
  const c2 = count(tree2);
  assert.equal(c2.b, c1.b, `bookmark count: expected ${c1.b}, got ${c2.b}`);
  assert.equal(c2.f, c1.f, `folder count: expected ${c1.f}, got ${c2.f}`);
});
```

**Run command:** `node --test test/round-trip.test.js`

### Anti-Patterns to Avoid

- **TypeScript with `tsc` build step:** Violates D-07/D-10 no-build constraint. Use plain `.js` with JSDoc if type safety is desired.
- **Saving the uploaded file to disk:** Privacy concern — process in memory only. Use `multer.memoryStorage()`.
- **Mutating the parsed tree:** D-11 locks this. Always return new objects from any transformation.
- **Using dedicated bookmark parser npm packages:** D-09 locks this. `bookmarks-parser` and `node-bookmarks-parser` are both unmaintained.
- **Using `require()` anywhere:** D-07 locks ESM — all files use `import`/`export`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multipart file upload parsing | Custom body parser for `multipart/form-data` | multer with `memoryStorage()` | Multipart parsing has boundary-detection, encoding, and streaming edge cases |
| Lenient HTML parsing of malformed bookmark file | Custom regex or string-split parser | cheerio (htmlparser2 under the hood) | The format has unclosed tags, optional `<DD>` nodes, and inconsistent whitespace — regex breaks on real files |
| Frontend reactivity (drop zone state, tree toggle) | Raw `addEventListener` + manual DOM | Alpine.js via CDN | Alpine's `x-data`/`x-show`/`x-for` handles tree expand/collapse with ~5 lines |

**Key insight:** The Netscape Bookmark Format looks simple but has well-documented edge cases (unclosed tags, irregular nesting, optional fields). A manual parser will fail on real-world Chrome exports. Cheerio is the right level of abstraction.

---

## Common Pitfalls

### Pitfall 1: Unescaped `&` in Bookmark Titles Breaks Chrome Import

**What goes wrong:** The exporter outputs `<A HREF="...">AT&T</A>`. Chrome's importer chokes on the bare `&`, silently drops that bookmark or truncates the title.

**Why it happens:** String concatenation without HTML encoding.

**How to avoid:** Run every title and URL through `escapeHtml()` before emitting. Test with a fixture containing `&`, `"`, `<`, `>` in titles.

**Warning signs:** Round-trip test shows fewer bookmarks after re-parse than before export.

### Pitfall 2: `$dt.children('dl')` Instead of `$dt.next('dl')`

**What goes wrong:** The folder's child list `<DL>` is a sibling of the `<DT>`, not a child. Using `.children('dl')` finds nothing; all folders appear as empty.

**Why it happens:** Assuming standard HTML nesting. Chrome's export places `<DL>` after the `<DT>`, at the same level.

**How to avoid:** Use `.nextAll('dl').first()` to find the child list. Verify with a Chrome-exported fixture that has at least 3 levels of nesting.

**Warning signs:** `folderCount` from stats equals actual count, but all folders show 0 children.

### Pitfall 3: `ADD_DATE` Stored as String Instead of Integer

**What goes wrong:** The exporter outputs `ADD_DATE="undefined"` or `ADD_DATE="NaN"` because `parseInt` received `undefined`.

**Why it happens:** Not all bookmarks in Chrome exports have `ADD_DATE` attributes. Defensive parsing is required.

**How to avoid:** `addDate: $a.attr('add_date') ? parseInt($a.attr('add_date'), 10) : undefined` — only set if attribute exists. In exporter: `const addDate = node.addDate ? \` ADD_DATE="${node.addDate}"\` : '';`

**Warning signs:** The exported HTML contains `ADD_DATE="NaN"` — Chrome will reject the file.

### Pitfall 4: multer Not Compatible with Express 5 Latest

**What goes wrong:** Some multer versions have middleware signature assumptions that conflict with Express 5's async error handling.

**Why it happens:** Express 5 changed `res.json()` and error propagation. multer 1.4.5-lts.1 is the maintained version that works with Express 5.

**How to avoid:** Pin `multer@1.4.5-lts.1` — do not use multer@2.x (not yet stable as of research date).

**Warning signs:** Upload endpoint throws `Cannot read property 'pipe' of undefined` or unhandled promise rejections.

### Pitfall 5: Browser Download Blocked by Pop-up Blocker

**What goes wrong:** The programmatic `a.click()` backup download is blocked by the browser's pop-up/download blocker when triggered outside a direct user gesture handler.

**Why it happens:** If the click happens after an `await` (async gap), some browsers demote it from a trusted user gesture.

**How to avoid:** Trigger the download link click synchronously at the START of `handleFile()`, before any `await`. The `File` object is already in memory — no async step needed for the backup download.

**Warning signs:** Backup download silently fails on first load; no file appears in Downloads.

### Pitfall 6: Session State Lost on Server Restart

**What goes wrong:** During development with `node --watch`, the server restarts on file save. The in-memory session Map is wiped. The export button returns 404.

**Why it happens:** Phase 1 uses in-memory session storage — correct for production (single-user, local tool), but inconvenient during dev.

**How to avoid:** This is acceptable in Phase 1. Document it in the server startup log: `console.log('Server started. Upload a bookmark file to begin.')`. No fix needed — just be aware.

---

## Code Examples

### BookmarkNode Type (shared/types.js)

```javascript
// src/shared/types.js
// Source: ARCHITECTURE.md data model — adapted to plain JS with JSDoc

/**
 * @typedef {Object} BookmarkNode
 * @property {string} id - Stable UUID assigned at parse time
 * @property {'folder'|'link'} type
 * @property {string} title
 * @property {string} [url] - Only present when type === 'link'
 * @property {number} [addDate] - Unix timestamp in seconds
 * @property {BookmarkNode[]} [children] - Only present when type === 'folder'
 * @property {'ok'|'dead'|'redirect'|'pending'} [linkStatus] - Set by Phase 3
 * @property {string} [category] - Set by Phase 4
 */

export {};  // marks this as an ES module
```

### Minimal Express Server Skeleton

```javascript
// server.js
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend
app.use(express.static(join(__dirname, 'public')));

// API routes
import uploadRouter from './src/routes/upload.js';
import exportRouter from './src/routes/export.js';
app.use('/api', uploadRouter);
app.use('/api', exportRouter);

app.listen(PORT, () => {
  console.log(`Bookmark Cleaner running at http://localhost:${PORT}`);
  // Auto-open browser (D-01 discretion item)
  import('open').then(m => m.default(`http://localhost:${PORT}`)).catch(() => {});
});
```

**Note on `open` package:** The `open` npm package (v10+) is ESM-compatible and opens a URL in the default browser. It is optional — if not installed, the server simply prints the URL. Install with `npm install -D open`.

### Alpine.js Read-Only Collapsible Tree (HTML fragment)

```html
<!-- Inside public/index.html, within x-data="bookmarkApp" scope -->
<template x-if="status === 'loaded'">
  <div>
    <p x-text="`Loaded ${stats.bookmarkCount} bookmarks across ${stats.folderCount} folders`"></p>
    <div class="tree-panel">
      <template x-for="node in tree.children" :key="node.id">
        <div x-data="treeNode(node)">
          <!-- Rendered by recursive Alpine component or vanilla JS -->
        </div>
      </template>
    </div>
  </div>
</template>
```

**Note on recursive Alpine trees:** Alpine.js `x-for` does not natively support recursive templates. For the read-only tree (D-04), use a vanilla JS recursive render function that produces DOM nodes, or a lightweight approach: render a flat indented list with `depth` passed as a prop. Full collapsible tree requires either: (a) a vanilla JS recursive DOM builder called from Alpine's `x-init`, or (b) server-side HTML rendering of the tree from the `/api/upload` response. Option (b) is simpler for Phase 1's read-only requirement.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node-fetch` for HTTP | Node.js built-in `globalThis.fetch` | Node 18 (stable) | No dependency; `AbortSignal.timeout()` built-in |
| TypeScript + `ts-node` | Plain JS + JSDoc, or `tsx` for TS | Ongoing preference | No compilation step needed for ESM projects |
| multer@1.x legacy | multer@1.4.5-lts.1 (LTS line) | 2023 | Maintained branch for Express 4/5 compatibility |
| `node:test` unavailable | `node:test` built-in test runner | Node 18+ | Round-trip test needs no jest/mocha |

**Deprecated/outdated:**
- `bookmarks-parser` (npm): Unmaintained — do not use. Parse with cheerio directly.
- `node-bookmarks-parser` (calibr): Dormant — do not use.
- `require()` / CommonJS: Locked out by D-07 (ESM only).

---

## Open Questions

1. **Recursive tree rendering with Alpine.js**
   - What we know: Alpine's `x-for` does not support recursive templates natively
   - What's unclear: Whether to use vanilla JS DOM rendering called from `x-init`, or server-side HTML rendering of the tree
   - Recommendation: For Phase 1's read-only tree, render the tree as HTML on the server side and return it as part of the `/api/upload` response (as a string), then inject it with `innerHTML`. This is the simplest approach that avoids Alpine recursion complexity. Phase 5 will replace with an editable tree component.

2. **Session ID strategy for single-user tool**
   - What we know: The project is explicitly single-user / local
   - What's unclear: Whether to use a session cookie, a fixed singleton, or a UUID per page load
   - Recommendation: Use a module-level singleton (`let currentSession = null`) in `session.js`. No cookies, no IDs. A new upload replaces the previous session. This is correct for the use case and avoids cookie management complexity.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js >=20 | Runtime (D-07) | Unknown — not verified in this environment | — | None — hard requirement |
| npm | Package install | Unknown | — | — |
| Browser with File API | FILE-01 drag-and-drop | Yes — all modern browsers | — | `<input type="file">` fallback |
| Browser `URL.createObjectURL` | FILE-02 backup download | Yes — all modern browsers | — | Server echo download |

**Note:** Node.js version must be >=20 per D-07. The planner should include a Wave 0 task: `node --version` check and emit a clear error if < 20.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (no install needed) |
| Config file | None required |
| Quick run command | `node --test test/round-trip.test.js` |
| Full suite command | `node --test test/*.test.js` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILE-01 | File accepted via drop zone / picker | smoke (manual) | Manual — browser interaction required | N/A |
| FILE-02 | Backup auto-downloaded on load | smoke (manual) | Manual — browser download verification | N/A |
| FILE-03 | Export produces Chrome-importable Netscape HTML | unit + round-trip | `node --test test/round-trip.test.js` | Wave 0 |
| D-12 | Round-trip: parse → export → re-parse → identical counts | unit | `node --test test/round-trip.test.js` | Wave 0 |

**Notes:**
- FILE-01 and FILE-02 require browser-level smoke testing — no automated DOM test is warranted for Phase 1. Verification is: run the server, load the browser, drop a file, confirm behavior.
- FILE-03 / D-12 are fully automatable via the round-trip test. This test is the primary Phase 1 gate.

### Sampling Rate

- **Per task commit:** `node --test test/round-trip.test.js`
- **Per wave merge:** `node --test test/*.test.js`
- **Phase gate:** Round-trip test green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/round-trip.test.js` — covers FILE-03 and D-12 (parse → export → re-parse count match)
- [ ] `test/fixtures/sample-bookmarks.html` — a minimal Chrome-exported bookmark fixture with at least 3 folder levels, 20+ links, and titles containing `&` and `"` characters

*(No framework install needed — `node:test` is built-in since Node 18)*

---

## Project Constraints (from CLAUDE.md)

| Directive | Source | Impact on Phase 1 |
|-----------|--------|--------------------|
| GSD workflow enforcement — use `/gsd:execute-phase` for planned work | CLAUDE.md | Planner must structure tasks as GSD-executable plans |
| No direct repo edits outside GSD workflow unless explicitly asked | CLAUDE.md | All code changes go through planned tasks |
| Tech stack: Node.js backend + browser frontend, no framework lock-in | CLAUDE.md / PROJECT.md | Confirmed: Express + Alpine.js. No React/Vue/Svelte. |
| No API key required for core flow | CLAUDE.md / PROJECT.md | Irrelevant for Phase 1 (no external APIs) |
| Self-contained: all processing local | CLAUDE.md / PROJECT.md | In-memory session, no disk writes for uploaded file |
| Conventions not yet established | CLAUDE.md | Phase 1 establishes conventions — document patterns as they emerge |

---

## Sources

### Primary (HIGH confidence)

- `.planning/research/STACK.md` — library versions verified against npm registry 2026-03-23: express@5.2.1, cheerio@1.2.0, p-limit@7.3.0
- `.planning/research/ARCHITECTURE.md` — BookmarkNode data model, build order, pipeline stage pattern
- `.planning/research/PITFALLS.md` — Chrome import failure modes (Pitfall 6), unescaped `&` in titles, `ADD_DATE` format requirements
- `.planning/phases/01-foundation/01-CONTEXT.md` — all D-01 through D-12 locked decisions

### Secondary (MEDIUM confidence)

- Netscape Bookmark Format spec (archiveteam.org) — `<DL>/<DT>/<H3>/<A>` nesting structure, doctype requirement, ADD_DATE as Unix timestamp
- cheerio docs (cheerio.js.dev) — htmlparser2 lenient mode; `.next()` vs `.children()` selector behavior
- Alpine.js docs (alpinejs.dev) — CDN install, `x-data`, `x-for`, `x-on` directives; confirmed v3.x CDN approach

### Tertiary (LOW confidence)

- Alpine.js recursive template limitation — based on known framework behavior; verify with a quick prototype during Wave 0 before committing to the server-side HTML rendering approach

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions locked in prior research, confirmed against npm registry
- Architecture: HIGH — BookmarkNode type and build order documented in ARCHITECTURE.md
- Parser patterns: MEDIUM-HIGH — cheerio selector behavior for malformed HTML verified against htmlparser2 lenient mode behavior; `.next('dl')` vs `.children('dl')` requires fixture test to confirm
- Alpine recursive tree: LOW — framework limitation is well-known, but specific workaround (server-side tree HTML) is a recommendation, not a verified pattern for this exact setup

**Research date:** 2026-03-23
**Valid until:** 2026-05-23 (stack is stable; Express 5, cheerio 1.x unlikely to release breaking changes in 60 days)
