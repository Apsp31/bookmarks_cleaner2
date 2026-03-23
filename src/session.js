/**
 * Module-level singleton session store.
 * Single-user tool — no cookies, no session IDs needed.
 *
 * @type {{ tree: import('./shared/types.js').BookmarkNode | null, originalHtml: string | null }}
 */
const session = { tree: null, originalHtml: null };

export { session };
