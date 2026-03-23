# Feature Research

**Domain:** Chrome bookmark cleaner / organizer (local web app, file-in / file-out workflow)
**Researched:** 2026-03-23
**Confidence:** MEDIUM-HIGH (ecosystem well-surveyed; specific implementation tradeoffs from multiple sources)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Parse Chrome bookmark HTML export | Entry point — without this, nothing works | LOW | Netscape Bookmark Format (NETSCAPE-Bookmark-file-1) with DL/DT/H3/A structure; `ADD_DATE` in Unix timestamps; npm packages `bookmarks-parser` and `netscape-bookmarks` exist |
| Dead link detection with clear pass/fail status | Users' primary pain: "is this still alive?" | HIGH | HEAD-first (fallback to GET for sites that reject HEAD); 5–10s timeout; 5–10 concurrent workers as default; respect `Retry-After` on 429; exponential backoff; treat connection refused + timeout + non-2xx as dead |
| Exact URL deduplication | Users know they have dupes; tool must find all of them | LOW | Normalize URL before comparison: lowercase host, strip default ports (:80/:443), remove UTM/tracking params (utm_*, fbclid, gclid), sort query params, strip trailing slash consistently |
| Export clean HTML file importable into Chrome | Final deliverable — without this, no value is delivered | LOW | Must produce valid Netscape Bookmark Format; Chrome is strict about structure |
| Progress indicator during link checking | Checking 1,000+ links takes minutes; blind wait is unacceptable | LOW | Show checked/total count + current URL being checked + estimated time remaining |
| Before/after view of what changed | Users need to know what was removed so they can trust the tool | MEDIUM | Side-by-side tree or summary diff showing: dead links removed, dupes removed, folders merged, items reclassified |
| Safety backup before any destructive action | Users have lost bookmarks to cleaner tools; trust requires safety net | LOW | Auto-export the original file on load; show "your original is saved at X" before any clean operation |
| Empty folder cleanup | Empty folders are clutter; users expect this to be handled | LOW | After all other operations, remove folders with zero children |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable — and aligned with this tool's core value proposition.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Fuzzy folder merge (similar names) | Most tools only do exact-name deduplication; "Dev Tools" + "Developer Tools" + "Development" are obviously the same | MEDIUM | Levenshtein or Jaro-Winkler distance on folder names; configurable threshold (default ~85% similarity); show user the proposed merges before applying; never auto-merge without review |
| Layered classification (domain rules → OG metadata → API fallback) | Automatically files bookmarks into sensible categories without requiring an API key for common sites | HIGH | (1) Built-in domain→category map for well-known domains (github.com→Dev, youtube.com→Video, etc.); (2) Extract `og:type`, `og:title`, meta description during the link-check fetch; (3) Free API (uClassify, Klazify) for genuinely unknown sites; no API key required for 80–90% coverage |
| Proposed folder hierarchy derived from the collection | No other file-based cleaner proposes a *new* structure; they only clean the existing one | HIGH | Propose max 3-level hierarchy; top-level from a fixed sensible taxonomy (see Taxonomy section); merge thin folders (<5 items) into parent or similar sibling; propose, don't enforce |
| Drag-and-drop editing of proposed structure | User gets final control; moves items between proposed folders before export | MEDIUM | Tree UI with drag-and-drop; rename folder; merge two folders by dragging one onto another; undo last action |
| Collapsed duplicate folder tree detection | When users have accidentally imported bookmarks twice, entire subtrees are duplicated — exact-URL dedup alone doesn't catch the structural duplication | HIGH | Compare folder trees structurally (same name, same URL children regardless of order); flag as duplicated subtree; propose deletion of redundant copy |
| URL normalization (tracking param stripping) | Bookmarks saved from email/social have UTM params; normalized duplication catches these | LOW | Strip utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, ref, source before dedup comparison; keep original URL in the output (just compare normalized) |
| Per-item manual override | User can disagree with any classification and move/keep/delete individual bookmarks | MEDIUM | Right-click context menu on any item in the proposed tree: move to different folder, mark as keep (lock), delete |
| Scan summary statistics | Shows the scale of cleanup: "1,247 checked, 89 dead (7%), 143 dupes removed, 12 folders merged" | LOW | Summary panel; gives users confidence the tool did real work |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems, increase scope unnecessarily, or undermine the core value.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-delete without review | "Just clean it for me" — users want zero friction | Irreversible data loss; users don't trust tools that silently delete; one bad false positive destroys trust permanently | Always show a review step; present proposed deletions as a list user must confirm; never delete without explicit confirmation |
| Cloud sync / account system | "Save my cleaned bookmarks in the cloud" | Completely changes the security model; users chose a local tool because bookmarks are sensitive (banking, private projects, personal accounts); cloud = new attack surface + GDPR complexity | File-in/file-out is the product; export the clean HTML and import into Chrome natively |
| Browser extension (live sync) | "Keep bookmarks clean automatically over time" | Extensions require different permissions model, manifest V3 constraints, Chrome Web Store review, ongoing maintenance; out of scope for v1 | File-based one-shot workflow is simpler, more portable, works for all Chromium-based browsers |
| Firefox/Safari format support | "I use Firefox too" | Different export formats, different attribute sets, significant parsing complexity for v1 | Chrome Netscape format only for v1; formats can be added later since parsing is isolated |
| AI-powered "smart" categorization (LLM) | "Use ChatGPT to categorize my bookmarks" | LLM API calls for 1,000 bookmarks = significant cost or rate limit pain; latency is high; requires API key; overkill when domain rules + OG metadata covers 80–90% | Layered approach (domain map → metadata → free API) achieves good coverage without LLM cost |
| Automatic scheduling / background cleanup | "Run this weekly" | Requires OS-level scheduling, persistent process, complex state management; turns a simple tool into a daemon | Instruct user to re-run manually when bookmarks get messy again; one-shot is the product |
| Tag system | "Let me tag bookmarks across folders" | Netscape bookmark format has no tag field; tags don't survive Chrome import/export round-trip; adds UI complexity | Folder hierarchy provides organization; keep it simple for what Chrome natively supports |
| Real-time link re-checking | "Check if a link is still live every time I open the app" | Running hundreds of concurrent HTTP requests on startup is hostile to networks and target servers | One-shot check per session; user re-runs the tool when needed |

