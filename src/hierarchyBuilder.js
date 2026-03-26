/**
 * Hierarchy Builder
 *
 * Takes a classified BookmarkNode tree (all link nodes have `.category` set by classifyTree),
 * flattens all links, groups by category, and returns a new category-organised tree.
 *
 * Output shape:
 *   root (folder)
 *     → category folder(s) (folder)
 *         → sub-folder(s) (folder, only when category > SUBCATEGORY_THRESHOLD links
 *                          and >= SUBCATEGORY_MIN_COVERAGE_RATIO match the sub-taxonomy)
 *             → links
 * Max depth = 3 (root=0, category folder=1, sub-folder=2, link=3) — satisfies D-10 constraint.
 *
 * Exports:
 *   buildHierarchy(classifiedTree)    – returns new BookmarkNode tree, no mutation
 *   SUBCATEGORY_THRESHOLD             – link count above which sub-splitting is attempted (default 20)
 *   SUBCATEGORY_MIN_COVERAGE_RATIO    – min fraction of links that must match sub-taxonomy to split (default 0.6)
 */

// ─── Named constants (HIER-05) ────────────────────────────────────────────────

export const SUBCATEGORY_THRESHOLD = 20;
export const SUBCATEGORY_MIN_COVERAGE_RATIO = 0.6;

// ─── Development sub-taxonomy (HIER-03, HIER-04) ─────────────────────────────

/**
 * Maps hostnames (www-stripped) to Development sub-categories.
 * Only used when cat === 'Development' and link count > SUBCATEGORY_THRESHOLD.
 * Claude's discretion for assignments per CONTEXT.md.
 */
const DEVELOPMENT_SUBTAXONOMY = {
  // Frontend
  'angular.io': 'Frontend', 'vuejs.org': 'Frontend', 'reactjs.org': 'Frontend',
  'svelte.dev': 'Frontend', 'nextjs.org': 'Frontend', 'nuxt.com': 'Frontend',
  'webpack.js.org': 'Frontend', 'vitejs.dev': 'Frontend', 'storybook.js.org': 'Frontend',
  'tailwindcss.com': 'Frontend', 'codepen.io': 'Frontend', 'jsfiddle.net': 'Frontend',
  'codesandbox.io': 'Frontend',
  // Backend
  'spring.io': 'Backend', 'rust-lang.org': 'Backend', 'go.dev': 'Backend',
  'elixir-lang.org': 'Backend', 'ruby-lang.org': 'Backend', 'php.net': 'Backend',
  'deno.land': 'Backend', 'bun.sh': 'Backend', 'nodejs.org': 'Backend',
  'fastapi.tiangolo.com': 'Backend', 'expressjs.com': 'Backend',
  // DevOps/Cloud
  'docker.com': 'DevOps/Cloud', 'hub.docker.com': 'DevOps/Cloud',
  'kubernetes.io': 'DevOps/Cloud', 'aws.amazon.com': 'DevOps/Cloud',
  'cloud.google.com': 'DevOps/Cloud', 'azure.microsoft.com': 'DevOps/Cloud',
  'digitalocean.com': 'DevOps/Cloud', 'terraform.io': 'DevOps/Cloud',
  'heroku.com': 'DevOps/Cloud', 'vercel.com': 'DevOps/Cloud',
  'netlify.com': 'DevOps/Cloud', 'nginx.org': 'DevOps/Cloud', 'apache.org': 'DevOps/Cloud',
  // Tools
  'github.com': 'Tools', 'gitlab.com': 'Tools', 'bitbucket.org': 'Tools',
  'stackoverflow.com': 'Tools', 'stackexchange.com': 'Tools',
  'npmjs.com': 'Tools', 'pypi.org': 'Tools', 'crates.io': 'Tools',
  'replit.com': 'Tools', 'devdocs.io': 'Tools', 'regex101.com': 'Tools',
  'typescriptlang.org': 'Tools', 'eslint.org': 'Tools', 'prettier.io': 'Tools',
  'jestjs.io': 'Tools', 'vitest.dev': 'Tools', 'playwright.dev': 'Tools',
  'cypress.io': 'Tools', 'git-scm.com': 'Tools',
  // Learning
  'developer.mozilla.org': 'Learning', 'docs.python.org': 'Learning',
  'docs.rs': 'Learning', 'graphql.org': 'Learning',
  'pkg.go.dev': 'Learning', 'rubygems.org': 'Learning',
  // AI/ML
  'openai.com': 'AI/ML', 'huggingface.co': 'AI/ML', 'anthropic.com': 'AI/ML',
  'deepmind.com': 'AI/ML', 'mistral.ai': 'AI/ML', 'replicate.com': 'AI/ML',
  'stability.ai': 'AI/ML', 'cohere.com': 'AI/ML', 'langchain.com': 'AI/ML',
};

// ─── toFolderSlug ─────────────────────────────────────────────────────────────

/**
 * Convert an array of path segments into a deterministic folder ID slug.
 * Example: ['development', 'AI/ML'] → 'folder-development-ai-ml'
 * @param {string[]} pathSegments
 * @returns {string}
 */
