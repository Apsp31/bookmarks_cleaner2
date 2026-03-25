/**
 * Classifier Pipeline
 *
 * Exports:
 *   DOMAIN_RULES              – plain object mapping hostname → category label (~300 entries)
 *   CATEGORY_KEYWORDS         – object mapping category → keyword array (ordered specific-first)
 *   classifyByDomain(url)     – looks up hostname in DOMAIN_RULES, strips www. prefix
 *   classifyByMetadata(m)     – keyword-scans OG title+description, returns first match or null
 *   classifyByPath(url)       – matches URL path/subdomain patterns as 3rd fallback step
 *   fuzzyMatchCategory(name)  – fuzzy-matches a folder name against the 10 standard categories
 *   classifyNode(node, src)   – chains domain→metadata→path→folder fallback→'Other'
 *   classifyTree(node)        – deep-walks BookmarkNode tree, classifying all link nodes
 */

import { distance } from 'fastest-levenshtein';

// ─── Domain rules map ─────────────────────────────────────────────────────────
// Keys are bare hostnames (no www. prefix — classifyByDomain strips www. before lookup)
// Categories: Development, Video, Social / Community, News, Shopping, Tools,
//             Reference, Design, Finance, Learning

export const DOMAIN_RULES = {
  // Development
  'github.com':             'Development',
  'gitlab.com':             'Development',
  'bitbucket.org':          'Development',
  'stackoverflow.com':      'Development',
  'stackexchange.com':      'Development',
  'developer.mozilla.org':  'Development',
  'npmjs.com':              'Development',
  'pypi.org':               'Development',
  'crates.io':              'Development',
  'rubygems.org':           'Development',
  'pkg.go.dev':             'Development',
  'docs.python.org':        'Development',
  'docs.rs':                'Development',
  'devdocs.io':             'Development',
  'replit.com':             'Development',
  'codepen.io':             'Development',
  'jsfiddle.net':           'Development',
  'codesandbox.io':         'Development',
  'vercel.com':             'Development',
  'netlify.com':            'Development',
  'heroku.com':             'Development',
  'docker.com':             'Development',
  'hub.docker.com':         'Development',
  'kubernetes.io':          'Development',
  'aws.amazon.com':         'Development',
  'cloud.google.com':       'Development',
  'azure.microsoft.com':    'Development',
  'digitalocean.com':       'Development',
  'terraform.io':           'Development',
  'graphql.org':            'Development',
  'openai.com':             'Development',
  'huggingface.co':         'Development',
  'angular.io':             'Development',
  'vuejs.org':              'Development',
  'reactjs.org':            'Development',
  'svelte.dev':             'Development',
  'nextjs.org':             'Development',
  'nuxt.com':               'Development',
  'rust-lang.org':          'Development',
  'go.dev':                 'Development',
  'elixir-lang.org':        'Development',
  'ruby-lang.org':          'Development',
  'php.net':                'Development',
  'spring.io':              'Development',
  'webpack.js.org':         'Development',
  'vitejs.dev':             'Development',
  'bun.sh':                 'Development',
  'deno.land':              'Development',
  'supabase.com':           'Development',
  'firebase.google.com':    'Development',
  'redis.io':               'Development',
  'postgresql.org':         'Development',
  'mysql.com':              'Development',
  'mongodb.com':            'Development',
  'elastic.co':             'Development',
  'nginx.org':              'Development',
  'apache.org':             'Development',
  'git-scm.com':            'Development',
  'node.js.org':            'Development',
  'typescriptlang.org':     'Development',
  'eslint.org':             'Development',
  'prettier.io':            'Development',
  'jestjs.io':              'Development',
  'vitest.dev':             'Development',
  'playwright.dev':         'Development',
  'cypress.io':             'Development',
  'storybook.js.org':       'Development',

  // Video
  'youtube.com':            'Video',
  'vimeo.com':              'Video',
  'twitch.tv':              'Video',
  'dailymotion.com':        'Video',
  'ted.com':                'Video',
  'netflix.com':            'Video',
  'primevideo.com':         'Video',
  'disneyplus.com':         'Video',
  'hulu.com':               'Video',
  'crunchyroll.com':        'Video',
  'plex.tv':                'Video',
  'peacocktv.com':          'Video',
  'paramountplus.com':      'Video',
  'curiositystream.com':    'Video',
  'nebula.tv':              'Video',
  'rumble.com':             'Video',
  'odysee.com':             'Video',
  'tubi.tv':                'Video',
  'pluto.tv':               'Video',
  'appletv.apple.com':      'Video',
  'mubi.com':               'Video',
  'criterion.com':          'Video',

  // Social / Community
  'reddit.com':             'Social / Community',
  'twitter.com':            'Social / Community',
  'x.com':                  'Social / Community',
  'mastodon.social':        'Social / Community',
  'fosstodon.org':          'Social / Community',
  'discord.com':            'Social / Community',
  'slack.com':              'Social / Community',
  'news.ycombinator.com':   'Social / Community',
  'lobste.rs':              'Social / Community',
  'dev.to':                 'Social / Community',
  'hashnode.com':           'Social / Community',
  'medium.com':             'Social / Community',
  'substack.com':           'Social / Community',
  'linkedin.com':           'Social / Community',
  'facebook.com':           'Social / Community',
  'instagram.com':          'Social / Community',
  'pinterest.com':          'Social / Community',
  'threads.net':            'Social / Community',
  'bsky.app':               'Social / Community',
  'lemmy.world':            'Social / Community',
  'tumblr.com':             'Social / Community',
  'quora.com':              'Social / Community',
  'goodreads.com':          'Social / Community',
  'letterboxd.com':         'Social / Community',
  'producthunt.com':        'Social / Community',
  'cohost.org':             'Social / Community',
  'snapchat.com':           'Social / Community',
  'tiktok.com':             'Social / Community',
  'clubhouse.com':          'Social / Community',
  'meetup.com':             'Social / Community',

  // News
  'bbc.com':                'News',
  'bbc.co.uk':              'News',
  'theguardian.com':        'News',
  'nytimes.com':            'News',
  'washingtonpost.com':     'News',
  'reuters.com':            'News',
  'apnews.com':             'News',
  'techcrunch.com':         'News',
  'theverge.com':           'News',
  'arstechnica.com':        'News',
  'wired.com':              'News',
  'cnn.com':                'News',
  'bbc.co.uk':              'News',
  'ft.com':                 'News',
  'economist.com':          'News',
  'engadget.com':           'News',
  'zdnet.com':              'News',
  'thenextweb.com':         'News',
  'slashdot.org':           'News',
  'vice.com':               'News',
  'vox.com':                'News',
  'politico.com':           'News',
  'theatlantic.com':        'News',
  'newyorker.com':          'News',
  'theintercept.com':       'News',
  'propublica.org':         'News',
  'axios.com':              'News',
  'bleepingcomputer.com':   'News',
  'hackernoon.com':         'News',
  'hbr.org':                'News',
  'scientificamerican.com': 'News',
  'nature.com':             'News',
  'time.com':               'News',

  // Shopping
  'amazon.com':             'Shopping',
  'ebay.com':               'Shopping',
  'etsy.com':               'Shopping',
  'shopify.com':            'Shopping',
  'aliexpress.com':         'Shopping',
  'bestbuy.com':            'Shopping',
  'walmart.com':            'Shopping',
  'target.com':             'Shopping',
  'ikea.com':               'Shopping',
  'newegg.com':             'Shopping',
  'bhphotovideo.com':       'Shopping',
  'costco.com':             'Shopping',
  'homedepot.com':          'Shopping',
  'lowes.com':              'Shopping',
  'wayfair.com':            'Shopping',
  'zappos.com':             'Shopping',
  'nordstrom.com':          'Shopping',
  'macys.com':              'Shopping',
  'asos.com':               'Shopping',
  'zara.com':               'Shopping',
  'uniqlo.com':             'Shopping',
  'gap.com':                'Shopping',
  'adidas.com':             'Shopping',
  'nike.com':               'Shopping',
  'temu.com':               'Shopping',

  // Tools
  'notion.so':              'Tools',
  'obsidian.md':            'Tools',
  'airtable.com':           'Tools',
  'trello.com':             'Tools',
  'asana.com':              'Tools',
  'linear.app':             'Tools',
  'jira.atlassian.com':     'Tools',
  'confluence.atlassian.com': 'Tools',
  'zapier.com':             'Tools',
  'ifttt.com':              'Tools',
  'regex101.com':           'Tools',
  'crontab.guru':           'Tools',
  'excalidraw.com':         'Tools',
  'draw.io':                'Tools',
  'miro.com':               'Tools',
  '1password.com':          'Tools',
  'bitwarden.com':          'Tools',
  'todoist.com':            'Tools',
  'clickup.com':            'Tools',
  'monday.com':             'Tools',
  'basecamp.com':           'Tools',
  'postman.com':            'Tools',
  'insomnia.rest':          'Tools',
  'grammarly.com':          'Tools',
  'calendly.com':           'Tools',
  'loom.com':               'Tools',
  'zoom.us':                'Tools',
  'hemingwayapp.com':       'Tools',
  'tableplus.com':          'Tools',
  'iterm2.com':             'Tools',
  'raycast.com':            'Tools',

  // Reference
  'wikipedia.org':          'Reference',
  'en.wikipedia.org':       'Reference',
  'wikihow.com':            'Reference',
  'merriam-webster.com':    'Reference',
  'dictionary.com':         'Reference',
  'wolframalpha.com':       'Reference',
  'archive.org':            'Reference',
  'web.archive.org':        'Reference',
  'scholar.google.com':     'Reference',
  'arxiv.org':              'Reference',
  'britannica.com':         'Reference',
  'snopes.com':             'Reference',
  'factcheck.org':          'Reference',
  'thesaurus.com':          'Reference',
  'etymonline.com':         'Reference',
  'worldcat.org':           'Reference',
  'jstor.org':              'Reference',
  'pubmed.ncbi.nlm.nih.gov': 'Reference',
  'semanticscholar.org':    'Reference',
  'researchgate.net':       'Reference',
  'plato.stanford.edu':     'Reference',
  'ieeexplore.ieee.org':    'Reference',
  'acm.org':                'Reference',
  'rfc-editor.org':         'Reference',
  'w3.org':                 'Reference',
  'ecma-international.org': 'Reference',
  'ietf.org':               'Reference',

  // Design
  'figma.com':              'Design',
  'sketch.com':             'Design',
  'dribbble.com':           'Design',
  'behance.net':            'Design',
  'awwwards.com':           'Design',
  'fonts.google.com':       'Design',
  'fontawesome.com':        'Design',
  'unsplash.com':           'Design',
  'pexels.com':             'Design',
  'coolors.co':             'Design',
  'color.adobe.com':        'Design',
  'svgomg.net':             'Design',
  'icones.js.org':          'Design',
  'heroicons.com':          'Design',
  'tailwindcss.com':        'Design',
  'canva.com':              'Design',
  'adobe.com':              'Design',
  'invisionapp.com':        'Design',
  'zeplin.io':              'Design',
  'framer.com':             'Design',
  'webflow.com':            'Design',
  'uicolors.app':           'Design',
  'colorhunt.co':           'Design',
  'svgrepo.com':            'Design',
  'iconmonstr.com':         'Design',
  'flaticon.com':           'Design',
  'undraw.co':              'Design',
  'lottiefiles.com':        'Design',
  'rive.app':               'Design',
  'spline.design':          'Design',
  'motionarray.com':        'Design',
  'envato.com':             'Design',

  // Finance
  'bloomberg.com':          'Finance',
  'investopedia.com':       'Finance',
  'coinbase.com':           'Finance',
  'binance.com':            'Finance',
  'robinhood.com':          'Finance',
  'mint.com':               'Finance',
  'ynab.com':               'Finance',
  'bankofamerica.com':      'Finance',
  'chase.com':              'Finance',
  'paypal.com':             'Finance',
  'stripe.com':             'Finance',
  'morningstar.com':        'Finance',
  'seekingalpha.com':       'Finance',
  'fool.com':               'Finance',
  'nerdwallet.com':         'Finance',
  'creditkarma.com':        'Finance',
  'sofi.com':               'Finance',
  'wealthsimple.com':       'Finance',
  'fidelity.com':           'Finance',
  'schwab.com':             'Finance',
  'etrade.com':             'Finance',
  'revolut.com':            'Finance',
  'wise.com':               'Finance',
  'kraken.com':             'Finance',
  'gemini.com':             'Finance',
  'coinmarketcap.com':      'Finance',
  'coingecko.com':          'Finance',
  'tradingview.com':        'Finance',
  'wellsfargo.com':         'Finance',
  'capitalone.com':         'Finance',

  // Learning
  'coursera.org':           'Learning',
  'udemy.com':              'Learning',
  'edx.org':                'Learning',
  'khanacademy.org':        'Learning',
  'pluralsight.com':        'Learning',
  'frontendmasters.com':    'Learning',
  'egghead.io':             'Learning',
  'lynda.com':              'Learning',
  'codecademy.com':         'Learning',
  'freecodecamp.org':       'Learning',
  'leetcode.com':           'Learning',
  'exercism.org':           'Learning',
  'brilliant.org':          'Learning',
  'skillshare.com':         'Learning',
  'masterclass.com':        'Learning',
  'treehouse.com':          'Learning',
  'datacamp.com':           'Learning',
  'kaggle.com':             'Learning',
  'hackerrank.com':         'Learning',
  'codewars.com':           'Learning',
  'topcoder.com':           'Learning',
  'scrimba.com':            'Learning',
  'laracasts.com':          'Learning',
  'designcode.io':          'Learning',
  'academicearth.org':      'Learning',
  'openculture.com':        'Learning',
  'mit.edu':                'Learning',
  'ocw.mit.edu':            'Learning',
  'open.edu':               'Learning',
  'futurelearn.com':        'Learning',
  'duolingo.com':           'Learning',
  'babbel.com':             'Learning',
  'rosettastone.com':       'Learning',
};

