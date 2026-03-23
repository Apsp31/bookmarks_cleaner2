# Project Research Summary

**Project:** Chrome Bookmark Cleaner
**Domain:** Local Node.js utility app — bookmark file processor with browser review UI
**Researched:** 2026-03-23
**Confidence:** HIGH

## Executive Summary

This is a local, single-user web application that implements a file-in / file-out workflow: the user uploads a Chrome bookmark HTML export, the server runs a sequential processing pipeline (parse → deduplicate → check links → classify → propose structure), and the user reviews and edits the proposed hierarchy in a browser UI before downloading the cleaned file. The recommended approach is Node.js + Express 5 on the server with Alpine.js on the client (loaded via CDN — no build step required). The pipeline is the core complexity; the UI is a reader/editor of its output. Every architectural and feature decision flows from one constraint: **the pipeline must run correctly before the UI has anything useful to show**.

The critical implementation insight from combined research is that the pipeline stages have a strict dependency order — parsing gates everything, deduplication must precede classification, and classification must precede restructuring. Within the link-checking stage, two design decisions must be made before writing a single line: concurrency control (global ceiling + per-domain ceiling) and the status interpretation model (403/429 are not dead; soft-404s are not alive). Getting either wrong after the fact is expensive to correct. The domain rules map for classification (Layer 1) must also be designed against a fixed taxonomy upfront — a free-form classifier produces taxonomy explosion that cannot be easily corrected post-implementation.

The product's key differentiators over existing tools are: (1) fuzzy folder name merging with user review, (2) a proposed new hierarchy rather than just cleaning the existing one, and (3) a fully editable before/after tree UI with drag-and-drop before export. These are high-complexity features that depend on the entire pipeline completing correctly. They should not be built until the core pipeline loop is validated end-to-end with a real bookmark file.

## Key Findings

### Recommended Stack

The stack is deliberately minimal. Express 5.2.1 (released stable October 2024) handles routing with built-in async/await error propagation. Alpine.js 3.x via CDN provides frontend reactivity with no build step — the "clone + npm start" portability constraint eliminates React, Vue, Svelte, and any tool requiring `npm run build`. For parsing the Netscape Bookmark Format, `cheerio@1.2.0` is the correct choice; dedicated bookmark parser npm packages (`bookmarks-parser`, `node-bookmarks-parser`) are unmaintained. Concurrency control for link checking uses `p-limit@7.3.0` (ESM-only, requires Node >=20 and `"type": "module"` in package.json). Folder name similarity uses `fastest-levenshtein@1.0.16` — it is a CJS package requiring a minor interop step in an ESM project. No classification API is required at launch; the domain rules map handles 40–60% of typical collections at zero cost and with zero latency.

**Core technologies:**
- Node.js >=20 LTS: runtime — required for stable fetch, `AbortSignal.timeout()`, and p-limit v7
- Express 5.2.1: HTTP server — async/await error propagation, no boilerplate vs raw http
- cheerio 1.2.0: Netscape Bookmark HTML parsing and OG/meta extraction from fetched pages
- p-limit 7.3.0: concurrency control for link checker — canonical solution, ESM-only
- fastest-levenshtein 1.0.16: folder name similarity scoring for fuzzy merge detection
- Alpine.js 3.x (CDN): frontend reactivity — zero build step, sufficient for tree panels and progress UI
- Node.js built-in fetch: HTTP client for link checking — stable since Node 18, no extra dependency

**What not to use:** `bookmarks-parser` (unmaintained), `node-bookmarks-parser` (dormant), `node-fetch` (superseded by built-in fetch), jQuery/jsTree, React/Vue/Svelte (require build step), uClassify URL API (deprecated), Klazify (100 free req/day — too restrictive for bulk checking).

### Expected Features

The product competes in a sparse category. Most Chrome extension cleaners do exact-URL deduplication and basic dead-link checking with no configurability. No existing tool proposes a new hierarchy or provides an editable before/after tree. The research confirms the core differentiator is real and uncontested.

