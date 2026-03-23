/**
 * Escape special HTML characters in a string.
 * Order matters: & must be replaced first to avoid double-escaping.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Serialize a single BookmarkNode to Netscape HTML format.
 *
 * @param {import('./shared/types.js').BookmarkNode} node
 * @param {number} indent - Current indentation level (number of 4-space units)
 * @returns {string}
 */
function serializeNode(node, indent = 1) {
  const pad = '    '.repeat(indent);

  if (node.type === 'link') {
    const addDateAttr =
      node.addDate !== undefined && Number.isFinite(node.addDate)
        ? ` ADD_DATE="${node.addDate}"`
        : '';
    return `${pad}<DT><A HREF="${escapeHtml(node.url)}"${addDateAttr}>${escapeHtml(node.title)}</A>`;
  }

  // Folder
  const addDateAttr =
    node.addDate !== undefined && Number.isFinite(node.addDate)
      ? ` ADD_DATE="${node.addDate}"`
      : '';
  const childLines = (node.children || [])
    .map(child => serializeNode(child, indent + 1))
    .join('\n');

  return [
    `${pad}<DT><H3${addDateAttr}>${escapeHtml(node.title)}</H3>`,
    `${pad}<DL><p>`,
    childLines,
    `${pad}</DL><p>`,
  ].join('\n');
}

/**
 * Serialize a BookmarkNode tree to Chrome-importable Netscape Bookmark HTML.
 *
 * @param {import('./shared/types.js').BookmarkNode} rootNode - The root folder node
 * @returns {string} The complete Netscape Bookmark HTML string
 */
export function exportToNetscape(rootNode) {
  const childLines = (rootNode.children || [])
    .map(child => serializeNode(child, 1))
    .join('\n');

  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${childLines}
</DL><p>`;
}