// ─── Category keywords ────────────────────────────────────────────────────────
// Ordered SPECIFIC-FIRST to prevent greedy matching on generic terms.
// Development checks 'github', 'npm', 'api' BEFORE Tools checks 'tool', 'editor'.
// Learning checks 'course', 'tutorial' BEFORE Reference checks 'docs'.

export const CATEGORY_KEYWORDS = {
  // Specific categories first
  'Development': [
    'github', 'gitlab', 'npm', 'programming', 'open source', 'developer',
    'api', 'library', 'framework', 'repository', 'pull request',
    'software engineer', 'devops', 'kubernetes', 'docker',
  ],
  'Video': [
    'video', 'watch', 'stream', 'episode', 'playlist', 'channel',
    'subscribe', 'live stream',
  ],
  'Design': [
    'design', 'ui', 'ux', 'figma', 'sketch', 'typography', 'color',
    'icon', 'wireframe', 'prototype', 'illustration', 'graphic',
  ],
  'Finance': [
    'finance', 'invest', 'stock', 'crypto', 'bank', 'budget', 'tax',
    'trading', 'portfolio', 'dividend', 'mortgage',
  ],
  'Shopping': [
    'shop', 'buy', 'price', 'cart', 'checkout',
    'deal', 'discount', 'sale',
  ],
  'Learning': [
    'course', 'tutorial', 'lesson', 'training', 'education', 'mooc',
    'learn ', 'lecture', 'bootcamp', 'certificate',
  ],
  'News': [
    'news', 'article', 'breaking', 'headline', 'journalism',
    'press', 'editorial',
  ],
  'Social / Community': [
    'forum', 'community', 'discussion', 'tweet',
    'thread', 'comment', 'social',
  ],
  // More generic — checked after the above
  'Reference': [
    'wiki', 'reference', 'glossary', 'dictionary', 'specification',
    'docs', 'documentation', 'manual',
  ],
  'Tools': [
    'tool', 'generator', 'converter', 'calculator', 'editor', 'playground',
    'utility',
  ],
};