**Must have (table stakes):**
- Parse Chrome bookmark HTML export (Netscape Bookmark Format) — without this, nothing works
- Dead link detection with pass/fail/uncertain status + real-time progress — primary user pain point
- Exact URL deduplication with tracking-param normalization — second primary pain point
- Auto-backup of original file on load — required for user trust
- Empty folder cleanup — always expected
- Before/after tree view — required for user confidence in the tool
- Export clean HTML file (Chrome-importable Netscape format) — final deliverable

**Should have (competitive):**
- Fuzzy folder name merging with user confirmation — differentiator; no existing tool does this
- Classification Layer 1: domain rules map — covers ~50% of collections at zero cost
- Proposed folder hierarchy (max 3 levels, max 15 top-level folders) — core value proposition
- Drag-and-drop editing of proposed tree with undo — required for user control before export
- Scan summary statistics — gives users confidence the tool did real work
- Classification Layer 2: OG/meta extraction piggybacked on link-check fetch — nearly free

**Defer (v2+):**
- Firefox/Safari format support — parsing is isolated but scope increase is real
- Classification Layer 3: free API fallback (uClassify text API) — add only if Layer 1+2 miss rate is high
- Duplicate folder tree detection (structural subtree comparison) — valuable but complex
- Per-item right-click context menu — add when tree drag-and-drop proves too coarse
- Configurable concurrency/timeout UI — CLI flag sufficient for v1
- Bookmark age analysis (ADD_DATE-based) — interesting but not core

**Anti-features to avoid:** auto-delete without user review, cloud sync, browser extension, LLM-powered classification, real-time link re-checking, tag system, automatic scheduling.

### Architecture Approach

