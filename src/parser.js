import * as cheerio from 'cheerio';
import { randomUUID } from 'crypto';

/**
 * Parse a Chrome Netscape Bookmark Format HTML string into a BookmarkNode tree.
 *
 * @param {string} html - The raw bookmark HTML string
 * @returns {import('./shared/types.js').BookmarkNode} The root BookmarkNode
 */
export function parseBookmarkHtml(html) {
  const $ = cheerio.load(html, { xmlMode: false });

  /**
   * Recursively walk a <DL> element and build BookmarkNode children.
   *
   * @param {cheerio.Cheerio} $dl - The <DL> element to walk
   * @returns {import('./shared/types.js').BookmarkNode[]}
   */
  function parseList($dl) {
    const nodes = [];

    $dl.children('dt').each((_, dt) => {
      const $dt = $(dt);
      const $h3 = $dt.children('h3').first();
      const $a = $dt.children('a').first();

      if ($h3.length) {
        // Folder: htmlparser2 places the child <DL> inside the <DT> element (since <DT> is
        // not explicitly closed in Netscape Bookmark Format). Try children('dl') first.
        // Fall back to nextAll('dl') in case the parser places it as a sibling instead.
        let $childDl = $dt.children('dl').first();
        if (!$childDl.length) {
          $childDl = $dt.nextAll('dl').first();
        }
        const addDateAttr = $h3.attr('add_date');

        nodes.push({
          id: randomUUID(),
          type: 'folder',
          title: $h3.text(),
          addDate: addDateAttr ? parseInt(addDateAttr, 10) : undefined,
          children: $childDl.length ? parseList($childDl) : [],
        });
      } else if ($a.length) {
        const addDateAttr = $a.attr('add_date');

        nodes.push({
          id: randomUUID(),
          type: 'link',
          title: $a.text(),
          url: $a.attr('href'),
          addDate: addDateAttr ? parseInt(addDateAttr, 10) : undefined,
        });
      }
    });

    return nodes;
  }

  // The root <DL> is the top-level list immediately following the <H1>
  const $root = $('dl').first();

  return {
    id: randomUUID(),
    type: 'folder',
    title: 'root',
    children: parseList($root),
  };
}
