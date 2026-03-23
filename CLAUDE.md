<!-- GSD:project-start source:PROJECT.md -->
## Project

**Bookmark Cleaner**

A local web app that takes an exported Chrome bookmark HTML file and produces a clean, well-organised version. It checks every link for validity, deduplicates entries and folders, merges similar folder names, and re-classifies bookmarks into a sensible hierarchy — then presents a side-by-side before/after tree so the user can review and tweak before exporting.

**Core Value:** A single clean, importable bookmark file where every link works, nothing is duplicated, and everything is filed where you'd actually look for it.

### Constraints

- **Tech stack**: Node.js backend + browser frontend — no framework lock-in required
- **No API key required for core flow**: classification API is an enhancement, not a dependency
- **Folder depth**: proposed hierarchy should be max 3 levels deep
- **Self-contained**: all processing local, no data leaves the machine except URL health checks
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | >=20 LTS | Runtime | Required for built-in `fetch` stability, `AbortSignal.timeout()`, ESM support, and p-limit v7. Node 22 is current LTS as of 2025. |
| Express | 5.2.1 | HTTP server | Released stable Oct 2024. Async/await error propagation built in (rejected promises auto-forwarded to error middleware). Far less boilerplate than raw `http`. Fastify's performance advantage is irrelevant for a single-user local tool. |
| Alpine.js | 3.x (CDN) | Frontend reactivity | Zero build step — one `<script defer>` tag in HTML. Provides `x-data`, `x-for`, `x-on`, and reactive state sufficient for tree panel interaction and status updates without React/Vue overhead. ~15KB. |
| Node.js built-in `fetch` | (built-in, Node 18+) | Link checking HTTP client | Stable since Node 18, no extra dependency. `AbortSignal.timeout(ms)` available since Node 17.3. Use for the link-checking pipeline. |
| p-limit | 7.3.0 | Concurrency control | The canonical solution for capping concurrent async operations. ESM-only; requires `"type": "module"` in `package.json` or `.mjs` extension. v7 requires Node >=20. Limit to 20–50 concurrent fetch requests to avoid hammering remote servers. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cheerio | 1.2.0 | Bookmark HTML parsing + page metadata extraction | Parse the Netscape Bookmark File (NETSCAPE-Bookmark-file-1 format) — use Cheerio to walk `<DL>` / `<DT>` / `<A>` / `<H3>` structure. Also extract Open Graph / `<meta>` tags from fetched pages for classification. No DOM sandbox needed. |
| fastest-levenshtein | 1.0.16 | Folder name similarity scoring | Raw Levenshtein distance for comparing folder name pairs. Provides `distance(a, b)` and `closest(needle, haystack)`. Use to detect merge candidates: `distance("Dev Tools", "Developer Tools")` → small integer → flag for merge. Stable; no recent updates needed as algorithm is settled. |
| Alpine.js | 3.x (CDN) | UI reactivity | Loaded via CDN `<script>` — no npm install required. Handles tree expand/collapse, file upload state, progress display, and form inputs for the review panel. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| nodemon | Dev auto-restart | `npx nodemon server.js` — no install needed, or `npm install -D nodemon`. Avoids manual restarts during development. |
| Node.js --watch flag | Alternative to nodemon | Built-in since Node 18: `node --watch server.js`. Zero dependencies, sufficient for this project. |
## Installation
# Core server + parsing
# No frontend npm install needed — Alpine.js loaded via CDN in HTML
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Express 5.2.1 | Fastify | If you need >10K req/s throughput or strict JSON schema validation. Irrelevant for a single-user local tool. |
| Express 5.2.1 | Raw `node:http` | If you want zero dependencies. Express adds ~50KB but saves significant routing boilerplate; worth it for any multi-route server. |
| Built-in `fetch` | `got` | If you need automatic retries with backoff, redirect chains, or HTTP/2 support. `got` is excellent but adds a dependency; built-in fetch + manual retry is sufficient for link checking. |
| Built-in `fetch` | `axios` | Axios is a fine choice but the browser/Node isomorphism benefit is irrelevant for a backend-only link checker. No reason to add it. |
| Alpine.js (CDN) | htmx | htmx is better when the server renders partial HTML for every interaction. This UI is SPA-like — Alpine's client-side state model fits better for the interactive tree panels. |
| Alpine.js (CDN) | Vanilla JS | Viable for simple cases, but managing tree expand/collapse and live progress updates with raw DOM manipulation gets verbose quickly. Alpine costs nothing to load via CDN. |
| Alpine.js (CDN) | React/Vue/Svelte | All require a build step (Vite/webpack). Eliminated: the constraint is "no build step, clone + npm start." |
| cheerio | Dedicated bookmark parser libs (`bookmarks-parser`, `node-bookmarks-parser`) | Both are effectively unmaintained (last updated 2–4+ years ago, low stars, no recent releases). The Netscape Bookmark Format is simple HTML; parse it directly with cheerio — you control the logic and there are no abandoned-library surprises. |
| fastest-levenshtein | Fuse.js | Fuse.js excels at fuzzy search across multi-field objects with scoring weights. Folder name similarity is a simpler problem: you have two strings and need an edit distance. Fuse.js is overkill; fastest-levenshtein is faster and has a smaller footprint. |
| fastest-levenshtein | uFuzzy | uFuzzy is excellent for fuzzy *search* (needle in a haystack). For pairwise folder-name *comparison*, raw edit distance is a better primitive. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `bookmarks-parser` (npm) | Inactive maintenance (Snyk: inactive, no releases in 12+ months). Adds a dependency on unmaintained code for a format trivially parseable with cheerio. | Parse Netscape Bookmark HTML directly with cheerio |
| `node-bookmarks-parser` (calibr) | 52 stars, dormant, no recent commits. Same problem. | Parse directly with cheerio |
| uClassify URL API | The URL API has been deprecated per their own docs. The text classification API still works (500 calls/day free) but is a niche service with uncertain longevity. | Use as an optional last-resort fallback only. Primary classification should be: (1) domain rules map, (2) Open Graph / meta tags from fetched pages. API is a nice-to-have, not a dependency. |
| Klazify (URL classification) | Only 100 free requests/day on the web platform; API access requires paid plan. Too restrictive for processing hundreds of bookmarks. | Domain rules map + page metadata covers 80–90% of bookmarks without any API. |
| jsTree | Requires jQuery. jQuery is a build-era dependency with no place in a no-build-step UI. | Build the tree UI with Alpine.js + vanilla DOM APIs, or use a lightweight vanilla alternative. |
| React / Vue / Svelte | All require a build pipeline (npm run build, Vite, etc.). Violates the "clone + npm start" portability constraint. | Alpine.js via CDN |
| `node-fetch` | Was needed before Node 18 native fetch stabilized. Now redundant — just use the built-in `globalThis.fetch`. | Built-in `fetch` |
## Stack Patterns by Variant
- Use `tsx` (not `ts-node`) for running TypeScript directly: `npx tsx server.ts`
- p-limit and Express 5 both have excellent TypeScript types bundled or on `@types/express`
- Keep `"type": "module"` — TypeScript + ESM works cleanly with `moduleResolution: "node16"` or `"bundler"`
- Start without any API integration; domain rules map + Open Graph metadata handles the majority
- Add uClassify text API as a fallback only for unknowns (title + description as input, not URL)
- Gate the API call: only invoke if domain map and OG tags both fail to yield a confident category
- Start with `p-limit` concurrency of 20
- Tune down to 10 if you see timeout spikes (some servers throttle rapid requests)
- Log response times per domain to detect problematic hosts early
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| p-limit@7.3.0 | Node.js >=20 | ESM only. Requires `"type": "module"` in package.json. |
| p-limit@7.3.0 | express@5.2.1 | No conflict — server and link checker are separate concerns. |
| cheerio@1.2.0 | Node.js >=18 | Uses htmlparser2 v10 internally. ESM and CJS both supported. |
| express@5.2.1 | Node.js >=18 | Express 5 dropped support for Node <18. |
| fastest-levenshtein@1.0.16 | Node.js any | CJS module, no ESM issues even in `"type": "module"` projects (use `createRequire` or rename to `.cjs` if needed). |
| Alpine.js 3.x (CDN) | any browser | No Node.js dependency — runs purely in the browser. |
### Note on ESM and fastest-levenshtein
## Sources
- Express 5 stable release: https://expressjs.com/2024/10/15/v5-release.html — confirmed v5.2.1 via npm registry
- p-limit GitHub + package.json: https://github.com/sindresorhus/p-limit — confirmed v7.3.0, ESM-only, Node>=20
- Alpine.js installation docs: https://alpinejs.dev/essentials/installation — confirmed v3.x CDN approach, no build step
- bookmarks-parser maintenance status: https://snyk.io/advisor/npm-package/bookmarks-parser — confirmed inactive
- cheerio npm registry: https://registry.npmjs.org/cheerio/latest — confirmed v1.2.0
- Express npm registry: https://registry.npmjs.org/express/latest — confirmed v5.2.1
- fastest-levenshtein: https://github.com/ka-weihe/fastest-levenshtein — confirmed v1.0.16, last updated 4 years ago (algorithm is stable, not a concern)
- Node.js fetch stability: https://blog.logrocket.com/fetch-api-node-js/ — stable since Node 18, AbortSignal.timeout since 17.3
- uClassify URL API deprecation: https://www.uclassify.com/docs/urlapi — confirmed URL API deprecated; text API still active
- Express vs Fastify 2025: https://betterstack.com/community/guides/scaling-nodejs/fastify-express/ — performance gap irrelevant for local single-user tool
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