---

## Domain-Specific Research Findings

### Dead Link Checking Strategy

Based on analysis of existing tools (AM-DeadLink, Bookmarks-Checker, KK Bookmark Checker, open-source checkers):

**Request strategy:**
- Start with HTTP HEAD (smaller response, faster); fall back to GET if HEAD returns 405 Method Not Allowed
- Follow up to 5 redirects; treat redirect chains that resolve to a 2xx as alive
- Status codes to treat as dead: connection refused, timeout, DNS failure, 4xx (except 401/403 which mean the page exists), 5xx
- Status codes to treat as alive: 2xx, 301/302/307/308 that resolve to 2xx, 401/403 (protected but present)
- Status codes requiring caution: 429 (rate-limited, not dead — back off and retry later)

**Concurrency:**
- Default 5–10 concurrent workers; configurable down to 1–2 for cautious mode
- Domain-level concurrency cap: max 2 concurrent requests to same domain to avoid triggering rate limits
- Timeout: 8–10 seconds per request (5s is too aggressive; some legitimate slow sites time out)
- Queue-based processing with a semaphore; emit progress events per completed check

**Rate limit handling:**
- On 429: respect `Retry-After` header if present; otherwise exponential backoff (1s, 2s, 4s, 8s) with jitter
- Don't mark 429 as dead — mark as "rate-limited, could not verify" and surface separately

### URL Deduplication Approach

Based on BrowserBookmarkChecker, bookmarks-dedupe, and URI normalization literature:

