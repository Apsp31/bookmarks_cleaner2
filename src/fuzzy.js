import { createHash } from 'node:crypto';
import { distance } from 'fastest-levenshtein';
import { normalizeUrl } from './dedup.js';

/**
 * Returns true if two folder names are similar enough to be merge candidates.
 * Uses Levenshtein distance ratio <= 0.25 (D-06, fixed threshold for v1).
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function isSimilarName(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return false;
  return distance(a.toLowerCase(), b.toLowerCase()) / maxLen <= 0.25;
}

/**
 * Recursively collects all folder nodes from a tree.
 * Skips the synthetic root node (title === 'root') per Pitfall 4.
 *
 * @param {import('./shared/types.js').BookmarkNode} node
 * @param {import('./shared/types.js').BookmarkNode[]} result
 * @returns {import('./shared/types.js').BookmarkNode[]}
 */
function collectFolders(node, result = []) {
  if (node.type === 'folder' && node.title !== 'root') {
    result.push(node);
  }
  for (const child of (node.children ?? [])) {
    collectFolders(child, result);
  }
  return result;
}

/**
 * Finds pairs of folders with similar names that may be merge candidates.
 * Compares all unique pairs O(n²) — fine for typical bookmark collections (<200 folders).
 *
 * @param {import('./shared/types.js').BookmarkNode} tree
 * @returns {{ aId: string, aName: string, bId: string, bName: string, score: number }[]}
 */
export function findMergeCandidates(tree) {
  const folders = collectFolders(tree);
  const candidates = [];

  for (let i = 0; i < folders.length; i++) {
    for (let j = i + 1; j < folders.length; j++) {
      const a = folders[i];
      const b = folders[j];
      if (isSimilarName(a.title, b.title)) {
        const maxLen = Math.max(a.title.length, b.title.length);
        candidates.push({
          aId: a.id,
          aName: a.title,
          bId: b.id,
          bName: b.title,
          score: distance(a.title.toLowerCase(), b.title.toLowerCase()) / maxLen,
        });
      }
    }
  }

  return candidates;
}

/**
 * Returns a SHA-256 fingerprint of a folder based on its direct link-child URLs.
 * URLs are normalized and sorted before hashing so order does not matter.
 * Only direct children are considered (not recursive) to avoid false positives
 * from large parent folders that share a few nested bookmarks.
 *
 * @param {import('./shared/types.js').BookmarkNode} folder
 * @returns {string} SHA-256 hex digest
 */
export function fingerprintSubtree(folder) {
  const urls = (folder.children ?? [])
    .filter(n => n.type === 'link')
    .map(n => normalizeUrl(n.url ?? ''))
    .sort();

  return createHash('sha256').update(JSON.stringify(urls)).digest('hex');
}

/**
 * Detects folders with identical link-URL sets (potential duplicate subtrees).
 * Skips folders with zero link children (empty folders are trivially "equal").
 * For each group of >1 identical folders, keeps the first and flags the rest for removal.
 *
 * @param {import('./shared/types.js').BookmarkNode} tree
 * @returns {{ keepId: string, keepName: string, removeId: string, removeName: string }[]}
 */
export function findDuplicateSubtrees(tree) {
  const folders = collectFolders(tree);
  const byFingerprint = new Map();

  for (const folder of folders) {
    const links = (folder.children ?? []).filter(n => n.type === 'link');
    if (links.length === 0) continue; // skip empty folders

    const fp = fingerprintSubtree(folder);
    if (!byFingerprint.has(fp)) {
      byFingerprint.set(fp, []);
    }
    byFingerprint.get(fp).push(folder);
  }

  const duplicatePairs = [];
  for (const [, group] of byFingerprint) {
    if (group.length > 1) {
      // Keep first, flag rest for removal
      for (let i = 1; i < group.length; i++) {
        duplicatePairs.push({
          keepId: group[0].id,
          keepName: group[0].title,
          removeId: group[i].id,
          removeName: group[i].title,
        });
      }
    }
  }

  return duplicatePairs;
}
