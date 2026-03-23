/**
 * Link Checker Engine
 *
 * Exports:
 *   checkUrl(url)         – single URL check; HEAD-first, GET-fallback on 405/error
 *   checkAll(tree, onProgress) – walk tree, check all links with two-level concurrency
 *   buildCheckedTree(tree, linkStatuses) – deep-clone tree, remove dead nodes, annotate survivors
 */

import pLimit from 'p-limit';
import { load as cheerioLoad } from 'cheerio';

// ─── concurrency ──────────────────────────────────────────────────────────────

const globalLimit = pLimit(20);

/** Lazy per-domain limiter; max 2 concurrent requests per hostname */
const domainLimiters = new Map();
function getDomainLimiter(hostname) {
  if (!domainLimiters.has(hostname)) domainLimiters.set(hostname, pLimit(2));
  return domainLimiters.get(hostname);
}

// ─── status resolution ────────────────────────────────────────────────────────

/**
 * Map an HTTP response to our status vocabulary.
 * 429 → 'uncertain', 401/403 → 'ok', 2xx → 'ok', everything else → 'dead'
 * @param {Response} response
 * @returns {'ok'|'dead'|'uncertain'}
 */
function resolveStatus(response) {
  const { status } = response;
  if (status === 429) return 'uncertain';
  if (status === 401 || status === 403) return 'ok';
  if (status >= 200 && status < 300) return 'ok';
  return 'dead';
}

// ─── OG metadata extraction ───────────────────────────────────────────────────

/**
 * Extract OG / meta tags from a 2xx HTML GET response.
 * Returns null if the content-type is not text/html or the response has no body.
 * @param {Response} response
 * @returns {Promise<{title?:string, description?:string, image?:string}|null>}
 */
async function extractMetadata(response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return null;

  const html = await response.text();
  const $ = cheerioLoad(html);

  const title = $('meta[property="og:title"]').attr('content') || undefined;
  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    undefined;
  const image = $('meta[property="og:image"]').attr('content') || undefined;

  if (!title && !description && !image) return null;
  return { title, description, image };
}

// ─── internal fetch with HEAD-first / GET-fallback ───────────────────────────

/**
 * Attempt HEAD first (5 s timeout). On 405 or thrown error, retry as GET (8 s).
 * Non-2xx from HEAD is definitive — no GET fallback.
 *
 * Returns: { status, finalUrl, metadata }
 *   status   – 'ok' | 'dead' | 'uncertain'
 *   finalUrl – response.url if it differs from the input (redirect)
 *   metadata – OG object from GET HTML response, or undefined
 *
 * @param {string} url
 * @returns {Promise<{status: string, finalUrl?: string, metadata?: object}>}
 */
async function _fetchUrl(url) {
  // ── HEAD attempt ────────────────────────────────────────────────────────────
  let headResponse = null;
  let headError = null;

  try {
    headResponse = await globalThis.fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    headError = err;
  }

  // If HEAD threw, fall back to GET
  if (headError !== null) {
    return _getRequest(url);
  }

  // HEAD returned 405 → fall back to GET
  if (headResponse.status === 405) {
    return _getRequest(url);
  }

  // Non-2xx HEAD response is definitive
  const status = resolveStatus(headResponse);
  const finalUrl = headResponse.url !== url ? headResponse.url : undefined;
  return { status, finalUrl };
}

/**
 * Perform a GET request with 8 s timeout and extract OG metadata from HTML.
 * @param {string} url
 * @returns {Promise<{status: string, finalUrl?: string, metadata?: object}>}
 */
