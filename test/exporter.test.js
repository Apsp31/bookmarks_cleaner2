import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportToNetscape } from '../src/exporter.js';

// Helper to build a minimal BookmarkNode tree for targeted tests
function makeLink(title, url, addDate) {
  const node = { id: 'test-id-001', type: 'link', title, url };
  if (addDate !== undefined) node.addDate = addDate;
  return node;
}

function makeFolder(title, children = [], addDate) {
  const node = { id: 'test-id-002', type: 'folder', title, children };
  if (addDate !== undefined) node.addDate = addDate;
  return node;
}

const minimalTree = makeFolder('root', [
  makeLink('Example', 'https://example.com/', 1609459200),
]);

test('exportToNetscape output starts with DOCTYPE NETSCAPE-Bookmark-file-1', () => {
  const html = exportToNetscape(minimalTree);
  assert.ok(html.startsWith('<!DOCTYPE NETSCAPE-Bookmark-file-1>'), 'Output should start with DOCTYPE');
});

test('exportToNetscape output contains META HTTP-EQUIV Content-Type', () => {
  const html = exportToNetscape(minimalTree);
  assert.ok(html.includes('<META HTTP-EQUIV="Content-Type"'), 'Output should contain META tag');
});

test('exportToNetscape output contains TITLE Bookmarks', () => {
  const html = exportToNetscape(minimalTree);
  assert.ok(html.includes('<TITLE>Bookmarks</TITLE>'), 'Output should contain TITLE tag');
});

test('link node with title "AT&T" exports as >AT&amp;T</A>', () => {
  const tree = makeFolder('root', [makeLink('AT&T', 'https://att.com/')]);
  const html = exportToNetscape(tree);
  assert.ok(html.includes('>AT&amp;T</A>'), 'Ampersand in title should be escaped as &amp;');
});

test('link node with URL containing & exports with &amp; in HREF attribute', () => {
  const tree = makeFolder('root', [makeLink('Search', 'https://example.com/search?q=hello&lang=en')]);
  const html = exportToNetscape(tree);
  assert.ok(
    html.includes('HREF="https://example.com/search?q=hello&amp;lang=en"'),
    'Ampersand in URL should be escaped as &amp;'
  );
});

test('title with double-quote exports as &quot; in text content', () => {
  const tree = makeFolder('root', [makeLink('He said "hello"', 'https://example.com/')]);
  const html = exportToNetscape(tree);
  assert.ok(html.includes('&quot;hello&quot;'), 'Double-quote in title should be escaped as &quot;');
});

test('title with < exports as &lt; in text content', () => {
  const tree = makeFolder('root', [makeLink('A < B', 'https://example.com/')]);
  const html = exportToNetscape(tree);
  assert.ok(html.includes('&lt;'), 'Less-than in title should be escaped as &lt;');
});

test('folder nodes produce DT H3 title H3 followed by DL p', () => {
  const tree = makeFolder('root', [
    makeFolder('My Folder', [makeLink('Item', 'https://example.com/')]),
  ]);
  const html = exportToNetscape(tree);
  assert.ok(html.includes('<DT><H3'), 'Folder should produce DT H3 element');
  assert.ok(html.includes('</H3>'), 'Folder H3 should be closed');
  assert.ok(html.includes('<DL><p>'), 'Folder children should be in DL element');
});

test('ADD_DATE is included in output when present on the node', () => {
  const tree = makeFolder('root', [makeLink('Example', 'https://example.com/', 1609459200)]);
  const html = exportToNetscape(tree);
  assert.ok(html.includes('ADD_DATE="1609459200"'), 'ADD_DATE should appear in output when present');
});

test('ADD_DATE is omitted from output when undefined on the node', () => {
  const tree = makeFolder('root', [makeLink('Example', 'https://example.com/')]);
  const html = exportToNetscape(tree);
  assert.ok(!html.includes('ADD_DATE'), 'ADD_DATE should not appear in output when undefined');
});
