/**
 * Tree mutation helpers for the editable bookmark UI.
 * All functions are pure — they return new tree structures without mutating inputs.
 * @module treeOps
 */

/**
 * Remove a node by id from the tree.
 *
 * @param {import('./types.js').BookmarkNode} node
 * @param {string} targetId
 * @returns {import('./types.js').BookmarkNode}
 */
export function deleteNode(node, targetId) {
  if (node.type === 'folder') {
    return {
      ...node,
      children: (node.children ?? [])
        .filter(child => child.id !== targetId)
        .map(child => deleteNode(child, targetId)),
    };
  }
  return node;
}

/**
 * Check if descendantId is inside the subtree rooted at node.
 *
 * @param {import('./types.js').BookmarkNode} node
 * @param {string} descendantId
 * @returns {boolean}
 */
function isDescendant(node, descendantId) {
  if (node.id === descendantId) return true;
  if (node.type === 'folder') {
    return (node.children ?? []).some(c => isDescendant(c, descendantId));
  }
  return false;
}

/**
 * Move a node from its current location to a target folder.
 * No-op if nodeId not found or targetFolderId is a descendant of nodeId (circular move guard).
 *
 * @param {import('./types.js').BookmarkNode} root
 * @param {string} nodeId
 * @param {string} targetFolderId
 * @returns {import('./types.js').BookmarkNode}
 */
export function moveNode(root, nodeId, targetFolderId) {
  // Find the source node first
  let sourceNode = null;
  function findNode(n) {
    if (n.id === nodeId) { sourceNode = n; return; }
    if (n.children) n.children.forEach(findNode);
  }
  findNode(root);
  if (!sourceNode) return root;

  // Circular move guard: target is inside source subtree
  if (sourceNode.type === 'folder' && isDescendant(sourceNode, targetFolderId)) return root;

  // Pass 1: extract the node from its current location
  let extracted = null;
  function extract(node) {
    if (node.type !== 'folder') return node;
    const found = (node.children ?? []).find(c => c.id === nodeId);
    if (found) extracted = found;
    return {
      ...node,
      children: (node.children ?? [])
        .filter(c => c.id !== nodeId)
        .map(extract),
    };
  }
  const withoutNode = extract(root);
  if (!extracted) return root;

  // Pass 2: insert into target folder
  function insert(node) {
    if (node.type !== 'folder') return node;
    if (node.id === targetFolderId) {
      return { ...node, children: [...(node.children ?? []), extracted] };
    }
    return { ...node, children: (node.children ?? []).map(insert) };
  }
  return insert(withoutNode);
}

/**
 * Reorder a node within its parent's children array.
 * Pure function — returns a new tree without mutating the input.
 *
 * @param {import('./types.js').BookmarkNode} root
 * @param {string} nodeId - ID of the child to move
 * @param {string} parentFolderId - ID of the parent folder containing the child
 * @param {number} newIndex - Target index in the post-removal children array
 * @returns {import('./types.js').BookmarkNode}
 */
export function reorderNode(root, nodeId, parentFolderId, newIndex) {
  function reorder(node) {
    if (node.type !== 'folder') return node;
    if (node.id === parentFolderId) {
      const children = (node.children ?? []).slice();
      const fromIndex = children.findIndex(c => c.id === nodeId);
      if (fromIndex === -1) return { ...node, children: children.map(reorder) };
      const [item] = children.splice(fromIndex, 1);
      const clampedIndex = Math.max(0, Math.min(newIndex, children.length));
      children.splice(clampedIndex, 0, item);
      return { ...node, children };
    }
    return { ...node, children: (node.children ?? []).map(reorder) };
  }
  return reorder(root);
}

/**
 * Mark a node as kept (sets kept: true on the matching node).
 * Does not modify any other nodes.
 *
 * @param {import('./types.js').BookmarkNode} node
 * @param {string} targetId
 * @returns {import('./types.js').BookmarkNode}
 */
export function markKeep(node, targetId) {
  if (node.id === targetId) return { ...node, kept: true };
  if (node.type === 'folder') {
    return {
      ...node,
      children: (node.children ?? []).map(child => markKeep(child, targetId)),
    };
  }
  return node;
}