async function _getRequest(url) {
  let response;
  try {
    response = await globalThis.fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    return { status: 'dead' };
  }

  const status = resolveStatus(response);
  const finalUrl = response.url !== url ? response.url : undefined;

  let metadata;
  if (status === 'ok') {
    const extracted = await extractMetadata(response);
    if (extracted) metadata = extracted;
  }

  return { status, finalUrl, metadata };
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Check a single URL.
 * @param {string} url
 * @returns {Promise<{status: 'ok'|'dead'|'uncertain', finalUrl?: string, metadata?: object}>}
 */
export async function checkUrl(url) {
  // Validate URL — malformed URLs are immediately dead
  try {
    new URL(url);
  } catch {
    return { status: 'dead' };
  }

  try {
    return await _fetchUrl(url);
  } catch {
    return { status: 'dead' };
  }
}

// ─── collect links from tree ──────────────────────────────────────────────────

/**
 * Recursive walk collecting all link nodes.
 * @param {import('./shared/types.js').BookmarkNode} node
 * @returns {{ id: string, url: string }[]}
 */
function collectLinks(node) {
  if (node.type === 'link') return [{ id: node.id, url: node.url }];
  const results = [];
  for (const child of node.children ?? []) {
    results.push(...collectLinks(child));
  }
  return results;
}

// ─── ETA calculation ─────────────────────────────────────────────────────────

/**
 * Linear-extrapolation ETA in seconds.
 * @param {number} checked
 * @param {number} total
 * @param {number} elapsedMs
 * @returns {number|null}
 */
function calcEta(checked, total, elapsedMs) {
  if (checked === 0 || elapsedMs === 0) return null;
  const rate = checked / elapsedMs; // checks per ms
  const remaining = total - checked;
  return remaining / rate / 1000; // seconds
}

// ─── buildCheckedTree ─────────────────────────────────────────────────────────

/**
 * Deep-clone tree, remove dead-status link nodes, annotate survivors.
 * Empty folders are preserved (cleanup is Phase 5).
 * Does NOT mutate the input tree.
 *
 * @param {import('./shared/types.js').BookmarkNode} node
 * @param {Map<string, {status: string, finalUrl?: string, metadata?: object}>} linkStatuses
 * @returns {import('./shared/types.js').BookmarkNode}
 */
export function buildCheckedTree(node, linkStatuses) {
  if (node.type === 'link') {
    const result = linkStatuses.get(node.id);
    if (!result || result.status === 'dead') return null;

    const cloned = { ...node, linkStatus: result.status };
    if (result.finalUrl) cloned.finalUrl = result.finalUrl;
    if (result.metadata) cloned.metadata = result.metadata;
    return cloned;
  }

  // Folder: recurse, filter out dead link children (nulls), keep folders
  const clonedChildren = (node.children ?? [])
    .map(child => buildCheckedTree(child, linkStatuses))
    .filter(child => child !== null);

  return { ...node, children: clonedChildren };
}

// ─── checkAll ────────────────────────────────────────────────────────────────

/**
 * Check all link nodes in the tree with two-level concurrency.
 *
 * @param {import('./shared/types.js').BookmarkNode} tree
 * @param {(event: {checked:number, total:number, currentUrl:string, eta:number|null}) => void} onProgress
 * @returns {Promise<{checkedTree: import('./shared/types.js').BookmarkNode, deadCount: number, uncertainCount: number}>}
 */
export async function checkAll(tree, onProgress) {
  const links = collectLinks(tree);
  const total = links.length;
  const linkStatuses = new Map();
  let checked = 0;
  const startEpoch = Date.now();

  await Promise.all(
    links.map(({ id, url }) => {
      let hostname;
      try {
        hostname = new URL(url).hostname;
      } catch {
        hostname = '__invalid__';
      }

      const domainLimit = getDomainLimiter(hostname);

      return globalLimit(() =>
        domainLimit(async () => {
          const result = await checkUrl(url);
          linkStatuses.set(id, result);
          checked++;
          const elapsed = Date.now() - startEpoch;
          onProgress({
            checked,
            total,
            currentUrl: url,
            eta: calcEta(checked, total, elapsed),
          });
        })
      );
    })
  );

  const checkedTree = buildCheckedTree(tree, linkStatuses);
  const deadCount = [...linkStatuses.values()].filter(r => r.status === 'dead').length;
  const uncertainCount = [...linkStatuses.values()].filter(r => r.status === 'uncertain').length;

  return { checkedTree, deadCount, uncertainCount };
}
