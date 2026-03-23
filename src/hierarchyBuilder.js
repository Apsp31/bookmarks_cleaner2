/**
 * Hierarchy Builder
 *
 * Takes a classified BookmarkNode tree (all link nodes have `.category` set by classifyTree),
 * flattens all links, groups by category, and returns a new category-organised tree.
 *
 * Output shape: root (folder) → category folder(s) (folder) → links
 * Max depth = 3 (root=0, category folder=1, link=2) — satisfies D-08 hard constraint.
 *
 * Exports:
 *   buildHierarchy(classifiedTree)  – returns new BookmarkNode tree, no mutation
 */

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
 *   3. Build one category folder per group (only groups with members — D-04).
 *   4. Sort folders alphabetically for deterministic output.
 *   5. Return a new root folder containing the category folders.
 *
 * v1: No sub-categorisation within top-level categories — links are direct children of
 * category folders (depth 2). This satisfies the max-3-level hard constraint from D-08.
 * Phase 5 lets the user reorganise manually (D-09).
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
  // 4. Sort alphabetically for deterministic output
  const categoryFolders = [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, catLinks]) => ({
      id: crypto.randomUUID(),
      type: /** @type {'folder'} */ ('folder'),
      title: cat,
      children: catLinks,
    }));

  // 5. Return new root node
  return {
    id: crypto.randomUUID(),
    type: /** @type {'folder'} */ ('folder'),
    title: 'root',
    children: categoryFolders,
  };
}