**Normalization pipeline (compare normalized, store original):**
1. Lowercase scheme and host
2. Remove default port (`:80` for http, `:443` for https)
3. Strip tracking query params: `utm_*`, `fbclid`, `gclid`, `ref`, `source`, `mc_*`
4. Sort remaining query params alphabetically
5. Remove trailing slash from path (except root `/`)
6. Decode percent-encoded characters that are safe to decode

**Deduplication scope:**
- Exact URL (post-normalization): definitive duplicate — remove silently (or flag)
- Same normalized URL, different title: flag for user review (one might be more descriptively titled)
- Same domain + nearly identical title (fuzzy): surface as "possible duplicate" for user decision

### Fuzzy Folder Name Merging

Based on BrowserBookmarkChecker (RapidFuzz, threshold 85) and general fuzzy matching literature:

**Algorithm:** Levenshtein distance or Jaro-Winkler (better for short strings like folder names)
**Threshold:** 80–90% similarity; configurable
**Implementation:** Compare lowercased, trimmed names; strip common prefixes/suffixes ("My ", "All ", "The ")
**User review required:** Never auto-merge folders; always present "Did you mean to merge these?" with user confirmation
**Edge cases:** Single-word folders ("Dev", "Design") are too ambiguous for fuzzy match — require higher threshold

### Classification Layers

Based on research into URL categorization approaches:

**Layer 1 — Domain rules map (HIGH confidence, zero latency):**
- Hard-coded map of well-known domains to categories
- Examples: `github.com`, `gitlab.com`, `stackoverflow.com` → Dev; `youtube.com`, `vimeo.com` → Video; `nytimes.com`, `bbc.com`, `reuters.com` → News
- Covers 40–60% of typical bookmark collections (power users heavily use a small set of popular domains)
- Build as a JSON file, easy to extend

**Layer 2 — Page metadata from link-check fetch (MEDIUM confidence, no extra cost):**
- Already fetching the page for dead-link checking — extract `og:type`, `og:title`, `og:description`, `<meta name="description">`, `<title>`
- Pass the combined text through keyword-category matching (e.g., words like "tutorial", "documentation", "docs" → Dev/Reference)
- Adds classification for sites not in the domain map with no extra network cost

**Layer 3 — Free classification API (LOW-MEDIUM confidence, API call required):**
- uClassify (free tier, requires account key); Klazify (IAB V2 taxonomy, has free tier)
- Only call for bookmarks that layers 1 and 2 could not classify
- Make this layer optional/opt-in — tool works without it
- uClassify uses a "Topics" classifier that maps to broad categories adequate for bookmark folders

**Comparison of approaches:**

| Approach | Accuracy | Cost | Latency | Requires Key? |
|----------|----------|------|---------|---------------|
| Domain rules map | HIGH for known domains; 0% for unknowns | None | Zero | No |
| OG/meta extraction | MEDIUM (depends on site quality) | None (piggybacks) | Already paying for link check | No |
| Free text classification API | MEDIUM-HIGH | Free tier limits | +100–500ms per call | Yes (free registration) |
| ML/LLM API (e.g., GPT) | HIGH | $$$ | +500ms–2s per call | Yes (paid) |

Recommendation: Domain rules → metadata → free API is the right layered approach. LLM is overkill for this task.

### Sensible Bookmark Taxonomy

Based on community patterns (Quora, Medium organization guides, Raindrop.io default collections, power-user recommendations):

**Recommended top-level categories (max 12–15):**

| Category | Typical Contents |
|----------|-----------------|
| Dev | GitHub, docs, tutorials, Stack Overflow, APIs, tools |
| Design | Dribbble, Figma resources, inspiration, UI libraries |
| Reading | Long-form articles, essays, newsletters, Substack |
| News | News outlets, current events, media |
| Reference | Wikipedia, documentation, RFCs, specs, how-tos |
| Video | YouTube, Vimeo, Twitch, courses |
| Shopping | Amazon, product pages, wishlists |
| Tools | SaaS products, utilities, web apps |
| Work | Project-specific links, internal tools, company resources |
| Finance | Banking, investing, financial tools |
| Social | Twitter/X, LinkedIn, forums, communities |
| Personal | Health, travel, hobbies, local |
| Inbox | Unclassified / "to sort later" catch-all |

