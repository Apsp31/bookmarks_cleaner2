import { Router } from 'express';
import { session } from '../session.js';

const router = Router();

/**
 * Recursively finds a node by id within a tree.
 *
 * @param {import('../shared/types.js').BookmarkNode} node
 * @param {string} id
 * @returns {import('../shared/types.js').BookmarkNode | null}
 */
function findNode(node, id) {
  if (node.id === id) return node;
  for (const child of (node.children ?? [])) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Applies a single merge: moves children from removeId folder into keepId folder,
 * then removes the removeId folder. Returns a new tree (never mutates in place).
 *
 * @param {import('../shared/types.js').BookmarkNode} node
 * @param {string} keepId
 * @param {string} removeId
 * @param {{ children: import('../shared/types.js').BookmarkNode[] }} state - shared mutable state during single pass
 * @returns {import('../shared/types.js').BookmarkNode}
 */
function applyMerge(tree, keepId, removeId) {
  // First pass: collect children from the remove folder
  const removeNode = findNode(tree, removeId);
  const childrenToMove = removeNode ? (removeNode.children ?? []) : [];

  // Second pass: rebuild tree, appending children to keepId and dropping removeId
  function rebuild(node) {
    if (node.type === 'link') {
      return { ...node };
    }

    let children = (node.children ?? [])
      .filter(child => child.id !== removeId)
      .map(rebuild);

    if (node.id === keepId) {
      children = [...children, ...childrenToMove];
    }

    return { ...node, children };
  }

  return rebuild(tree);
}

router.post('/merge', (req, res) => {
  if (!session.cleanTree) {
    return res.status(400).json({ error: 'No cleaned tree available. Run /api/cleanup first.' });
  }

  const { approveAll, pairs } = req.body ?? {};

  let mergeList = [];

  if (approveAll) {
    // Merge all candidates and all duplicate subtrees
    mergeList = [
      ...session.mergeCandidates.map(c => ({ keepId: c.aId, removeId: c.bId })),
      ...session.duplicateSubtrees.map(d => ({ keepId: d.keepId, removeId: d.removeId })),
    ];
  } else if (Array.isArray(pairs) && pairs.length > 0) {
    mergeList = pairs.map(p => ({ keepId: p.aId, removeId: p.bId }));
  } else {
    return res.status(400).json({ error: 'Provide either approveAll: true or pairs: [{ aId, bId }].' });
  }

  // Apply each merge sequentially, each producing a new tree
  let updatedTree = session.cleanTree;
  for (const { keepId, removeId } of mergeList) {
    updatedTree = applyMerge(updatedTree, keepId, removeId);
  }

  session.cleanTree = updatedTree;

  if (approveAll) {
    session.mergeCandidates = [];
    session.duplicateSubtrees = [];
  } else {
    // Remove resolved pairs from mergeCandidates (where aId or bId matches any processed pair)
    const resolvedIds = new Set(mergeList.flatMap(({ keepId, removeId }) => [keepId, removeId]));
    session.mergeCandidates = session.mergeCandidates.filter(
      c => !resolvedIds.has(c.aId) && !resolvedIds.has(c.bId)
    );
    // Also remove resolved duplicateSubtrees
    session.duplicateSubtrees = session.duplicateSubtrees.filter(
      d => !resolvedIds.has(d.keepId) && !resolvedIds.has(d.removeId)
    );
  }

  res.json({
    cleanTree: session.cleanTree,
    mergeCandidates: session.mergeCandidates,
    duplicateSubtrees: session.duplicateSubtrees,
  });
});

export default router;