// ─── Fuzzy match helpers ───────────────────────────────────────────────────────
// Short synonym map: common aliases/plurals that should resolve to standard labels.
// Checked BEFORE Levenshtein so deliberate aliases are never penalised by edit distance.
const CATEGORY_SYNONYMS = {
  'coding':        'Development',
  'dev':           'Development',
  'development':   'Development',
  'programming':   'Development',
  'videos':        'Video',
  'movies':        'Video',
  'films':         'Video',
  'tv':            'Video',
  'social':        'Social / Community',
  'community':     'Social / Community',
  'forums':        'Social / Community',
  'news':          'News',
  'articles':      'News',
  'blogs':         'News',
  'blog':          'News',
  'shopping':      'Shopping',
  'buy':           'Shopping',
  'tools':         'Tools',
  'utilities':     'Tools',
  'apps':          'Tools',
  'reference':     'Reference',
  'references':    'Reference',
  'docs':          'Reference',
  'documentation': 'Reference',
  'design':        'Design',
  'ui':            'Design',
  'ux':            'Design',
  'finance':       'Finance',
  'money':         'Finance',
  'investing':     'Finance',
  'learning':      'Learning',
  'courses':       'Learning',
  'tutorials':     'Learning',
  'education':     'Learning',
};

const STANDARD_CATEGORIES = [
  'Development', 'Video', 'Social / Community', 'News', 'Shopping',
  'Tools', 'Reference', 'Design', 'Finance', 'Learning',
];

