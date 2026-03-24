import { Router } from 'express';
import { session } from '../session.js';
import { classifyTree } from '../classifier.js';
import { buildHierarchy } from '../hierarchyBuilder.js';

const router = Router();

router.post('/classify', (req, res) => {
  const source = session.checkedTree ?? session.cleanTree;
  if (!source) {
    return res.status(400).json({ error: 'No checked tree available. Run link check first.' });
  }
  const reclassifyFolders = new Set(
    Array.isArray(req.body?.reclassifyFolders) ? req.body.reclassifyFolders : []
  );
  const classified = classifyTree(source, reclassifyFolders);
  const classifiedTree = buildHierarchy(classified);
  session.classifiedTree = classifiedTree;
  res.json({ classifiedTree });
});

export default router;
