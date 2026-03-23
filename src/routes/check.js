import { Router } from 'express';
import { session } from '../session.js';
import { checkAll } from '../linkChecker.js';

const router = Router();

/**
 * GET /check-links
 * SSE endpoint that streams link-check progress events.
 * Events: 'progress' (incremental), 'done' (summary), 'error' (on failure)
 */
router.get('/check-links', async (req, res) => {
  const sourceTree = session.cleanTree ?? session.tree;
  if (!sourceTree) {
    return res.status(400).json({ error: 'No bookmarks loaded.' });
  }

  // Set SSE headers BEFORE any async work so the stream establishes immediately
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Track cancellation from client-side disconnect
  let cancelled = false;
  req.on('close', () => {
    cancelled = true;
  });

  /** Write a named SSE event with JSON payload */
  function send(eventName, data) {
    if (!cancelled) {
      res.write('event: ' + eventName + '\ndata: ' + JSON.stringify(data) + '\n\n');
    }
  }

  try {
    const result = await checkAll(sourceTree, (progress) => send('progress', progress));
    session.checkedTree = result.checkedTree;
    send('done', { deadCount: result.deadCount, uncertainCount: result.uncertainCount });
  } catch (err) {
    send('error', { message: err.message });
  } finally {
    if (!cancelled) res.end();
  }
});

/**
 * GET /check-result
 * Returns the checked tree (built during the last /check-links run).
 */
router.get('/check-result', (req, res) => {
  if (!session.checkedTree) {
    return res.status(404).json({ error: 'No link check results available.' });
  }
  return res.json({ tree: session.checkedTree });
});

export default router;
