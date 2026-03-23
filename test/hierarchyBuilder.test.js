import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHierarchy } from '../src/hierarchyBuilder.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLink(id, title, url, category) {
  return { id, type: 'link', title, url, category };
}

function makeFolder(id, title, children = []) {
  return { id, type: 'folder', title, children };
}

/**
 * Compute max depth of a BookmarkNode tree.
 * Root is depth 0; its children are depth 1; their children are depth 2; etc.
 */
function maxDepth(node, depth = 0) {
  if (node.type === 'link' || !node.children || node.children.length === 0) return depth;
  return Math.max(...node.children.map(c => maxDepth(c, depth + 1)));
}

/**
 * Collect all link nodes from a tree recursively.
 */
function collectLinks(node) {
  if (node.type === 'link') return [node];
  return (node.children ?? []).flatMap(collectLinks);
}

// ─── buildHierarchy tests ─────────────────────────────────────────────────────

describe('buildHierarchy', () => {
  it('groups 3 links of same category into 1 top-level folder', () => {
    const tree = makeFolder('root', 'root', [
      makeLink('a', 'GitHub', 'https://github.com', 'Development'),
      makeLink('b', 'GitLab', 'https://gitlab.com', 'Development'),
      makeLink('c', 'NPM', 'https://npmjs.com', 'Development'),
    ]);
    const result = buildHierarchy(tree);
    assert.equal(result.type, 'folder');
    assert.equal(result.title, 'root');
    assert.equal(result.children.length, 1);
    assert.equal(result.children[0].title, 'Development');
    assert.equal(result.children[0].children.length, 3);
  });

  it('groups 5 links across 3 categories into 3 top-level folders', () => {
    const tree = makeFolder('root', 'root', [
      makeLink('a', 'GitHub', 'https://github.com', 'Development'),
      makeLink('b', 'YouTube', 'https://youtube.com', 'Video'),
      makeLink('c', 'Reddit', 'https://reddit.com', 'Social / Community'),
      makeLink('d', 'GitLab', 'https://gitlab.com', 'Development'),
      makeLink('e', 'Vimeo', 'https://vimeo.com', 'Video'),
    ]);
    const result = buildHierarchy(tree);
    assert.equal(result.children.length, 3);
    const devFolder = result.children.find(c => c.title === 'Development');
    const videoFolder = result.children.find(c => c.title === 'Video');
    const socialFolder = result.children.find(c => c.title === 'Social / Community');
    assert.ok(devFolder, 'Development folder should exist');
    assert.ok(videoFolder, 'Video folder should exist');
    assert.ok(socialFolder, 'Social / Community folder should exist');
    assert.equal(devFolder.children.length, 2);
    assert.equal(videoFolder.children.length, 2);
    assert.equal(socialFolder.children.length, 1);
  });

  it('output root node has type=folder and title=root', () => {
    const tree = makeFolder('r', 'root', [
      makeLink('a', 'GitHub', 'https://github.com', 'Development'),
    ]);
    const result = buildHierarchy(tree);
    assert.equal(result.type, 'folder');
    assert.equal(result.title, 'root');
  });

  it('output max depth is 3 (root=0, category=1, links=2)', () => {
    const tree = makeFolder('root', 'root', [
      makeLink('a', 'GitHub', 'https://github.com', 'Development'),
      makeLink('b', 'YouTube', 'https://youtube.com', 'Video'),
    ]);
    const result = buildHierarchy(tree);
    assert.equal(maxDepth(result), 2);
  });

  it('all input links appear in output (no links lost)', () => {
    const links = [
      makeLink('a', 'GitHub', 'https://github.com', 'Development'),
      makeLink('b', 'YouTube', 'https://youtube.com', 'Video'),
      makeLink('c', 'Reddit', 'https://reddit.com', 'Social / Community'),
    ];
    const tree = makeFolder('root', 'root', links);
    const result = buildHierarchy(tree);
    const outputLinks = collectLinks(result);
    assert.equal(outputLinks.length, 3);
    const ids = outputLinks.map(l => l.id).sort();
    assert.deepEqual(ids, ['a', 'b', 'c']);
  });

  it('empty categories are NOT present in output', () => {
    // If all links are Development, there should be NO Video folder, etc.
    const tree = makeFolder('root', 'root', [
      makeLink('a', 'GitHub', 'https://github.com', 'Development'),
    ]);
    const result = buildHierarchy(tree);
    const titles = result.children.map(c => c.title);
    assert.equal(titles.length, 1);
    assert.equal(titles[0], 'Development');
  });

  it('Other category only appears if at least one link has category=Other', () => {
    const tree = makeFolder('root', 'root', [
      makeLink('a', 'GitHub', 'https://github.com', 'Development'),
    ]);
    const result = buildHierarchy(tree);
    const hasOther = result.children.some(c => c.title === 'Other');
    assert.equal(hasOther, false);
  });

  it('Other category IS present when a link has category=Other', () => {
    const tree = makeFolder('root', 'root', [
      makeLink('a', 'Unknown', 'https://obscure.io', 'Other'),
    ]);
    const result = buildHierarchy(tree);
    const hasOther = result.children.some(c => c.title === 'Other');
    assert.equal(hasOther, true);
  });

  it('single-bookmark category produces a folder with 1 child', () => {
    const tree = makeFolder('root', 'root', [
      makeLink('a', 'GitHub', 'https://github.com', 'Development'),
    ]);
    const result = buildHierarchy(tree);
    assert.equal(result.children[0].children.length, 1);
  });

  it('category folder ids are valid UUIDs', () => {
    const tree = makeFolder('root', 'root', [
      makeLink('a', 'GitHub', 'https://github.com', 'Development'),
    ]);
    const result = buildHierarchy(tree);
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    assert.match(result.children[0].id, uuidPattern);
  });

  it('does not mutate the input tree', () => {
    const link = makeLink('a', 'GitHub', 'https://github.com', 'Development');
    const tree = makeFolder('root', 'root', [link]);
    buildHierarchy(tree);
    // Original link should be unchanged
    assert.equal(link.id, 'a');
    assert.equal(tree.children.length, 1);
    assert.equal(tree.children[0].id, 'a');
  });

  it('handles links from nested input folders (collects all links recursively)', () => {
    const tree = makeFolder('root', 'root', [
      makeFolder('sub', 'Sub Folder', [
        makeLink('a', 'GitHub', 'https://github.com', 'Development'),
        makeLink('b', 'YouTube', 'https://youtube.com', 'Video'),
      ]),
    ]);
    const result = buildHierarchy(tree);
    assert.equal(result.children.length, 2);
    const outputLinks = collectLinks(result);
    assert.equal(outputLinks.length, 2);
  });
});
