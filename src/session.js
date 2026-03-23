/**
 * Module-level singleton session store.
 * Single-user tool — no cookies, no session IDs needed.
 *
 * @type {{
 *   tree: import('./shared/types.js').BookmarkNode | null,
 *   originalHtml: string | null,
 *   cleanTree: import('./shared/types.js').BookmarkNode | null,
 *   checkedTree: import('./shared/types.js').BookmarkNode | null,
 *   mergeCandidates: Array<{aId: string, aName: string, bId: string, bName: string, score: number}>,
 *   duplicateSubtrees: Array<{keepId: string, keepName: string, removeId: string, removeName: string}>,
 *   classifiedTree: import('./shared/types.js').BookmarkNode | null
 * }}
 */
const session = { tree: null, originalHtml: null, cleanTree: null, checkedTree: null, mergeCandidates: [], duplicateSubtrees: [], classifiedTree: null };

export { session };
