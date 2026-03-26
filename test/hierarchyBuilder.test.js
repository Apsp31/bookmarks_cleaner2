import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHierarchy, SUBCATEGORY_THRESHOLD, SUBCATEGORY_MIN_COVERAGE_RATIO } from '../src/hierarchyBuilder.js';

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

  it('category folder ids are deterministic slugs (per D-01)', () => {
    const tree = makeFolder('root', 'root', [
      makeLink('a', 'GitHub', 'https://github.com', 'Development'),
    ]);
    const result = buildHierarchy(tree);
    assert.equal(result.id, 'folder-root');
    assert.equal(result.children[0].id, 'folder-development');
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

// ─── sub-categorisation tests ─────────────────────────────────────────────────

// Helper: build a 21-link Development tree with >= 60% taxonomy coverage
function make21DevLinks() {
  return [
    // 4x Frontend
    makeLink('f1', 'React',   'https://reactjs.org',           'Development'),
    makeLink('f2', 'Vue',     'https://vuejs.org',             'Development'),
    makeLink('f3', 'Svelte',  'https://svelte.dev',            'Development'),
    makeLink('f4', 'Next',    'https://nextjs.org',            'Development'),
    // 3x Backend
    makeLink('b1', 'Spring',  'https://spring.io',             'Development'),
    makeLink('b2', 'Go',      'https://go.dev',                'Development'),
    makeLink('b3', 'Rust',    'https://rust-lang.org',         'Development'),
    // 3x DevOps/Cloud
    makeLink('d1', 'Docker',  'https://docker.com',            'Development'),
    makeLink('d2', 'K8s',     'https://kubernetes.io',         'Development'),
    makeLink('d3', 'AWS',     'https://aws.amazon.com',        'Development'),
    // 3x Tools
    makeLink('t1', 'GitHub',  'https://github.com',            'Development'),
    makeLink('t2', 'GitLab',  'https://gitlab.com',            'Development'),
    makeLink('t3', 'NPM',     'https://npmjs.com',             'Development'),
    // 3x Learning
    makeLink('l1', 'MDN',     'https://developer.mozilla.org', 'Development'),
    makeLink('l2', 'PyDocs',  'https://docs.python.org',       'Development'),
    makeLink('l3', 'GraphQL', 'https://graphql.org',           'Development'),
    // 3x AI/ML
    makeLink('a1', 'OpenAI',  'https://openai.com',            'Development'),
    makeLink('a2', 'HF',      'https://huggingface.co',        'Development'),
    makeLink('a3', 'Ant',     'https://anthropic.com',         'Development'),
    // 2x unmatched
    makeLink('u1', 'Dev1',    'https://example-dev1.com',      'Development'),
    makeLink('u2', 'Dev2',    'https://example-dev2.com',      'Development'),
  ];
}

describe('sub-categorisation', () => {
  it('same input produces identical IDs on two calls (HIER-01)', () => {
    const links = make21DevLinks();
    const tree = makeFolder('root', 'root', links);
    const result1 = buildHierarchy(tree);
    const result2 = buildHierarchy(tree);
    const getIds = (node) => {
      const ids = [node.id];
      for (const child of node.children ?? []) ids.push(...getIds(child));
      return ids;
    };
    assert.deepEqual(getIds(result1), getIds(result2));
  });

  it('Development category with 21+ links gains sub-folders (HIER-02)', () => {
    const tree = makeFolder('root', 'root', make21DevLinks());
    const result = buildHierarchy(tree);
    const devFolder = result.children.find(c => c.title === 'Development');
    assert.ok(devFolder, 'Development folder should exist');
    // All children of Development should be sub-folders (type: folder), not links
    assert.ok(devFolder.children.length >= 6, 'At least 6 sub-folders should exist');
    for (const child of devFolder.children) {
      assert.equal(child.type, 'folder', `Expected sub-folder but got type=${child.type} (title=${child.title})`);
    }
  });

  it('Development category with 19 links stays flat (HIER-02)', () => {
    // 19 links, all Development
    const links = Array.from({ length: 19 }, (_, i) =>
      makeLink(`x${i}`, `Link ${i}`, `https://example-${i}.com`, 'Development')
    );
    const tree = makeFolder('root', 'root', links);
    const result = buildHierarchy(tree);
    const devFolder = result.children.find(c => c.title === 'Development');
    assert.ok(devFolder, 'Development folder should exist');
    for (const child of devFolder.children) {
      assert.equal(child.type, 'link', `Expected link but got type=${child.type} (title=${child.title})`);
    }
  });

  it('AI/ML sub-folder contains openai.com and huggingface.co (HIER-04)', () => {
    const tree = makeFolder('root', 'root', make21DevLinks());
    const result = buildHierarchy(tree);
    const devFolder = result.children.find(c => c.title === 'Development');
    const aimlFolder = devFolder.children.find(c => c.title === 'AI/ML');
    assert.ok(aimlFolder, 'AI/ML sub-folder should exist');
    const urls = aimlFolder.children.map(l => l.url);
    assert.ok(urls.some(u => u.includes('openai.com')), 'openai.com should be in AI/ML');
    assert.ok(urls.some(u => u.includes('huggingface.co')), 'huggingface.co should be in AI/ML');
  });

  it('Frontend sub-folder contains reactjs.org (HIER-03)', () => {
    const tree = makeFolder('root', 'root', make21DevLinks());
    const result = buildHierarchy(tree);
    const devFolder = result.children.find(c => c.title === 'Development');
    const frontendFolder = devFolder.children.find(c => c.title === 'Frontend');
    assert.ok(frontendFolder, 'Frontend sub-folder should exist');
    const urls = frontendFolder.children.map(l => l.url);
    assert.ok(urls.some(u => u.includes('reactjs.org')), 'reactjs.org should be in Frontend');
  });

  it('coverage ratio guard: stays flat when < 60% match taxonomy (HIER-02/HIER-05)', () => {
    // 21 links, only 5 match DEVELOPMENT_SUBTAXONOMY (5/21 = ~24% < 60%)
    const links = [
      makeLink('m1', 'React',   'https://reactjs.org',  'Development'),
      makeLink('m2', 'Vue',     'https://vuejs.org',    'Development'),
      makeLink('m3', 'OpenAI',  'https://openai.com',   'Development'),
      makeLink('m4', 'Docker',  'https://docker.com',   'Development'),
      makeLink('m5', 'GitHub',  'https://github.com',   'Development'),
      // 16 unmatched
      ...Array.from({ length: 16 }, (_, i) =>
        makeLink(`u${i}`, `Unknown ${i}`, `https://obscure-dev-${i}.io`, 'Development')
      ),
    ];
    const tree = makeFolder('root', 'root', links);
    const result = buildHierarchy(tree);
    const devFolder = result.children.find(c => c.title === 'Development');
    assert.ok(devFolder, 'Development folder should exist');
    // Should stay flat — all children are links, not sub-folders
    for (const child of devFolder.children) {
      assert.equal(child.type, 'link', `Expected link but got type=${child.type} (title=${child.title})`);
    }
  });

  it('hyphen-prefix folders are never sub-split', () => {
    // 25 links in category '-Pinned'
    const links = Array.from({ length: 25 }, (_, i) =>
      makeLink(`p${i}`, `Pinned ${i}`, `https://pinned-${i}.com`, '-Pinned')
    );
    const tree = makeFolder('root', 'root', links);
    const result = buildHierarchy(tree);
    const pinnedFolder = result.children.find(c => c.title === '-Pinned');
    assert.ok(pinnedFolder, '-Pinned folder should exist');
    // Should stay flat — all children are links regardless of count
    for (const child of pinnedFolder.children) {
      assert.equal(child.type, 'link', `Expected link but got type=${child.type}`);
    }
  });

  it('SUBCATEGORY_THRESHOLD is exported and equals 20 (HIER-05)', () => {
    assert.equal(SUBCATEGORY_THRESHOLD, 20);
  });

  it('SUBCATEGORY_MIN_COVERAGE_RATIO is exported and equals 0.6 (HIER-05)', () => {
    assert.equal(SUBCATEGORY_MIN_COVERAGE_RATIO, 0.6);
  });

  it('sub-folder IDs include parent slug (HIER-01)', () => {
    const tree = makeFolder('root', 'root', make21DevLinks());
    const result = buildHierarchy(tree);
    const devFolder = result.children.find(c => c.title === 'Development');
    const aimlFolder = devFolder.children.find(c => c.title === 'AI/ML');
    assert.ok(aimlFolder, 'AI/ML sub-folder should exist');
    assert.equal(aimlFolder.id, 'folder-development-ai-ml');
  });

  it('maxDepth is 3 when sub-folders exist (HIER-06)', () => {
    const tree = makeFolder('root', 'root', make21DevLinks());
    const result = buildHierarchy(tree);
    assert.equal(maxDepth(result), 3);
  });

  it('all links preserved after sub-splitting', () => {
    const links = make21DevLinks();
    const tree = makeFolder('root', 'root', links);
    const result = buildHierarchy(tree);
    assert.equal(collectLinks(result).length, 21);
  });
});