// Fuzzy match threshold: Levenshtein distance ≤ 2 OR normalised similarity ≥ 0.7
const FUZZY_DISTANCE_THRESHOLD = 2;
const FUZZY_SIMILARITY_THRESHOLD = 0.7;

// Folder names considered too generic to use as a category fallback.
// These are top-level Chrome bookmark bar names / browser defaults.
const GENERIC_FOLDER_NAMES = new Set([
  'root', 'bookmarks', 'bookmarks bar', 'bookmarks toolbar',
  'other bookmarks', 'mobile bookmarks', 'imported',
]);

/**
 * Fuzzy-match a source folder name against the 10 standard category labels.
 * Returns the matching standard category, or null if no confident match.
 *
 * Resolution order:
 *   1. Null / empty input → null
 *   2. Exact match (case-insensitive) against standard categories → that category
 *   3. Synonym map lookup (case-insensitive) → mapped category
 *   4. Levenshtein distance ≤ FUZZY_DISTANCE_THRESHOLD (2) against standard labels → closest
 *   5. Normalised similarity ≥ FUZZY_SIMILARITY_THRESHOLD (0.7) against standard labels → closest
 *   6. No match → null (caller uses raw folder name instead)
 *
 * @param {string|null} folderName
 * @returns {string|null} standard category label, or null
 */