**Taxonomy principles from research:**
- Max 3 levels deep (any deeper and users forget where things are)
- Max ~15 top-level folders (cognitive load limit)
- Merge thin folders (<5 items) into a parent or "Misc" sibling
- "Inbox" as a catch-all is better than leaving items unclassified
- The tool should derive the actual categories from the collection — not all users need all 15 categories

---

## Feature Dependencies

```
[Parse Chrome HTML]
    └──required by──> [Dead Link Checking]
    └──required by──> [URL Deduplication]
    └──required by──> [Folder Analysis]
    └──required by──> [Before/After UI]

[Dead Link Checking]
    └──provides data for──> [Metadata Extraction → Classification Layer 2]
    └──required before──> [Export] (don't export unchecked links as clean)

[URL Deduplication]
    └──required before──> [Proposed Hierarchy] (don't classify items that will be removed)

[Classification (all 3 layers)]
    └──required before──> [Proposed Hierarchy]

[Proposed Hierarchy]
    └──required before──> [Drag-and-Drop Edit UI]

[Drag-and-Drop Edit UI]
    └──required before──> [Export Clean HTML]

[Fuzzy Folder Merge]
    └──enhances──> [Proposed Hierarchy] (fewer redundant categories)
    └──requires──> [Parse Chrome HTML]

[Collapsed Duplicate Tree Detection]
    └──requires──> [URL Deduplication] (need normalized URLs to compare trees)
```

### Dependency Notes

- **Parse Chrome HTML is the root dependency:** Every other feature depends on it; must be solid before building anything else.
- **Dead link checking and classification share the HTTP fetch:** The link checker's response body provides OG/meta for classification Layer 2 — one network pass does both jobs.
- **Deduplication before classification:** No point classifying a URL that will be removed as a duplicate.
- **Classification before proposed hierarchy:** The folder proposals are driven by classification results.
- **Safety backup before UI renders:** The backup should be written as soon as the file is parsed, before the user sees results, so it is always there.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — validates the core loop: import → clean → review → export.

- [ ] Parse Chrome bookmark HTML export — without this, nothing works
- [ ] Dead link detection (HEAD/GET, 8s timeout, 5 workers, progress indicator) — primary user pain point
- [ ] Exact URL deduplication with normalization (tracking param stripping) — second primary pain point
- [ ] Empty folder cleanup — always expected
- [ ] Fuzzy folder name merging (with user confirmation step) — core differentiator from simple cleaners
- [ ] Classification Layer 1 only (domain rules map) — provides ~50% coverage with zero dependencies
- [ ] Proposed flat/shallow folder hierarchy from classification results — core value proposition
- [ ] Before/after tree UI (read-only diff view) — required for user trust
- [ ] Drag-and-drop editing of proposed structure — required for user control
- [ ] Export clean HTML file (Chrome-importable) — final deliverable
- [ ] Auto-backup of original on load — table stakes for trust

### Add After Validation (v1.x)

Features to add once core loop is proven to work.

