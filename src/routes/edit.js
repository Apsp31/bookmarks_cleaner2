import { Router } from 'express';
import { session } from '../session.js';
import { deleteNode, moveNode, markKeep } from '../shared/treeOps.js';

const router = Router();

router.post('/edit', (req, res) => {
  const { op, nodeId, targetFolderId } = req.body;

  if (!session.classifiedTree) {
    return res.status(400).json({ error: 'No classified tree. Run classify first.' });
  }

  if (!nodeId) {
    return res.status(400).json({ error: 'nodeId is required.' });
  }

  let updated;
  if (op === 'delete') {
    updated = deleteNode(structuredClone(session.classifiedTree), nodeId);
  } else if (op === 'move') {
    if (!targetFolderId) {
      return res.status(400).json({ error: 'targetFolderId is required for move.' });
    }
    updated = moveNode(structuredClone(session.classifiedTree), nodeId, targetFolderId);
  } else if (op === 'keep') {
    updated = markKeep(structuredClone(session.classifiedTree), nodeId);
  } else {
    return res.status(400).json({ error: 'Unknown op: ' + op });
  }

  session.classifiedTree = updated;
  res.json({ classifiedTree: updated });
});

export default router;
