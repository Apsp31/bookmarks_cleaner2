/**
 * @typedef {Object} BookmarkNode
 * @property {string} id - Stable UUID assigned at parse time (crypto.randomUUID())
 * @property {'folder'|'link'} type
 * @property {string} title
 * @property {string} [url] - Only present when type === 'link'
 * @property {number} [addDate] - Unix timestamp in seconds from ADD_DATE attribute
 * @property {BookmarkNode[]} [children] - Only present when type === 'folder'
 * @property {'ok'|'dead'|'redirect'|'pending'} [linkStatus] - Set by Phase 3
 * @property {string} [category] - Set by Phase 4
 */

export {};
