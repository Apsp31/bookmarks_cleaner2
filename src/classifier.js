/**
 * Classifier Pipeline
 *
 * Exports:
 *   DOMAIN_RULES            – plain object mapping hostname → category label (~300 entries)
 *   CATEGORY_KEYWORDS       – object mapping category → keyword array (ordered specific-first)
 *   classifyByDomain(url)   – looks up hostname in DOMAIN_RULES, strips www. prefix
 *   classifyByMetadata(m)   – keyword-scans OG title+description, returns first match or null
 *   classifyByPath(url)     – matches URL path/subdomain patterns as 3rd fallback step
 *   classifyNode(node)      – chains domain→metadata→path→'Other', returns new node (no mutation)
 *   classifyTree(node)      – deep-walks BookmarkNode tree, classifying all link nodes
 */

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
    'api', 'code', 'library', 'framework', 'repository', 'pull request',
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
    'shop', 'buy', 'price', 'cart', 'checkout', 'product', 'store',
    'deal', 'discount', 'sale', 'order',
  ],
  'Learning': [
    'course', 'tutorial', 'lesson', 'training', 'education', 'mooc',
    'learn ', 'lecture', 'bootcamp', 'certificate',
  ],
  'News': [
    'news', 'article', 'breaking', 'report', 'headline', 'journalism',
    'press', 'editorial', 'analysis',
  ],
  'Social / Community': [
    'forum', 'community', 'discussion', 'post', 'tweet', 'feed',
    'thread', 'comment', 'network', 'social',
  ],
  // More generic — checked after the above
  'Reference': [
    'wiki', 'reference', 'glossary', 'dictionary', 'specification',
    'docs', 'documentation', 'manual', 'guide',
  ],
  'Tools': [
    'tool', 'generator', 'converter', 'calculator', 'editor', 'playground',
    'utility', 'extension', 'plugin',
  ],
};

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
 * Chain: domain rules → OG metadata → path/subdomain signals → 'Other'
 * Returns a new node with .category set — does NOT mutate the input.
 * Folder nodes are returned unchanged.
 * @param {import('./shared/types.js').BookmarkNode} node
 * @returns {import('./shared/types.js').BookmarkNode}
 */
export function classifyNode(node) {
  if (node.type !== 'link') return node;
  const category =
    classifyByDomain(node.url) ??
    classifyByMetadata(node.metadata) ??
    classifyByPath(node.url) ??
    'Other';
  return { ...node, category };
}

// ─── classifyTree ─────────────────────────────────────────────────────────────

/**
 * Deep-walk a BookmarkNode tree, classifying all link nodes.
 * Returns a new tree — does NOT mutate the input.
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