export function fuzzyMatchCategory(folderName) {
  if (!folderName) return null;
  const lower = folderName.toLowerCase().trim();
  if (!lower) return null;

  // Step 1: exact match (case-insensitive)
  const exactMatch = STANDARD_CATEGORIES.find(c => c.toLowerCase() === lower);
  if (exactMatch) return exactMatch;

  // Step 2: synonym map
  if (CATEGORY_SYNONYMS[lower]) return CATEGORY_SYNONYMS[lower];

  // Step 3 + 4: Levenshtein against each standard category (lowercase vs lowercase)
  let bestCategory = null;
  let bestDistance = Infinity;
  for (const cat of STANDARD_CATEGORIES) {
    const d = distance(lower, cat.toLowerCase());
    if (d < bestDistance) {
      bestDistance = d;
      bestCategory = cat;
    }
  }
  // Accept if distance ≤ threshold OR normalised similarity ≥ threshold
  if (bestDistance <= FUZZY_DISTANCE_THRESHOLD) return bestCategory;
  const maxLen = Math.max(lower.length, bestCategory.toLowerCase().length);
  const similarity = 1 - bestDistance / maxLen;
  if (similarity >= FUZZY_SIMILARITY_THRESHOLD) return bestCategory;

  return null;
}

// ─── classifyByDomain ─────────────────────────────────────────────────────────

/**
 * Classify a URL by its hostname using the built-in domain rules map.
 * Strips leading www. before lookup so both github.com and www.github.com resolve.
 * @param {string} url
 * @returns {string|null} category label, or null if not in map / malformed URL
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

// ─── classifyByMetadata ───────────────────────────────────────────────────────

/**
 * Classify a node using OG/meta tag metadata.
 * Concatenates title + description, lowercases, and scans each category's keywords.
 * Returns the first matching category or null.
 * @param {{title?: string, description?: string, image?: string}|undefined|null} metadata
 * @returns {string|null}
 */
export function classifyByMetadata(metadata) {
  if (!metadata) return null;
  const text = [metadata.title, metadata.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!text) return null;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) return category;
  }
  return null;
}

// ─── classifyByPath ───────────────────────────────────────────────────────────

/**
 * Classify a URL by inspecting its path and subdomain as structural signals.
 * Used as the 3rd fallback step after domain rules and OG metadata both fail.
 *
 * Subdomain signals (raw hostname, NOT www-stripped — docs.example.com is a hint):
 *   docs.* / documentation.*  → Reference
 *   blog.*                    → News
 *   shop.* / store.*          → Shopping
 *
 * Path signals (case-insensitive):
 *   /docs/ or /documentation/ → Reference
 *   /blog/ or /news/          → News
 *   /shop/ or /store/         → Shopping
 *   /api/                     → Development
 *
 * Note: domain rules take priority — a github.com/blog/ stays in Development.
 * @param {string} url
 * @returns {string|null} category label, or null if no pattern matched / malformed URL
 */
