# Bookmark Cleaner

A local web app that takes an exported Chrome bookmark file and produces a clean, well-organised version — every link checked, duplicates removed, folders merged, and bookmarks re-classified into a sensible hierarchy.

**No account. No cloud. Nothing leaves your machine except the URL health checks.**

## What it does

| Step | What happens |
|------|-------------|
| **Upload** | Parse your Chrome bookmark export (Netscape HTML format) |
| **Cleanup** | Remove exact duplicate bookmarks, detect near-duplicate folder names (Levenshtein), collapse identical subtrees |
| **Link check** | HEAD-check every URL concurrently; mark dead links (non-2xx, timeout, connection refused) |
| **Classify** | Re-file bookmarks into a category hierarchy using a 329-entry domain rules map, URL path/subdomain hints, and page metadata fallback |
| **Review** | Side-by-side before/after tree — drag folders to reorder, right-click to delete/keep/move |
| **Export** | Download a clean, importable Chrome bookmark HTML file |

## Requirements

- Node.js ≥ 20

## Quick start

```bash
git clone https://github.com/Apsp31/bookmarks_cleaner2.git
cd bookmarks_cleaner2
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Export your bookmarks from Chrome**
   Chrome menu → Bookmarks → Bookmark manager → ⋮ → Export bookmarks
   Saves a `.html` file.

2. **Upload** the file on the home page.

3. **Run Cleanup** — removes duplicates and merges similar folder names. Review any flagged merge candidates before approving.

4. **Check Links** — concurrent HEAD checks with a live progress counter. Dead links are flagged in the tree; you choose what to delete.

5. **Classify** — bookmarks are re-filed into categories. Folders prefixed with `-` are preserved as-is (opt in to reclassify via the toggle badge). Large categories (e.g. Development) are automatically split into sub-folders.

6. **Review** the proposed structure in the right panel:
   - Drag folders to reorder within the same level
   - Right-click a folder or bookmark for delete / keep / move options

7. **Export** — download the clean `.html` file and import it into Chrome (Bookmark manager → ⋮ → Import bookmarks).

## Features

- **Deduplication** — exact URL match (after normalisation) + fuzzy folder-name merging + SHA-256 subtree fingerprinting
- **Link checker** — HEAD-first with GET fallback; `401`/`403` treated as alive, `429` as uncertain; configurable concurrency via p-limit
- **Classifier** — 329-domain rules map → OG metadata → URL path/subdomain hints → source folder name fallback
- **Sub-categorisation** — Development folders with 20+ links are split into Frontend / Backend / DevOps·Cloud / Tools / Learning / AI·ML automatically
- **Hyphen-prefix preservation** — folders named `-Archive`, `-Pinned`, etc. are kept in place; opt-in reclassification per folder
- **Drag-and-drop** — native HTML5 drag for folder reordering with a visual drop indicator
- **No build step** — Alpine.js loaded via CDN; clone → `npm install` → run

## Development

```bash
npm run dev      # auto-restart on file changes (node --watch)
npm test         # run all tests (node:test, ~243 assertions)
```

## Tech stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js 20+ / Express 5 |
| Frontend | Alpine.js 3 (CDN) |
| Parsing | cheerio |
| Concurrency | p-limit |
| Fuzzy matching | fastest-levenshtein |
| Tests | node:test + node:assert/strict |

## Project structure

```
server.js          # Express entry point
src/
  classifier.js    # Domain rules, keyword matching, fuzzyMatchCategory
  dedup.js         # URL normalisation, dedup walk, subtree fingerprinting
  exporter.js      # Netscape HTML serialiser
  fuzzy.js         # Folder-name similarity scoring
  hierarchyBuilder.js  # Category grouping, sub-taxonomy, deterministic IDs
  linkChecker.js   # Concurrent HEAD/GET checker, OG metadata extraction
  parser.js        # Netscape Bookmark HTML → tree
  session.js       # In-memory session singleton
  routes/          # Express routers (upload, cleanup, merge, check, classify, edit, export)
  shared/          # treeOps (deleteNode, moveNode, reorderNode, …), types
public/
  index.html       # Single-page UI
  app.js           # Alpine.js state, renderTree, drag-and-drop
test/              # One test file per module + golden-file regression
```
