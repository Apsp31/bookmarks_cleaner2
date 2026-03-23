import { URL } from 'node:url';

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid',
]);

/**
 * Returns a canonical URL string suitable for deduplication comparison.
 * Applies 7 normalization rules: strip fragment, http→https, strip www,
 * strip trailing slash from non-root paths, delete tracking params.
 *
 * @param {string} rawUrl
 * @returns {string} Canonical URL string, or rawUrl unchanged if unparseable
 */
export function normalizeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    // Unparseable URLs (javascript:, mailto:, data:, etc.) — return raw
    return rawUrl;
  }

  // Rule 1: strip fragment
  parsed.hash = '';

  // Rule 2: http → https
  if (parsed.protocol === 'http:') {
    parsed.protocol = 'https:';
  }

  // Rule 3: strip www. prefix
  if (parsed.hostname.startsWith('www.')) {
    parsed.hostname = parsed.hostname.slice(4);
  }

  // Rule 4: strip trailing slash from non-root pathnames
  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  // Rules 5-7: strip tracking params
  // Snapshot keys before iterating to avoid live iterator mutation (Pitfall 1)
  const keys = [...parsed.searchParams.keys()];
  for (const key of keys) {
    if (TRACKING_PARAMS.has(key)) {
      parsed.searchParams.delete(key);
    }
  }

  return parsed.toString();
}

/**
 * Depth-first top-down tree walk that returns a new tree with duplicate URLs removed.
 * Keeps the first occurrence of each normalized URL; discards subsequent duplicates.
 * Never mutates the original tree.
 *
 * @param {import('./shared/types.js').BookmarkNode} node
 * @param {Set<string>} [seen] - Shared Set of normalized URLs (passed by reference across recursion)
 * @returns {import('./shared/types.js').BookmarkNode | null}
 */
export function dedupTree(node, seen = new Set()) {
  if (node.type === 'link') {
    const canonical = normalizeUrl(node.url ?? '');
    if (seen.has(canonical)) return null; // duplicate — drop
    seen.add(canonical);
    return { ...node }; // shallow copy — links have no children
  }

  // Folder: recurse children, filter out nulls
  const newChildren = (node.children ?? [])
    .map(child => dedupTree(child, seen))
    .filter(Boolean);

  return { ...node, children: newChildren };
}

/**
 * Recursively counts all link nodes in a tree.
 *
 * @param {import('./shared/types.js').BookmarkNode} node
 * @returns {number}
 */
export function countLinks(node) {
  if (node.type === 'link') return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countLinks(child), 0);
}
