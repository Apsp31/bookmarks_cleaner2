import { Router } from 'express';
import multer from 'multer';
import { parseBookmarkHtml } from '../parser.js';
import { session } from '../session.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Count bookmark and folder nodes in the tree.
 *
 * @param {import('../shared/types.js').BookmarkNode} node
 * @returns {{ bookmarkCount: number, folderCount: number }}
 */
function countNodes(node) {
  let bookmarkCount = 0;
  let folderCount = 0;

  function walk(n) {
    if (n.type === 'folder') {
      folderCount++;
      if (n.children) {
        n.children.forEach(walk);
      }
    } else if (n.type === 'link') {
      bookmarkCount++;
    }
  }

  walk(node);
  return { bookmarkCount, folderCount };
}

router.post('/upload', upload.single('bookmarks'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const html = req.file.buffer.toString('utf-8');
  const tree = parseBookmarkHtml(html);
  const { bookmarkCount, folderCount } = countNodes(tree);

  session.tree = tree;
  session.originalHtml = html;
  session.cleanTree = null;
  session.checkedTree = null;
  session.mergeCandidates = [];
  session.duplicateSubtrees = [];
  session.classifiedTree = null;

  res.json({ tree, stats: { bookmarkCount, folderCount } });
});

export default router;