- [ ] Classification Layer 2 (OG/meta extraction from link-check fetches) — nearly free, no extra cost; add once Layer 1 is stable
- [ ] Collapsed duplicate folder tree detection — valuable but complex; add when users with large collections report dupes that exact dedup misses
- [ ] Classification Layer 3 (free API fallback) — add if unclassified bookmark rate is too high in practice
- [ ] Per-item right-click context menu (move, keep, delete) — add when users report the tree editing is too coarse

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Firefox/Safari format support — format parsing is isolated; add if users request it
- [ ] Configurable concurrency / timeout settings UI — CLI flag is sufficient for v1
- [ ] Bookmark age analysis (sort by ADD_DATE, flag very old bookmarks for review) — interesting but not core
- [ ] Duplicate detection by content similarity (same article, different URLs) — very high complexity, marginal value

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Parse Chrome HTML | HIGH | LOW | P1 |
| Safety backup | HIGH | LOW | P1 |
| Dead link detection + progress | HIGH | MEDIUM | P1 |
| Exact URL dedup + normalization | HIGH | LOW | P1 |
| Empty folder cleanup | MEDIUM | LOW | P1 |
| Export clean HTML | HIGH | LOW | P1 |
| Before/after tree UI | HIGH | MEDIUM | P1 |
| Fuzzy folder name merge | HIGH | MEDIUM | P1 |
| Classification Layer 1 (domain map) | HIGH | LOW | P1 |
| Proposed hierarchy | HIGH | MEDIUM | P1 |
| Drag-and-drop edit | HIGH | MEDIUM | P1 |
| Classification Layer 2 (OG metadata) | MEDIUM | LOW | P2 |
| Duplicate folder tree detection | MEDIUM | HIGH | P2 |
| Classification Layer 3 (API) | MEDIUM | LOW | P2 |
| Per-item context menu | MEDIUM | MEDIUM | P2 |
| Age-based analysis | LOW | MEDIUM | P3 |
| Content-similarity dedup | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Chrome extension cleaners (KK, Bookmarks Detox, Bookmarks Clean Up) | AM-DeadLink (desktop app) | BrowserBookmarkChecker (open source CLI/GUI) | Our Approach |
|---------|------|------|------|------|
| Dead link checking | Yes, but often unreliable; no configurability | Yes, robust | No (offline-only) | Yes, HEAD+GET, configurable workers, 429 backoff |
| URL deduplication | Exact match only | Exact match | URL canonicalization + fuzzy title | Normalized exact + tracking-param strip |
| Fuzzy folder merge | "Bookmarks Clean Up" does exact-name merge only | No | Fuzzy title (not folder) | Fuzzy folder names with user review |
| Classification / reclassification | None | None | None | Layered: domain map → OG metadata → API |
| Proposed new hierarchy | None | None | None | Yes — core differentiator |
| Before/after UI | Flat list of changes | Report view | Export only | Side-by-side tree diff |
| Drag-and-drop editing | None | None | None | Yes, in proposed structure |
| Privacy / local-only | Extension = Chrome access | Desktop local | Fully local | Local Node.js, no cloud |
| Backup before delete | Rarely; some warn only | No | N/A | Auto-backup on load |
| Export for Chrome reimport | Via Chrome sync (indirect) | Yes | Yes | Yes, primary deliverable |

---

## Sources

- Chrome Web Store listings: Bookmarks Clean Up, Bookmark Detox, KK Bookmark Checker, Bookmark Dead Link Scanner
- [AM-DeadLink](https://www.aignes.com/deadlink.htm) — desktop dead link checker, v7.1 (Oct 2025)
- [BrowserBookmarkChecker on GitHub](https://github.com/VoxHash/BrowserBookmarkChecker) — URL canonicalization + RapidFuzz fuzzy matching approach
- [bookmarks-dedupe on GitHub](https://github.com/inversion/bookmarks-dedupe) — Chrome HTML deduplication
- [Netscape Bookmark Format parsers](https://github.com/FlyingWolFox/Netscape-Bookmarks-File-Parser) — format specification and npm packages
- [uClassify](https://www.uclassify.com/) — free text classification API
- [Klazify](https://www.klazify.com/) — URL/domain classification, IAB V2 taxonomy
- [URI normalization — Wikipedia](https://en.wikipedia.org/wiki/URI_normalization) — canonical normalization rules
- [Raindrop.io](https://raindrop.io/) — bookmark manager feature baseline
- [Bookmarker vs Raindrop.io comparison](https://bookmarker.cc/blog/bookmarker-vs-raindrop) — 2026 feature comparison
- Community patterns: Quora bookmark organization threads, Medium "organizing bookmarks" guides
- [HTTP 429 handling — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429)
- [Broken Link Checker — Apify](https://apify.com/automation-lab/broken-link-checker) — concurrency and timeout defaults reference

---

*Feature research for: Chrome bookmark cleaner / organizer (local web app)*
*Researched: 2026-03-23*
