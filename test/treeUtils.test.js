import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pruneEmptyFolders, countLinks } from '../src/shared/treeUtils.js';
import { deleteNode, moveNode, markKeep } from '../src/shared/treeOps.js';

// ─── pruneEmptyFolders ────────────────────────────────────────────────────────

describe('pruneEmptyFolders', () => {
  it('returns a link node unchanged', () => {
    const link = { id: '1', type: 'link', title: 'A', url: 'http://a.com' };
    const result = pruneEmptyFolders(link);
    assert.deepEqual(result, link);
  });

  it('removes an empty folder from parent children', () => {
    const root = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        { id: 'f1', type: 'folder', title: 'Empty', children: [] },
        { id: 'l1', type: 'link', title: 'Link', url: 'http://x.com' },
      ],
    };
    const result = pruneEmptyFolders(root);
    assert.equal(result.children.length, 1);
    assert.equal(result.children[0].id, 'l1');
  });

  it('removes a folder containing only empty subfolders (recursive)', () => {
    const root = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        {
          id: 'outer',
          type: 'folder',
          title: 'Outer',
          children: [
            { id: 'inner', type: 'folder', title: 'Inner', children: [] },
          ],
        },
      ],
    };
    const result = pruneEmptyFolders(root);
    assert.equal(result.children.length, 0);
  });

  it('preserves a folder with at least one link descendant', () => {
    const root = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        {
          id: 'f1',
          type: 'folder',
          title: 'Has Links',
          children: [
            { id: 'l1', type: 'link', title: 'Link', url: 'http://x.com' },
          ],
        },
      ],
    };
    const result = pruneEmptyFolders(root);
    assert.equal(result.children.length, 1);
    assert.equal(result.children[0].id, 'f1');
  });

  it('preserves root node even if all children are pruned (returns root with empty children)', () => {
    const root = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        { id: 'f1', type: 'folder', title: 'Empty', children: [] },
      ],
    };
    const result = pruneEmptyFolders(root);
    assert.equal(result.id, 'root');
    assert.equal(result.children.length, 0);
  });
});

// ─── countLinks ───────────────────────────────────────────────────────────────

describe('countLinks', () => {
  it('returns 0 for an empty folder', () => {
    const folder = { id: 'f', type: 'folder', title: 'Empty', children: [] };
    assert.equal(countLinks(folder), 0);
  });

  it('returns 1 for a single link node', () => {
    const link = { id: 'l', type: 'link', title: 'Link', url: 'http://x.com' };
    assert.equal(countLinks(link), 1);
  });

  it('counts links across nested folders correctly', () => {
    const root = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        {
          id: 'f1',
          type: 'folder',
          title: 'Folder',
          children: [
            { id: 'l1', type: 'link', title: 'L1', url: 'http://a.com' },
            { id: 'l2', type: 'link', title: 'L2', url: 'http://b.com' },
            {
              id: 'f2',
              type: 'folder',
              title: 'Sub',
              children: [
                { id: 'l3', type: 'link', title: 'L3', url: 'http://c.com' },
              ],
            },
          ],
        },
      ],
    };
    assert.equal(countLinks(root), 3);
  });

  it('returns 0 for null input', () => {
    assert.equal(countLinks(null), 0);
  });
});

// ─── deleteNode ───────────────────────────────────────────────────────────────

describe('deleteNode', () => {
  it('removes a link node by id from a flat folder', () => {
    const root = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        {
          id: 'f1',
          type: 'folder',
          title: 'Folder',
          children: [
            { id: 'l1', type: 'link', title: 'Link1', url: 'http://a.com' },
            { id: 'l2', type: 'link', title: 'Link2', url: 'http://b.com' },
          ],
        },
      ],
    };
    const result = deleteNode(root, 'l1');
    assert.equal(result.children[0].children.length, 1);
    assert.equal(result.children[0].children[0].id, 'l2');
  });

  it('removes a deeply nested node by id', () => {
    const root = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        {
          id: 'fA',
          type: 'folder',
          title: 'A',
          children: [
            {
              id: 'fB',
              type: 'folder',
              title: 'B',
              children: [
                { id: 'deep', type: 'link', title: 'Deep', url: 'http://d.com' },
              ],
            },
          ],
        },
      ],
    };
    const result = deleteNode(root, 'deep');
    assert.equal(result.children[0].children[0].children.length, 0);
  });

  it('returns tree unchanged if id not found', () => {
    const root = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        { id: 'l1', type: 'link', title: 'Link', url: 'http://x.com' },
      ],
    };
    const result = deleteNode(root, 'nonexistent');
    assert.deepEqual(result, root);
  });
});

// ─── moveNode ─────────────────────────────────────────────────────────────────

describe('moveNode', () => {
  it('moves a link from folderA to folderB', () => {
    const root = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        {
          id: 'fA',
          type: 'folder',
          title: 'A',
          children: [
            { id: 'l1', type: 'link', title: 'Link', url: 'http://x.com' },
          ],
        },
        {
          id: 'fB',
          type: 'folder',
          title: 'B',
          children: [],
        },
      ],
    };
    const result = moveNode(root, 'l1', 'fB');
    assert.equal(result.children[0].children.length, 0);
    assert.equal(result.children[1].children.length, 1);
    assert.equal(result.children[1].children[0].id, 'l1');
  });

  it('returns tree unchanged if nodeId not found', () => {
    const root = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        { id: 'fA', type: 'folder', title: 'A', children: [] },
      ],
    };
    const result = moveNode(root, 'ghost', 'fA');
    assert.deepEqual(result, root);
  });

  it('returns tree unchanged when moving a folder into its own subtree (circular move guard)', () => {
    const root = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        {
          id: 'parent',
          type: 'folder',
          title: 'Parent',
          children: [
            { id: 'child', type: 'folder', title: 'Child', children: [] },
          ],
        },
      ],
    };
    const original = JSON.parse(JSON.stringify(root));
    const result = moveNode(root, 'parent', 'child');
    assert.deepEqual(result, original);
  });
});

// ─── markKeep ─────────────────────────────────────────────────────────────────

describe('markKeep', () => {
  it('sets kept=true on the matching node', () => {
    const root = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        { id: 'l1', type: 'link', title: 'Link', url: 'http://x.com' },
      ],
    };
    const result = markKeep(root, 'l1');
    assert.equal(result.children[0].kept, true);
  });

  it('does not add kept property to other nodes', () => {
    const root = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        { id: 'l1', type: 'link', title: 'Link1', url: 'http://a.com' },
        { id: 'l2', type: 'link', title: 'Link2', url: 'http://b.com' },
      ],
    };
    const result = markKeep(root, 'l1');
    assert.equal(result.children[1].kept, undefined);
  });

  it('returns tree unchanged if id not found', () => {
    const root = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        { id: 'l1', type: 'link', title: 'Link', url: 'http://x.com' },
      ],
    };
    const original = JSON.parse(JSON.stringify(root));
    const result = markKeep(root, 'nonexistent');
    assert.deepEqual(result, original);
  });
});