The system is a pipeline server with a browser review UI. The server owns the source of truth: an in-memory session store holds `originalTree` (immutable after parse) and `proposedTree` (the pipeline's output, editable by user commands). The browser renders both trees and sends `EditCommand` objects to the server; the client applies commands optimistically and maintains an undo stack. Progress from the long-running link-checker stage is streamed to the browser via Server-Sent Events (SSE) — not WebSockets, which are bidirectional and unnecessary here. The pipeline runs asynchronously after file upload; the server returns `202 Accepted` immediately and the client polls the SSE stream for the `done` event before fetching the result trees.

**Major components:**
1. **Parser** — Netscape Bookmark HTML → internal `BookmarkNode` tree (stable UUIDs assigned at parse time)
2. **Deduplicator** — exact-URL deduplication with full normalization pipeline; pure function returning new tree
3. **Folder Merger** — fuzzy folder name matching (Jaro-Winkler/Levenshtein, ~85% threshold); proposes merges for user confirmation
4. **Link Checker** — concurrent HEAD/GET with p-limit (global ceiling: 10–20; per-domain ceiling: 1–2); streams progress via EventEmitter → SSE; collects OG/meta for classifier
5. **Classifier** — layered: domain rules map → OG/meta from link-check fetch → optional API fallback; maps to fixed 15-category taxonomy
6. **Restructurer** — builds proposed 3-level hierarchy from classification output; merges thin folders (<5 items)
7. **Pipeline Controller** — orchestrates stages in sequence; emits SSE progress events; holds session state
8. **Frontend Tree Panels** — left panel (original, read-only); right panel (proposed, drag-and-drop editable); diff annotations; undo/redo
9. **Exporter** — serializes `proposedTree` back to valid Netscape Bookmark HTML

**Key patterns:** Immutable pipeline stages (each returns a new tree, original always preserved); command-based client state (typed `EditCommand` discriminated union enables undo without a library); SSE for one-way progress (not WebSocket); `202 Accepted` + async pipeline (not synchronous upload-and-wait).

**Shared data model:** A single `BookmarkNode` type defined in `shared/types.ts` is the canonical representation used by every server stage and the client. Never flatten to an array — folder structure is the core output.

### Critical Pitfalls

1. **Soft 404s pass as alive** — Sites return HTTP 200 for deleted content. Probe each domain with a known-bad URL; check page title for "not found" signals; flag as "uncertain" if final redirect URL collapses to the domain root. Do not mark as alive based on status code alone.

2. **403/429 misinterpreted as dead links** — Anti-bot systems block automated requests. Treat 403 and 429 as "uncertain/blocked," not dead. Use browser-like User-Agent + Accept headers. Cap per-domain concurrency at 1–2. Respect `Retry-After` on 429. This architecture decision must be made before building the checker, not retrofitted.

3. **URL deduplication misses variants** — String equality misses `http` vs `https`, `www` vs non-www, trailing slash, UTM params, fragment anchors. Build and unit-test a normalization function covering all 7 variant patterns before wiring it to the pipeline.

4. **Classification taxonomy explosion** — Without a fixed taxonomy, the classifier invents near-synonym category names and the proposed tree has 30–40 redundant folders. Define the fixed 15-category taxonomy before implementing the classifier. Pass it as a constraint to any API call. This is non-trivially expensive to fix post-implementation.

5. **Chrome import rejects or mangles the output** — Wrong doctype, unescaped `&`/`<`/`>` in titles, non-Unix-timestamp `ADD_DATE`, mismatched `<DL>`/`<DT>` nesting. Validate with a round-trip parse test (export → parse → compare count) before shipping the exporter.

6. **Bulk link checker overwhelms network / triggers IP ban** — Unconstrained `Promise.all()` over 1000 URLs exhausts file descriptors and triggers CDN-level rate limits. Implement two-level concurrency from the start: global (10–15) + per-domain (1–2) ceiling. This is 10 extra lines; skipping it is never acceptable.

7. **Tree UI freezes at 1000+ bookmarks** — Naive full-DOM tree render with two panels causes browser freeze. Render trees collapsed by default. Use virtual scrolling for large expanded folders. Test with a real 1000-entry file during UI development.

## Implications for Roadmap

Based on combined research, the build order is dictated by hard dependencies. The pipeline must be complete and correct before the UI has anything to show. Each phase should be validated with a real bookmark file before proceeding.

### Phase 1: Foundation — Types, Parser, Exporter, Round-Trip Test
**Rationale:** `shared/types.ts` is the single dependency of everything else. The parser and exporter must be validated together — if the round-trip fails (parse → export → re-parse → count mismatch), every downstream phase is building on broken ground. This is the shortest path to a confidence check.
**Delivers:** A CLI that accepts a Chrome bookmark file and outputs a structurally identical clean file. Validates the file I/O contract.
**Addresses:** "Parse Chrome bookmark HTML export" and "Export clean HTML file" (both table stakes).
**Avoids:** Chrome import failure (Pitfall 6) — build and run the round-trip test here, not after the full UI is built.
**Research flag:** Standard patterns — well-documented. Skip phase research.

### Phase 2: Core Cleanup Pipeline — Deduplication, Folder Merger, Session Store, Basic API
**Rationale:** Deduplication and folder merging are pure functions with no external network calls. They can be built, tested, and validated against real data without any HTTP infrastructure. Wiring them to a basic API + in-memory session store produces the first end-to-end server flow.
**Delivers:** Server accepts file upload, runs dedup + folder merge, serves result tree via GET /api/tree. No UI yet — validate via curl or a minimal upload form.
**Addresses:** Exact URL deduplication (table stakes), fuzzy folder merge (differentiator), auto-backup on load.
**Avoids:** URL normalization misses (Pitfall 4) — unit-test the normalization function in this phase against all 7 variant patterns.
**Research flag:** Standard patterns. Skip phase research.

### Phase 3: Link Checker + SSE Progress
**Rationale:** Link checking is the longest-running and most complex stage. It must be built and tuned before classification (which piggybacks on its fetched metadata). The SSE infrastructure required here is also needed for overall pipeline progress.
**Delivers:** Concurrent link checker with HEAD/GET fallback, per-domain concurrency cap, 429/403 "uncertain" handling, soft-404 detection, redirect capture, real-time SSE progress stream to browser.
**Addresses:** Dead link detection with progress indicator (highest-priority table stake).
**Avoids:** Bot blocking misinterpreted as dead (Pitfall 2), bulk network overload (Pitfall 8), redirect chain not captured (Pitfall 3), soft-404s passing as alive (Pitfall 1). All four must be designed in, not added later.
**Research flag:** Needs careful implementation review. The per-domain concurrency, soft-404 probe, and status interpretation model are all non-trivial. Consider a focused research-phase spike on the HTTP engine before building.

### Phase 4: Classifier + Restructurer + Proposed Tree Display
**Rationale:** Classification depends on the link checker's OG/meta output. The restructurer depends on classification. Both must complete before the proposed tree has real content. The taxonomy must be finalized before writing a line of classifier code.
**Delivers:** Domain rules map (Layer 1), keyword-based OG/meta classifier (Layer 2), fixed-taxonomy category assignment, proposed 3-level hierarchy with thin-folder merging, right-panel read-only display.
**Addresses:** Classification Layer 1 (P1), proposed folder hierarchy (P1), scan summary statistics.
**Avoids:** Classification taxonomy explosion (Pitfall 5) — define and lock the 15-category list before implementation begins.
**Research flag:** Taxonomy design needs a deliberate design decision before coding. No additional research phase needed if taxonomy is agreed upfront.

### Phase 5: Editable UI — Drag-and-Drop, Undo, Diff, Export
**Rationale:** The full review loop (edit → undo → export) can only be built once both tree panels have real data. This is the phase where the product becomes usable end-to-end.
**Delivers:** Drag-and-drop tree editing with undo stack, diff highlight annotations between original and proposed tree, before/after side-by-side view, Export button downloads cleaned bookmark HTML, empty folder cleanup.
**Addresses:** Drag-and-drop editing (P1), before/after tree UI (P1), export (P1), empty folder cleanup (table stakes).
**Avoids:** Tree UI freeze at scale (Pitfall 9) — collapsed-by-default and virtual scroll must be implemented from the start, not bolted on. Test with a real 1000-entry file before calling this phase done.
**Research flag:** `sortable-tree` (vanilla TypeScript drag-drop) is the identified library. Alpine.js handles the rest. Standard patterns apply. Skip phase research unless virtual scroll integration proves complex.

### Phase Ordering Rationale

- **Types before everything:** `BookmarkNode` and `EditCommand` are consumed by every module; defining them first prevents drift between server and client.
- **Parser + Exporter together:** Round-trip validation in Phase 1 catches format bugs before any pipeline logic is layered on top.
- **Pure pipeline stages before HTTP:** Deduplication and folder merging are side-effect-free functions; validate them cheaply before adding network complexity.
- **Link checker before classifier:** The classifier's Layer 2 (OG/meta) reuses data the link checker already fetches; building them in order avoids redundant fetch infrastructure.
- **Classifier/restructurer before editable UI:** The edit UI needs real proposed-tree data to be meaningful; building it against mock data produces UI that may not handle real data shapes.
- **Pitfall-driven design gates:** Pitfalls 1, 2, 4, 5, and 9 each represent decisions that are expensive to retrofit. Phases 1–4 are structured so each pitfall is addressed in the phase where it first matters.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Link Checker):** The HTTP engine design has multiple interacting constraints (global concurrency, per-domain concurrency, soft-404 probe, 429 backoff, redirect chain capture). A focused spike — building and testing the checker against a real 100-URL sample — is recommended before committing to the full implementation. The pitfalls here are the hardest to retrofit.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** cheerio parsing and HTML generation are well-documented. Round-trip test pattern is straightforward.
- **Phase 2 (Core Cleanup):** Deduplication and fuzzy matching are pure algorithmic functions. p-limit and fastest-levenshtein are stable libraries with clear APIs.
- **Phase 4 (Classifier):** Well-documented layered approach; main risk is taxonomy design (a design decision, not a research question).
- **Phase 5 (UI):** Alpine.js + sortable-tree are well-documented. Virtual scroll with TanStack Virtual is standard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core packages verified against npm registry. Express 5.2.1, p-limit 7.3.0, cheerio 1.2.0 all confirmed current. ESM/CJS interop issue with fastest-levenshtein is documented with two clear solutions. |
| Features | MEDIUM-HIGH | Competitor analysis is thorough. Feature boundaries are well-reasoned. Classification Layer 2 (OG/meta) quality depends on site quality — real-world coverage rate is an estimate (40–60%), not a measured figure. |
| Architecture | HIGH | Patterns (SSE, immutable pipeline, command-based undo, 202+async) are well-established and verified against current documentation. `sortable-tree` library is identified but not deeply evaluated for edge cases. |
| Pitfalls | HIGH | Link checking, deduplication, and export pitfalls are specific and actionable with sources. UI scale pitfall has concrete thresholds. Classification drift pitfall has a clear prevention strategy. |

