/**
 * Tree utility functions for pruning and counting bookmark nodes.
 * @module treeUtils
 */

/**
 * Recursively remove empty folders from a bookmark tree.
 * A folder is "empty" if it has no link descendants (directly or transitively).
 * The root node is always returned even if all its children are pruned.
 *
 * @param {import('./types.js').BookmarkNode} node
 * @returns {import('./types.js').BookmarkNode}
 */
export function pruneEmptyFolders(node) {
  if (node.type === 'link') return node;
  const prunedChildren = (node.children ?? [])
    .map(pruneEmptyFolders)
    .filter(child => {
      if (child.type === 'link') return true;
      return (child.children ?? []).length > 0;
    });
  return { ...node, children: prunedChildren };
}

/**
 * Count the total number of link nodes in a tree.
 *
 * @param {import('./types.js').BookmarkNode|null|undefined} node
 * @returns {number}
 */
export function countLinks(node) {
  if (!node) return 0;
  if (node.type === 'link') return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countLinks(child), 0);
}
