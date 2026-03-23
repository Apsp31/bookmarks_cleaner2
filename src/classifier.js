/**
 * Classifier Pipeline
 *
 * Exports:
 *   DOMAIN_RULES            – plain object mapping hostname → category label (~50-100 entries)
 *   CATEGORY_KEYWORDS       – object mapping category → keyword array (ordered specific-first)
 *   classifyByDomain(url)   – looks up hostname in DOMAIN_RULES, strips www. prefix
 *   classifyByMetadata(m)   – keyword-scans OG title+description, returns first match or null
 *   classifyNode(node)      – chains domain→metadata→'Other', returns new node (no mutation)
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

// ─── classifyNode ─────────────────────────────────────────────────────────────

/**
 * Classify a single BookmarkNode link.
 * Chain: domain rules → OG metadata → 'Other'
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
