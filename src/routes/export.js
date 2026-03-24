import { Router } from 'express';
import { exportToNetscape } from '../exporter.js';
import { session } from '../session.js';
import { pruneEmptyFolders } from '../shared/treeUtils.js';

const router = Router();

router.get('/export', (req, res) => {
  if (!session.tree) {
    return res.status(404).json({ error: 'No bookmark file loaded. Upload a file first.' });
  }

  const source = session.classifiedTree ?? session.checkedTree ?? session.cleanTree ?? session.tree;
  const pruned = pruneEmptyFolders(source);
  const html = exportToNetscape(pruned);

  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookmarks-clean.html"');
  res.send(html);
});

export default router;
