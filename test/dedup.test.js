import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, dedupTree, countLinks } from '../src/dedup.js';

// Helper to build a BookmarkNode
function makeLink(id, title, url) {
  return { id, type: 'link', title, url };
}

function makeFolder(id, title, children = []) {
  return { id, type: 'folder', title, children };
}

describe('normalizeUrl', () => {
  it('Test 1: strips fragment', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/page#section'),
      'https://example.com/page'
    );
  });

  it('Test 2: normalizes http to https', () => {
    assert.strictEqual(
      normalizeUrl('http://example.com'),
      'https://example.com/'
    );
  });

  it('Test 3: strips www prefix', () => {
    assert.strictEqual(
      normalizeUrl('https://www.example.com/'),
      'https://example.com/'
    );
  });

  it('Test 4: strips trailing slash from non-root path', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/path/'),
      'https://example.com/path'
    );
  });

  it('Test 5: deletes utm_source, utm_medium, utm_campaign, utm_term, utm_content', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/?utm_source=x&utm_medium=y&real=1'),
      'https://example.com/?real=1'
    );
  });

  it('Test 6: deletes fbclid', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/?fbclid=abc123'),
      'https://example.com/'
    );
  });

  it('Test 7: deletes gclid', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/?gclid=abc123'),
      'https://example.com/'
    );
  });

  it('Test 8: combined — http + www + utm + fbclid + fragment + trailing slash', () => {
    assert.strictEqual(
      normalizeUrl('http://www.example.com/page/?utm_source=x&fbclid=y#top'),
      'https://example.com/page'
    );
  });

  it('Test 9: returns raw string for unparseable URLs (javascript:void(0))', () => {
    assert.strictEqual(
      normalizeUrl('javascript:void(0)'),
      'javascript:void(0)'
    );
  });

  it('Test 10: root path trailing slash is NOT stripped', () => {
    assert.strictEqual(
      normalizeUrl('https://example.com/'),
      'https://example.com/'
    );
  });
});

describe('dedupTree', () => {
  it('Test 11: keeps first occurrence, drops second with same URL', () => {
    const tree = makeFolder('root', 'root', [
      makeLink('1', 'Page A', 'https://example.com/page'),
      makeLink('2', 'Page A dup', 'https://example.com/page'),
    ]);
    const result = dedupTree(tree);
    assert.strictEqual(result.children.length, 1);
    assert.strictEqual(result.children[0].id, '1');
  });

  it('Test 12: keeps first across different branches (sibling folders)', () => {
    const tree = makeFolder('root', 'root', [
      makeFolder('f1', 'Folder 1', [
        makeLink('1', 'Page', 'https://example.com/page'),
      ]),
      makeFolder('f2', 'Folder 2', [
        makeLink('2', 'Page dup', 'https://example.com/page'),
      ]),
    ]);
    const result = dedupTree(tree);
    assert.strictEqual(result.children[0].children.length, 1);
    assert.strictEqual(result.children[1].children.length, 0);
  });

  it('Test 13: returns new tree object (original tree is not mutated)', () => {
    const original = makeFolder('root', 'root', [
      makeLink('1', 'Page', 'https://example.com/page'),
      makeLink('2', 'Page dup', 'https://example.com/page'),
    ]);
    const originalChildCount = original.children.length;
    const result = dedupTree(original);
    assert.notStrictEqual(result, original);
    assert.strictEqual(original.children.length, originalChildCount);
  });

  it('Test 14: handles folders with no link children (no crash)', () => {
    const tree = makeFolder('root', 'root', [
      makeFolder('empty', 'Empty Folder', []),
    ]);
    const result = dedupTree(tree);
    assert.strictEqual(result.children.length, 1);
    assert.strictEqual(result.children[0].children.length, 0);
  });
});

describe('countLinks', () => {
  it('Test 15: counts all link nodes recursively in a tree', () => {
    const tree = makeFolder('root', 'root', [
      makeLink('1', 'A', 'https://a.com'),
      makeFolder('f1', 'Folder', [
        makeLink('2', 'B', 'https://b.com'),
        makeLink('3', 'C', 'https://c.com'),
      ]),
    ]);
    assert.strictEqual(countLinks(tree), 3);
  });
});