**Overall confidence:** HIGH

### Gaps to Address

- **Classification Layer 2 real-world coverage:** Research estimates 40–60% domain-map coverage for typical bookmark collections, but this depends heavily on the user's bookmarking habits. The actual unclassified rate after Layer 1+2 won't be known until tested against real data. Plan to measure and add Layer 3 (API) if the unclassified rate exceeds ~20%.
- **fastest-levenshtein CJS interop:** In an ESM project (`"type": "module"`), this package requires either a dynamic `import()` or switching to `leven` (ESM-native alternative). Confirm the approach works in practice during Phase 2 before depending on it.
- **sortable-tree library depth:** The architecture recommends `sortable-tree` for drag-and-drop but it has not been deeply evaluated for behavior with large trees, synchronized scroll, or Alpine.js integration. Validate during Phase 5 setup; have vanilla fallback plan.
- **Soft-404 probe reliability:** The technique of probing a known-bad URL at each domain works for many sites but may itself be blocked by WAFs. The probe adds one extra request per domain. Confirm the probe adds acceptable overhead before enabling it by default.

## Sources

### Primary (HIGH confidence)
- Express 5 stable release: https://expressjs.com/2024/10/15/v5-release.html
- p-limit GitHub: https://github.com/sindresorhus/p-limit — v7.3.0, ESM-only, Node>=20
- Alpine.js installation docs: https://alpinejs.dev/essentials/installation — CDN approach confirmed
- cheerio npm registry: https://registry.npmjs.org/cheerio/latest — v1.2.0
- Express npm registry: https://registry.npmjs.org/express/latest — v5.2.1
- SSE vs WebSocket comparison (RxDB): https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html
- SSE with Express.js: https://amd.codes/posts/real-time-updates-with-sse-and-express-js
- Node.js fetch stability: https://blog.logrocket.com/fetch-api-node-js/
- sortable-tree: https://github.com/marcantondahmen/sortable-tree
- TanStack Virtual: https://tanstack.com/virtual/latest
- Netscape Bookmark Format quirks: http://fileformats.archiveteam.org/wiki/Netscape_bookmarks
- Shaarli >3000 entry performance issue: https://github.com/shaarli/Shaarli/issues/985

### Secondary (MEDIUM confidence)
- BrowserBookmarkChecker (GitHub) — fuzzy folder matching approach, RapidFuzz threshold 85
- bookmarks-dedupe (GitHub) — URL canonicalization patterns
- AM-DeadLink v7.1 — competitor dead link checker feature baseline
- Cloudflare bot detection patterns: https://developers.cloudflare.com/waf/tools/user-agent-blocking/
- check-links npm — concurrency and timeout reference defaults
- broken-link-checker npm — per-host concurrency limiting pattern
- URI normalization: https://en.wikipedia.org/wiki/URI_normalization
- Raindrop.io default collections — bookmark taxonomy reference
- Chrome Web Store listings: Bookmarks Clean Up, Bookmark Detox, KK Bookmark Checker

### Tertiary (LOW confidence — validate during implementation)
- uClassify text API (free tier, 500 calls/day) — classification Layer 3 fallback; longevity uncertain
- Classification Layer 2 coverage estimate (40–60%) — based on general bookmark collection patterns, not measured data
- Soft-404 probe technique: https://github.com/benhoyt/soft404 — principle validated; WAF interaction with probe requests is not characterized

---
*Research completed: 2026-03-23*
*Ready for roadmap: yes*
