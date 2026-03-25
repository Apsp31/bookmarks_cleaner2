import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyByDomain,
  classifyByMetadata,
  classifyByPath,
  classifyNode,
  classifyTree,
  fuzzyMatchCategory,
  DOMAIN_RULES,
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

// ─── classifyByPath ───────────────────────────────────────────────────────────

describe('classifyByPath', () => {
  // Path patterns
  it('returns News for /blog/ path', () => {
    assert.equal(classifyByPath('https://example.com/blog/post-1'), 'News');
  });

  it('returns Reference for /docs/api path', () => {
    assert.equal(classifyByPath('https://example.com/docs/api'), 'Reference');
  });

  it('returns Shopping for /shop/item path', () => {
    assert.equal(classifyByPath('https://example.com/shop/item'), 'Shopping');
  });

  it('returns Development for /api/v1/users path', () => {
    assert.equal(classifyByPath('https://example.com/api/v1/users'), 'Development');
  });

  it('returns News for /news/ path', () => {
    assert.equal(classifyByPath('https://example.com/news/latest'), 'News');
  });

  it('returns Reference for /documentation/ path', () => {
    assert.equal(classifyByPath('https://example.com/documentation/guide'), 'Reference');
  });

  it('returns Shopping for /store/ path', () => {
    assert.equal(classifyByPath('https://example.com/store/products'), 'Shopping');
  });

  // Subdomain patterns
  it('returns Reference for docs.example.com subdomain', () => {
    assert.equal(classifyByPath('https://docs.example.com/guide'), 'Reference');
  });

  it('returns News for blog.example.com subdomain', () => {
    assert.equal(classifyByPath('https://blog.example.com/post'), 'News');
  });

  it('returns Shopping for shop.example.com subdomain', () => {
    assert.equal(classifyByPath('https://shop.example.com/item'), 'Shopping');
  });

  it('returns Shopping for store.example.com subdomain', () => {
    assert.equal(classifyByPath('https://store.example.com/product'), 'Shopping');
  });

  it('returns Reference for documentation.example.com subdomain', () => {
    assert.equal(classifyByPath('https://documentation.example.com/api'), 'Reference');
  });

  // Non-matching
  it('returns null for /about path (no matching pattern)', () => {
    assert.equal(classifyByPath('https://example.com/about'), null);
  });

  it('returns null for malformed URL', () => {
    assert.equal(classifyByPath('invalid-url'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(classifyByPath(''), null);
  });

  // classifyNode chain: path fallback used when domain and metadata both fail
  it('classifyNode uses path fallback when domain unknown and no metadata', () => {
    const node = {
      id: 'path-test',
      type: 'link',
      title: 'A blog post',
      url: 'https://obscure-unknown-site-99999.com/blog/my-post',
    };
    const result = classifyNode(node);
    assert.equal(result.category, 'News');
  });
});

// ─── classifyTree — hyphen-prefix preservation ────────────────────────────────

describe('classifyTree — hyphen-prefix preservation', () => {
  // Fixture: one hyphen-prefixed folder, one regular folder
  const preservedTree = {
    type: 'folder',
    title: 'root',
    children: [
      {
        type: 'folder',
        title: '-Pinned',
        children: [
          { type: 'link', title: 'My Link', url: 'https://unknown-domain-xyz.com/page' },
        ],
      },
      {
        type: 'folder',
        title: 'Regular',
        children: [
          { type: 'link', title: 'GitHub', url: 'https://github.com/foo' },
        ],
      },
    ],
  };

  it('link inside hyphen-prefix folder gets folder name as category', () => {
    const result = classifyTree(preservedTree);
    assert.equal(result.children[0].children[0].category, '-Pinned');
  });

  it('link inside regular folder is classified normally by classifyNode', () => {
    const result = classifyTree(preservedTree);
    assert.equal(result.children[1].children[0].category, 'Development');
  });

  it('link inside hyphen-prefix folder with preservedFolders opt-in is classified normally', () => {
    const result = classifyTree(preservedTree, new Set(['-Pinned']));
    assert.notEqual(result.children[0].children[0].category, '-Pinned');
  });

  it('only direct children of hyphen-prefix folder are preserved (nested normal folder is not)', () => {
    const nestedTree = {
      type: 'folder',
      title: 'root',
      children: [
        {
          type: 'folder',
          title: '-TopLevel',
          children: [
            {
              type: 'folder',
              title: 'NestedNormal',
              children: [
                { type: 'link', title: 'GitHub', url: 'https://github.com/foo' },
              ],
            },
          ],
        },
      ],
    };
    // The nested link's direct parent is 'NestedNormal' (not hyphen-prefixed),
    // so it should be classified normally
    const result = classifyTree(nestedTree);
    assert.equal(result.children[0].children[0].children[0].category, 'Development');
  });

  it('classifyTree with no second argument still works (backward compat)', () => {
    const tree = {
      type: 'folder',
      title: 'root',
      children: [
        { type: 'link', title: 'GitHub', url: 'https://github.com/foo' },
      ],
    };
    const result = classifyTree(tree);
    assert.equal(result.children[0].category, 'Development');
  });

  it('classifyTree returns a new tree (immutability preserved)', () => {
    const result = classifyTree(preservedTree);
    assert.notEqual(result, preservedTree);
    assert.notEqual(result.children[0], preservedTree.children[0]);
  });
});

// ─── DOMAIN_RULES count ───────────────────────────────────────────────────────

describe('DOMAIN_RULES', () => {
  it('has at least 280 entries after expansion', () => {
    assert.ok(
      Object.keys(DOMAIN_RULES).length >= 280,
      `Expected DOMAIN_RULES to have >= 280 entries, got ${Object.keys(DOMAIN_RULES).length}`
    );
  });
});

// ─── fuzzyMatchCategory ───────────────────────────────────────────────────────

describe('fuzzyMatchCategory', () => {
  it('returns null for null input', () => {
    assert.equal(fuzzyMatchCategory(null), null);
  });

  it('returns null for empty string', () => {
    assert.equal(fuzzyMatchCategory(''), null);
  });

  it('returns Development for exact match "Development"', () => {
    assert.equal(fuzzyMatchCategory('Development'), 'Development');
  });

  it('returns Development for "development" (case insensitive exact match)', () => {
    assert.equal(fuzzyMatchCategory('development'), 'Development');
  });

  it('returns Development for "Coding" (synonym)', () => {
    assert.equal(fuzzyMatchCategory('Coding'), 'Development');
  });

  it('returns Development for "dev" (synonym)', () => {
    assert.equal(fuzzyMatchCategory('dev'), 'Development');
  });

  it('returns Video for "videos" (synonym, plural, lowercase)', () => {
    assert.equal(fuzzyMatchCategory('videos'), 'Video');
  });

  it('returns Video for "Videos" (synonym, case insensitive)', () => {
    assert.equal(fuzzyMatchCategory('Videos'), 'Video');
  });

  it('returns Video for "Vidio" (typo, Levenshtein distance 2)', () => {
    assert.equal(fuzzyMatchCategory('Vidio'), 'Video');
  });

  it('returns Learning for "Learnin" (distance 1)', () => {
    assert.equal(fuzzyMatchCategory('Learnin'), 'Learning');
  });

  it('returns null for "Machine Learning" (no close match, no synonym)', () => {
    assert.equal(fuzzyMatchCategory('Machine Learning'), null);
  });

  it('returns null for "My Stuff" (no close match)', () => {
    assert.equal(fuzzyMatchCategory('My Stuff'), null);
  });

  it('returns null for "root" (no close match)', () => {
    assert.equal(fuzzyMatchCategory('root'), null);
  });
});

// ─── classifyNode — source folder fallback ────────────────────────────────────

describe('classifyNode — source folder fallback', () => {
  const unknownNode = {
    id: 'x',
    type: 'link',
    title: 'Unknown',
    url: 'https://obscure-unknown-12345.com',
  };

  it('returns Other when sourceFolderName is null (existing behaviour)', () => {
    assert.equal(classifyNode(unknownNode, null).category, 'Other');
  });

  it('returns Other when called with no second argument (backward compat)', () => {
    assert.equal(classifyNode(unknownNode).category, 'Other');
  });

  it('returns Development when sourceFolderName is "Coding" (synonym fuzzy match)', () => {
    assert.equal(classifyNode(unknownNode, 'Coding').category, 'Development');
  });

  it('returns "Machine Learning" (raw folder name) when no fuzzy match', () => {
    assert.equal(classifyNode(unknownNode, 'Machine Learning').category, 'Machine Learning');
  });

  it('domain rule wins over folder fallback (github.com → Development even with Cooking folder)', () => {
    const githubNode = { id: 'g', type: 'link', title: 'GitHub', url: 'https://github.com/foo' };
    assert.equal(classifyNode(githubNode, 'Cooking').category, 'Development');
  });

  it('returns Video when sourceFolderName is "Videos"', () => {
    assert.equal(classifyNode(unknownNode, 'Videos').category, 'Video');
  });

  it('returns Other for sourceFolderName "root" (no fuzzy match for "root")', () => {
    // "root" doesn't fuzzy match any standard category, but sourceFolderName is non-null
    // so raw folder name "root" would be used — this checks the specified behaviour
    // from the plan: "sourceFolderName = 'root', no domain/meta/path match: no fuzzy match → 'Other'"
    // NOTE: plan spec says root → Other (root is not a useful folder name)
    // This requires special-casing "root" or the fuzzy match to return null for it
    assert.equal(classifyNode(unknownNode, 'root').category, 'Other');
  });

  it('does not mutate input node', () => {
    const node = { id: 'y', type: 'link', title: 'T', url: 'https://obscure-unknown-12345.com' };
    classifyNode(node, 'Coding');
    assert.equal(node.category, undefined);
  });

  it('folder nodes returned unchanged regardless of sourceFolderName', () => {
    const folder = { id: 'f', type: 'folder', title: 'Dev', children: [] };
    assert.deepEqual(classifyNode(folder, 'Coding'), folder);
  });
});

// ─── classifyTree — source folder name threading ─────────────────────────────

describe('classifyTree — source folder name threading', () => {
  it('unknown link in "Coding" folder gets Development (fuzzy match)', () => {
    const tree = {
      type: 'folder',
      title: 'root',
      children: [
        {
          type: 'folder',
          title: 'Coding',
          children: [
            { type: 'link', title: 'Unknown', url: 'https://obscure-unknown-12345.com' },
          ],
        },
      ],
    };
    const result = classifyTree(tree);
    assert.equal(result.children[0].children[0].category, 'Development');
  });

  it('unknown link in "Machine Learning" folder gets raw folder name', () => {
    const tree = {
      type: 'folder',
      title: 'root',
      children: [
        {
          type: 'folder',
          title: 'Machine Learning',
          children: [
            { type: 'link', title: 'Unknown', url: 'https://obscure-unknown-12345.com' },
          ],
        },
      ],
    };
    const result = classifyTree(tree);
    assert.equal(result.children[0].children[0].category, 'Machine Learning');
  });

  it('known domain link in "Machine Learning" folder gets domain category (domain wins)', () => {
    const tree = {
      type: 'folder',
      title: 'root',
      children: [
        {
          type: 'folder',
          title: 'Machine Learning',
          children: [
            { type: 'link', title: 'GitHub', url: 'https://github.com/foo' },
          ],
        },
      ],
    };
    const result = classifyTree(tree);
    assert.equal(result.children[0].children[0].category, 'Development');
  });

  it('link at root level (no source folder) with unknown domain gets Other', () => {
    const tree = {
      type: 'folder',
      title: 'root',
      children: [
        { type: 'link', title: 'Unknown', url: 'https://obscure-unknown-12345.com' },
      ],
    };
    const result = classifyTree(tree);
    assert.equal(result.children[0].category, 'Other');
  });
});
