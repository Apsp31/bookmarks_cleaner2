import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findMergeCandidates, findDuplicateSubtrees, fingerprintSubtree } from '../src/fuzzy.js';

// Helpers
function makeLink(id, title, url) {
  return { id, type: 'link', title, url };
}

function makeFolder(id, title, children = []) {
  return { id, type: 'folder', title, children };
}

describe('findMergeCandidates', () => {
  it('Test 1: flags "Dev Tools" / "Developer Tools" (distance 3, maxLen 15, ratio 0.20)', () => {
    const tree = makeFolder('root', 'root', [
      makeFolder('f1', 'Dev Tools'),
      makeFolder('f2', 'Developer Tools'),
    ]);
    const candidates = findMergeCandidates(tree);
    assert.strictEqual(candidates.length, 1);
    assert.strictEqual(candidates[0].aName, 'Dev Tools');
    assert.strictEqual(candidates[0].bName, 'Developer Tools');
  });

  it('Test 2: flags "JavaScript" / "Javascript" (case-insensitive distance 1)', () => {
    const tree = makeFolder('root', 'root', [
      makeFolder('f1', 'JavaScript'),
      makeFolder('f2', 'Javascript'),
    ]);
    const candidates = findMergeCandidates(tree);
    assert.strictEqual(candidates.length, 1);
  });

  it('Test 3: does NOT flag "News" / "Development" (distance too large)', () => {
    const tree = makeFolder('root', 'root', [
      makeFolder('f1', 'News'),
      makeFolder('f2', 'Development'),
    ]);
    const candidates = findMergeCandidates(tree);
    assert.strictEqual(candidates.length, 0);
  });

  it('Test 4: skips root node (title === "root") — not included in comparison', () => {
    // Root folder should not be compared against others
    const tree = makeFolder('root', 'root', [
      makeFolder('f1', 'Roots'),  // slight similarity to "root"
    ]);
    // Only one non-root folder, so no pairs possible
    const candidates = findMergeCandidates(tree);
    assert.strictEqual(candidates.length, 0);
  });

  it('Test 5: returns empty array when no similar folders exist', () => {
    const tree = makeFolder('root', 'root', [
      makeFolder('f1', 'News'),
      makeFolder('f2', 'Finance'),
      makeFolder('f3', 'Technology'),
    ]);
    const candidates = findMergeCandidates(tree);
    assert.strictEqual(candidates.length, 0);
  });

  it('Test 6: each candidate has aId, aName, bId, bName, score fields', () => {
    const tree = makeFolder('root', 'root', [
      makeFolder('f1', 'Dev Tools'),
      makeFolder('f2', 'Developer Tools'),
    ]);
    const candidates = findMergeCandidates(tree);
    assert.strictEqual(candidates.length, 1);
    const c = candidates[0];
    assert.ok('aId' in c, 'missing aId');
    assert.ok('aName' in c, 'missing aName');
    assert.ok('bId' in c, 'missing bId');
    assert.ok('bName' in c, 'missing bName');
    assert.ok('score' in c, 'missing score');
    assert.strictEqual(c.aId, 'f1');
    assert.strictEqual(c.bId, 'f2');
    assert.ok(c.score <= 0.25, `score ${c.score} should be <= 0.25`);
  });
});

describe('findDuplicateSubtrees', () => {
  it('Test 7: detects two folders with identical link URLs (different order)', () => {
    const tree = makeFolder('root', 'root', [
      makeFolder('f1', 'Tools A', [
        makeLink('l1', 'Alpha', 'https://alpha.com'),
        makeLink('l2', 'Beta', 'https://beta.com'),
      ]),
      makeFolder('f2', 'Tools B', [
        makeLink('l3', 'Beta', 'https://beta.com'),
        makeLink('l4', 'Alpha', 'https://alpha.com'),
      ]),
    ]);
    const duplicates = findDuplicateSubtrees(tree);
    assert.strictEqual(duplicates.length, 1);
    assert.strictEqual(duplicates[0].keepId, 'f1');
    assert.strictEqual(duplicates[0].removeId, 'f2');
  });

  it('Test 8: does NOT flag folders with different link URLs', () => {
    const tree = makeFolder('root', 'root', [
      makeFolder('f1', 'Tools A', [
        makeLink('l1', 'Alpha', 'https://alpha.com'),
      ]),
      makeFolder('f2', 'Tools B', [
        makeLink('l2', 'Beta', 'https://beta.com'),
      ]),
    ]);
    const duplicates = findDuplicateSubtrees(tree);
    assert.strictEqual(duplicates.length, 0);
  });

  it('Test 9: skips empty folders (no link children)', () => {
    const tree = makeFolder('root', 'root', [
      makeFolder('f1', 'Empty A', []),
      makeFolder('f2', 'Empty B', []),
    ]);
    const duplicates = findDuplicateSubtrees(tree);
    assert.strictEqual(duplicates.length, 0);
  });

  it('Test 10: returns keepId/keepName/removeId/removeName for each duplicate pair', () => {
    const tree = makeFolder('root', 'root', [
      makeFolder('f1', 'Tools A', [
        makeLink('l1', 'Site', 'https://site.com'),
      ]),
      makeFolder('f2', 'Tools B', [
        makeLink('l2', 'Site', 'https://site.com'),
      ]),
    ]);
    const duplicates = findDuplicateSubtrees(tree);
    assert.strictEqual(duplicates.length, 1);
    const d = duplicates[0];
    assert.ok('keepId' in d, 'missing keepId');
    assert.ok('keepName' in d, 'missing keepName');
    assert.ok('removeId' in d, 'missing removeId');
    assert.ok('removeName' in d, 'missing removeName');
  });
});

describe('fingerprintSubtree', () => {
  it('Test 11: same URLs in different order produce same fingerprint', () => {
    const folderA = makeFolder('f1', 'Folder A', [
      makeLink('l1', 'Alpha', 'https://alpha.com'),
      makeLink('l2', 'Beta', 'https://beta.com'),
    ]);
    const folderB = makeFolder('f2', 'Folder B', [
      makeLink('l3', 'Beta', 'https://beta.com'),
      makeLink('l4', 'Alpha', 'https://alpha.com'),
    ]);
    assert.strictEqual(fingerprintSubtree(folderA), fingerprintSubtree(folderB));
  });

  it('Test 12: different URLs produce different fingerprint', () => {
    const folderA = makeFolder('f1', 'Folder A', [
      makeLink('l1', 'Alpha', 'https://alpha.com'),
    ]);
    const folderB = makeFolder('f2', 'Folder B', [
      makeLink('l2', 'Beta', 'https://beta.com'),
    ]);
    assert.notStrictEqual(fingerprintSubtree(folderA), fingerprintSubtree(folderB));
  });
});
