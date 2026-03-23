import { Router } from 'express';
import { dedupTree, countLinks } from '../dedup.js';
import { findMergeCandidates, findDuplicateSubtrees } from '../fuzzy.js';
import { session } from '../session.js';

const router = Router();

router.post('/cleanup', (req, res) => {
  if (!session.tree) {
    return res.status(400).json({ error: 'No bookmark file loaded.' });
  }

  // 1. Dedup — returns new tree, never mutates session.tree (per D-07)
  const originalLinkCount = countLinks(session.tree);
  const cleanTree = dedupTree(session.tree);
  const cleanLinkCount = countLinks(cleanTree);
  const dupesRemoved = originalLinkCount - cleanLinkCount;

  // 2. Fuzzy folder matches (per D-06, threshold 0.25)
  const mergeCandidates = findMergeCandidates(cleanTree);

  // 3. Duplicate subtrees
  const duplicateSubtrees = findDuplicateSubtrees(cleanTree);

  // 4. Persist to session
  session.cleanTree = cleanTree;
  session.mergeCandidates = mergeCandidates;
  session.duplicateSubtrees = duplicateSubtrees;

  res.json({
    cleanTree,
    stats: { dupesRemoved, duplicateSubtreesFound: duplicateSubtrees.length },
    mergeCandidates,
    duplicateSubtrees,
  });
});

export default router;
