import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reorderNode } from '../src/shared/treeOps.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFolder(id, title, children = []) {
  return { id, type: 'folder', title, children };
}

function makeLink(id, title) {
  return { id, type: 'link', title, url: 'http://example.com/' + id };
}

// ─── reorderNode tests ────────────────────────────────────────────────────────

describe('reorderNode', () => {
  it('moves a child from index 0 to index 2 in a 3-child parent', () => {
    const root = makeFolder('root', 'Root', [
      makeFolder('a', 'folderA'),
      makeFolder('b', 'folderB'),
      makeFolder('c', 'folderC'),
    ]);
    const result = reorderNode(root, 'a', 'root', 2);
    assert.equal(result.children[0].id, 'b');
    assert.equal(result.children[1].id, 'c');
    assert.equal(result.children[2].id, 'a');
  });

  it('moves a child from index 2 to index 0 in a 3-child parent', () => {
    const root = makeFolder('root', 'Root', [
      makeFolder('a', 'folderA'),
      makeFolder('b', 'folderB'),
      makeFolder('c', 'folderC'),
    ]);
    const result = reorderNode(root, 'c', 'root', 0);
    assert.equal(result.children[0].id, 'c');
    assert.equal(result.children[1].id, 'a');
    assert.equal(result.children[2].id, 'b');
  });

  it('returns tree unchanged when nodeId is not in parent children', () => {
    const root = makeFolder('root', 'Root', [
      makeFolder('a', 'folderA'),
      makeFolder('b', 'folderB'),
      makeFolder('c', 'folderC'),
    ]);
    const result = reorderNode(root, 'x', 'root', 1);
    assert.equal(result.children[0].id, 'a');
    assert.equal(result.children[1].id, 'b');
    assert.equal(result.children[2].id, 'c');
  });

  it('clamps newIndex to end of list when newIndex exceeds children.length', () => {
    const root = makeFolder('root', 'Root', [
      makeFolder('a', 'folderA'),
      makeFolder('b', 'folderB'),
      makeFolder('c', 'folderC'),
    ]);
    // After removing 'a', children has 2 items (indices 0-1). newIndex=99 should clamp to 2.
    const result = reorderNode(root, 'a', 'root', 99);
    assert.equal(result.children[2].id, 'a');
  });

  it('clamps newIndex to 0 when newIndex is less than 0', () => {
    const root = makeFolder('root', 'Root', [
      makeFolder('a', 'folderA'),
      makeFolder('b', 'folderB'),
      makeFolder('c', 'folderC'),
    ]);
    const result = reorderNode(root, 'c', 'root', -5);
    assert.equal(result.children[0].id, 'c');
  });

  it('does not mutate the input root (pure function contract)', () => {
    const root = makeFolder('root', 'Root', [
      makeFolder('a', 'folderA'),
      makeFolder('b', 'folderB'),
      makeFolder('c', 'folderC'),
    ]);
    const originalOrder = root.children.map(c => c.id).join(',');
    reorderNode(root, 'a', 'root', 2);
    const afterOrder = root.children.map(c => c.id).join(',');
    assert.equal(afterOrder, originalOrder);
  });

  it('works in a nested tree where parent is not the root', () => {
    const root = makeFolder('root', 'Root', [
      makeFolder('parent', 'Parent', [
        makeFolder('c1', 'child1'),
        makeFolder('c2', 'child2'),
        makeFolder('c3', 'child3'),
      ]),
    ]);
    const result = reorderNode(root, 'c1', 'parent', 2);
    const parent = result.children[0];
    assert.equal(parent.children[0].id, 'c2');
    assert.equal(parent.children[1].id, 'c3');
    assert.equal(parent.children[2].id, 'c1');
  });
});