function toFolderSlug(pathSegments) {
  return 'folder-' + pathSegments
    .map(s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .join('-');
}

// ─── lookupDevSubcategory ─────────────────────────────────────────────────────

/**
 * Look up a Development sub-category from a URL's hostname.
 * Returns null if no match (link will fall into 'Other' within Development).
 * @param {string} url
 * @returns {string|null}
 */
function lookupDevSubcategory(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return DEVELOPMENT_SUBTAXONOMY[hostname] ?? null;
  } catch {
    return null;
  }
}

// ─── maybeSplitIntoSubfolders ─────────────────────────────────────────────────

/**
 * Attempt to split a category's links into sub-folders.
 * Returns links unchanged (flat array) when any guard fails;
 * returns an array of sub-folder nodes when split succeeds.
 *
 * Guards (in order):
 *   1. Hyphen-prefix folders are never split (Phase 6 D-05)
 *   2. Link count must exceed SUBCATEGORY_THRESHOLD
 *   3. Only Development has a sub-taxonomy in this phase (D-06)
 *   4. Coverage ratio must be >= SUBCATEGORY_MIN_COVERAGE_RATIO (D-08)
 *
 * @param {string} cat - Category title
 * @param {import('./shared/types.js').BookmarkNode[]} links
 * @param {string} _parentSlug - Parent folder slug (unused; sub-folder IDs derived from cat+sub)
 * @returns {import('./shared/types.js').BookmarkNode[] | import('./shared/types.js').BookmarkNode[]}
 */
function maybeSplitIntoSubfolders(cat, links, _parentSlug) {
  // Guard: hyphen-prefix folders never split (Phase 6 D-05)
  if (cat.startsWith('-')) return links;
  // Guard: below threshold
  if (links.length <= SUBCATEGORY_THRESHOLD) return links;
  // Guard: only Development has a sub-taxonomy in this phase (D-06)
  if (cat !== 'Development') return links;

  // Assign each link to a sub-category
  const subGroups = new Map();
  let namedCount = 0;
  for (const link of links) {
    const sub = lookupDevSubcategory(link.url);
    const label = sub ?? 'Other';
    if (sub) namedCount++;
    if (!subGroups.has(label)) subGroups.set(label, []);
    subGroups.get(label).push(link);
  }

  // Coverage guard (D-08)
  if (namedCount / links.length < SUBCATEGORY_MIN_COVERAGE_RATIO) return links;

  // Build sub-folder nodes
  return [...subGroups.entries()]
    .filter(([, subLinks]) => subLinks.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sub, subLinks]) => ({
      id: toFolderSlug([cat, sub]),
      type: /** @type {'folder'} */ ('folder'),
      title: sub,
      children: subLinks,
    }));
}

// ─── collectLinks ─────────────────────────────────────────────────────────────

/**
 * Collect all link nodes from a tree recursively.
 * @param {import('./shared/types.js').BookmarkNode} node
 * @returns {import('./shared/types.js').BookmarkNode[]}
 */
function collectLinks(node) {
  if (node.type === 'link') return [node];
  return (node.children ?? []).flatMap(collectLinks);
}

// ─── buildHierarchy ───────────────────────────────────────────────────────────

/**
 * Build the proposed hierarchy tree from a classified tree.
 *
 * Steps:
 *   1. Flatten all link nodes from the (possibly nested) input tree.
 *   2. Group by link.category (fallback to 'Other' for missing category).
 *   3. For large categories (> SUBCATEGORY_THRESHOLD) with sufficient taxonomy
 *      coverage, split into sub-folders (currently: Development only).
 *   4. Sort category folders alphabetically for deterministic output.
 *   5. Return a new root folder containing the category folders.
 *
 * All folder IDs are deterministic slugs (e.g. 'folder-development',
 * 'folder-development-ai-ml') rather than random UUIDs, so edit operations
 * targeting a folder ID remain valid after a classify re-run (HIER-01).
 *
 * @param {import('./shared/types.js').BookmarkNode} classifiedTree
 * @returns {import('./shared/types.js').BookmarkNode}
 */
export function buildHierarchy(classifiedTree) {
  // 1. Flatten all links from the input tree
  const links = collectLinks(classifiedTree);

  // 2. Group by category — using actual categories from classified links (D-04: no fixed list)
  /** @type {Map<string, import('./shared/types.js').BookmarkNode[]>} */
  const byCategory = new Map();
  for (const link of links) {
    const cat = link.category ?? 'Other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(link);
  }

  // 3. Build category folder nodes — one per group (empty categories never created per D-04)
  //    Attempt sub-folder split for large categories (HIER-02)
  // 4. Sort alphabetically for deterministic output
  const categoryFolders = [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, catLinks]) => {
      const catId = toFolderSlug([cat]);
      const children = maybeSplitIntoSubfolders(cat, catLinks, catId);
      return { id: catId, type: /** @type {'folder'} */ ('folder'), title: cat, children };
    });

  // 5. Return new root node with deterministic ID
  return {
    id: 'folder-root',
    type: /** @type {'folder'} */ ('folder'),
    title: 'root',
    children: categoryFolders,
  };
}
