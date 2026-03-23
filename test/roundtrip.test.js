import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseBookmarkHtml } from '../src/parser.js';
import { exportToNetscape } from '../src/exporter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleHtml = readFileSync(join(__dirname, 'fixtures', 'sample-bookmarks.html'), 'utf-8');

function countNodes(node) {
  let bookmarks = 0;
  let folders = 0;
  function walk(n) {
    if (n.type === 'link') {
      bookmarks++;
    } else {
      folders++;
      for (const child of (n.children || [])) walk(child);
    }
  }
  walk(node);
  return { bookmarks, folders };
}

test('round-trip: bookmark counts match after parse-export-reparse', () => {
  const tree1 = parseBookmarkHtml(sampleHtml);
  const exported = exportToNetscape(tree1);
  const tree2 = parseBookmarkHtml(exported);

  const c1 = countNodes(tree1);
  const c2 = countNodes(tree2);

  assert.equal(c2.bookmarks, c1.bookmarks, `Bookmark count mismatch: expected ${c1.bookmarks}, got ${c2.bookmarks}`);
});

test('round-trip: folder counts match after parse-export-reparse', () => {
  const tree1 = parseBookmarkHtml(sampleHtml);
  const exported = exportToNetscape(tree1);
  const tree2 = parseBookmarkHtml(exported);

  const c1 = countNodes(tree1);
  const c2 = countNodes(tree2);

  assert.equal(c2.folders, c1.folders, `Folder count mismatch: expected ${c1.folders}, got ${c2.folders}`);
});

test('round-trip: no node has undefined or NaN addDate in exported HTML', () => {
  const tree1 = parseBookmarkHtml(sampleHtml);
  const exported = exportToNetscape(tree1);

  assert.ok(!exported.includes('ADD_DATE="undefined"'), 'Exported HTML should not contain ADD_DATE="undefined"');
  assert.ok(!exported.includes('ADD_DATE="NaN"'), 'Exported HTML should not contain ADD_DATE="NaN"');
});