export function classifyByPath(url) {
  let pathname, hostname;
  try {
    const parsed = new URL(url);
    pathname = parsed.pathname.toLowerCase();
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }

  // Subdomain hints (raw hostname, NOT www-stripped — per D-02)
  if (hostname.startsWith('docs.') || hostname.startsWith('documentation.')) return 'Reference';
  if (hostname.startsWith('blog.')) return 'News';
  if (hostname.startsWith('shop.') || hostname.startsWith('store.')) return 'Shopping';

  // Path hints (per D-01)
  if (pathname.startsWith('/docs/') || pathname === '/docs' || pathname.startsWith('/documentation/')) return 'Reference';
  if (pathname.startsWith('/blog/') || pathname === '/blog' || pathname.startsWith('/news/') || pathname === '/news') return 'News';
  if (pathname.startsWith('/shop/') || pathname === '/shop' || pathname.startsWith('/store/') || pathname === '/store') return 'Shopping';
  if (pathname.startsWith('/api/') || pathname === '/api') return 'Development';

  return null;
}

// ─── classifyNode ─────────────────────────────────────────────────────────────

/**
 * Classify a single BookmarkNode link.
 * Chain: domain rules → OG metadata → path/subdomain signals → folder name fallback → 'Other'
 *
 * Folder name fallback (CLASS-07):
 *   If sourceFolderName is provided and all 3 pipeline steps return null:
 *   - Generic folder names (root, bookmarks bar, etc.) are ignored → 'Other'
 *   - fuzzyMatchCategory(sourceFolderName) → standard category if close match
 *   - else raw sourceFolderName → preserves original folder grouping
 *   If sourceFolderName is null (root-level bookmark) → 'Other' as before.
 *
 * Returns a new node with .category set — does NOT mutate the input.
 * Folder nodes are returned unchanged.
 * @param {import('./shared/types.js').BookmarkNode} node
 * @param {string|null} [sourceFolderName] - direct parent folder name from classifyTree
 * @returns {import('./shared/types.js').BookmarkNode}
 */
export function classifyNode(node, sourceFolderName = null) {
  if (node.type !== 'link') return node;
  const pipelineResult =
    classifyByDomain(node.url) ??
    classifyByMetadata(node.metadata) ??
    classifyByPath(node.url);

  if (pipelineResult !== null && pipelineResult !== undefined) {
    return { ...node, category: pipelineResult };
  }

  // Folder name fallback (CLASS-07)
  if (sourceFolderName !== null) {
    // Skip generic browser-default folder names
    if (GENERIC_FOLDER_NAMES.has(sourceFolderName.toLowerCase())) {
      return { ...node, category: 'Other' };
    }
    const fuzzy = fuzzyMatchCategory(sourceFolderName);
    if (fuzzy) return { ...node, category: fuzzy };
    // No fuzzy match — preserve raw folder name
    return { ...node, category: sourceFolderName };
  }

  return { ...node, category: 'Other' };
}

// ─── classifyTree ─────────────────────────────────────────────────────────────

/**
 * Deep-walk a BookmarkNode tree, classifying all link nodes.
 * Returns a new tree — does NOT mutate the input.
 *
 * Hyphen-prefix preservation (D-05 through D-08):
 *   If a link node's direct parent folder name starts with '-' AND that folder
 *   is NOT in the preservedFolders opt-in set, the link's category is set to
 *   the folder name (preserved as-is). If the folder IS in preservedFolders,
 *   the link is classified normally via classifyNode.
 *
 * @param {import('./shared/types.js').BookmarkNode} node
 * @param {Set<string>} [preservedFolders] - folder names that should be reclassified normally
 * @param {string|null} [_sourceFolderName] - internal: direct parent folder name (threaded through recursion)
 * @returns {import('./shared/types.js').BookmarkNode}
 */
export function classifyTree(node, preservedFolders = new Set(), _sourceFolderName = null) {
  if (node.type === 'link') {
    // If inside a hyphen-prefixed folder that is NOT opted in for reclassification, preserve it
    if (_sourceFolderName !== null
        && _sourceFolderName.startsWith('-')
        && !preservedFolders.has(_sourceFolderName)) {
      return { ...node, category: _sourceFolderName };
    }
    // If the folder was hyphen-prefixed but opted into preservedFolders, reclassify without
    // folder name fallback (pass null) — the hyphen-prefix name is not a useful category hint.
    const folderHint = (_sourceFolderName !== null && _sourceFolderName.startsWith('-'))
      ? null
      : _sourceFolderName;
    return classifyNode(node, folderHint);
  }
  // Folder node: thread folder name to children (only direct parent — reset each level)
  const folderName = node.title ?? null;
  return {
    ...node,
    children: (node.children ?? []).map(child =>
      classifyTree(child, preservedFolders, folderName)
    ),
  };
}
