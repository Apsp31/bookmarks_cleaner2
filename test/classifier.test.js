import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyByDomain,
  classifyByMetadata,
  classifyNode,
  classifyTree,
} from '../src/classifier.js';

// ─── classifyByDomain ─────────────────────────────────────────────────────────

describe('classifyByDomain', () => {
  it('returns Development for github.com', () => {
    assert.equal(classifyByDomain('https://github.com/foo'), 'Development');
  });

  it('returns Development for www.github.com (strips www.)', () => {
    assert.equal(classifyByDomain('https://www.github.com/foo'), 'Development');
  });

  it('returns Video for youtube.com', () => {
    assert.equal(classifyByDomain('https://youtube.com/watch?v=abc'), 'Video');
  });

  it('returns Video for www.youtube.com (strips www.)', () => {
    assert.equal(classifyByDomain('https://www.youtube.com/watch?v=abc'), 'Video');
  });

  it('returns Social / Community for reddit.com', () => {
    assert.equal(classifyByDomain('https://reddit.com/r/programming'), 'Social / Community');
  });

  it('returns null for unknown domain', () => {
    assert.equal(classifyByDomain('https://obscure-unknown-site-12345.com'), null);
  });

  it('returns null for malformed URL', () => {
    assert.equal(classifyByDomain('not-a-url'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(classifyByDomain(''), null);
  });
});

// ─── classifyByMetadata ───────────────────────────────────────────────────────

describe('classifyByMetadata', () => {
  it('returns Development when title contains "github"', () => {
    assert.equal(
      classifyByMetadata({ title: 'GitHub Actions Tutorial', description: 'Learn CI/CD' }),
      'Development'
    );
  });

  it('returns Shopping when title and description indicate shopping', () => {
    assert.equal(
      classifyByMetadata({ title: 'Buy the best shoes', description: 'Shop now' }),
      'Shopping'
    );
  });

  it('returns null when no keywords match', () => {
    assert.equal(
      classifyByMetadata({ title: 'Something completely unrelated', description: 'Nothing matches here' }),
      null
    );
  });

  it('returns null for undefined metadata', () => {
    assert.equal(classifyByMetadata(undefined), null);
  });

  it('returns null for null metadata', () => {
    assert.equal(classifyByMetadata(null), null);
  });

  it('returns null for empty metadata object', () => {
    assert.equal(classifyByMetadata({}), null);
  });
});

// ─── classifyNode ─────────────────────────────────────────────────────────────

describe('classifyNode', () => {
  it('classifies link with known domain using domain rules (priority over metadata)', () => {
    const node = {
      id: '1',
      type: 'link',
      title: 'GitHub',
      url: 'https://github.com/foo',
      metadata: { title: 'Some shop', description: 'buy products online' },
    };
    const result = classifyNode(node);
    assert.equal(result.category, 'Development');
  });

  it('classifies link with unknown domain + metadata using metadata fallback', () => {
    const node = {
      id: '2',
      type: 'link',
      title: 'Code Stuff',
      url: 'https://obscure-dev-site-99999.com',
      metadata: { title: 'NPM packages explained', description: 'Programming tutorial' },
    };
    const result = classifyNode(node);
    assert.equal(result.category, 'Development');
  });

  it('classifies link with unknown domain + no metadata as Other', () => {
    const node = {
      id: '3',
      type: 'link',
      title: 'Mystery site',
      url: 'https://obscure-unknown-site-12345.com',
    };
    const result = classifyNode(node);
    assert.equal(result.category, 'Other');
  });

  it('returns folder node unchanged (does not classify folders)', () => {
    const node = {
      id: '4',
      type: 'folder',
      title: 'My Folder',
      children: [],
    };
    const result = classifyNode(node);
    assert.deepEqual(result, node);
  });

  it('does not mutate input node', () => {
    const node = {
      id: '5',
      type: 'link',
      title: 'GitHub',
      url: 'https://github.com/foo',
    };
    classifyNode(node);
    assert.equal(node.category, undefined);
  });
});

// ─── classifyTree ─────────────────────────────────────────────────────────────

describe('classifyTree', () => {
  it('classifies all leaf link nodes in a flat list', () => {
    const tree = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        { id: 'a', type: 'link', title: 'GitHub', url: 'https://github.com/foo' },
        { id: 'b', type: 'link', title: 'YouTube', url: 'https://youtube.com/watch?v=1' },
        { id: 'c', type: 'link', title: 'Unknown', url: 'https://obscure-12345.io' },
      ],
    };
    const result = classifyTree(tree);
    assert.equal(result.children[0].category, 'Development');
    assert.equal(result.children[1].category, 'Video');
    assert.equal(result.children[2].category, 'Other');
  });

  it('classifies all link nodes in nested folders recursively', () => {
    const tree = {
      id: 'root',
      type: 'folder',
      title: 'root',
      children: [
        {
          id: 'f1',
          type: 'folder',
          title: 'Sub Folder',
          children: [
            { id: 'l1', type: 'link', title: 'Reddit', url: 'https://reddit.com/r/test' },
          ],
        },
      ],
    };
    const result = classifyTree(tree);
    assert.equal(result.children[0].children[0].category, 'Social / Community');
  });

  it('does not mutate the input tree', () => {
    const link = { id: 'x', type: 'link', title: 'GitHub', url: 'https://github.com' };
    const tree = { id: 'root', type: 'folder', title: 'root', children: [link] };
    classifyTree(tree);
    assert.equal(link.category, undefined);
    assert.equal(tree.children[0].category, undefined);
  });
});
