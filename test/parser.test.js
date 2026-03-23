import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseBookmarkHtml } from '../src/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleHtml = readFileSync(join(__dirname, 'fixtures', 'sample-bookmarks.html'), 'utf-8');

test('parseBookmarkHtml returns root node with type === folder and title === root', () => {
  const root = parseBookmarkHtml(sampleHtml);
  assert.equal(root.type, 'folder');
  assert.equal(root.title, 'root');
});

test('root has children array with length > 0', () => {
  const root = parseBookmarkHtml(sampleHtml);
  assert.ok(Array.isArray(root.children));
  assert.ok(root.children.length > 0);
});

test('nested folders at 3 levels deep have correct parent/child structure', () => {
  const root = parseBookmarkHtml(sampleHtml);
  // Development > JavaScript > Frameworks
  const dev = root.children.find(n => n.title === 'Development');
  assert.ok(dev, 'Development folder should exist');
  assert.equal(dev.type, 'folder');
  assert.ok(Array.isArray(dev.children));

  const js = dev.children.find(n => n.title === 'JavaScript');
  assert.ok(js, 'JavaScript folder should exist inside Development');
  assert.equal(js.type, 'folder');
  assert.ok(Array.isArray(js.children));

  const frameworks = js.children.find(n => n.title === 'Frameworks');
  assert.ok(frameworks, 'Frameworks folder should exist inside JavaScript');
  assert.equal(frameworks.type, 'folder');
  assert.ok(Array.isArray(frameworks.children));
  assert.ok(frameworks.children.length > 0, 'Frameworks folder should have children');
});

test('link nodes have type === link, non-empty title, non-empty url', () => {
  function collectLinks(node) {
    const links = [];
    if (node.type === 'link') links.push(node);
    for (const child of (node.children || [])) {
      links.push(...collectLinks(child));
    }
    return links;
  }

  const root = parseBookmarkHtml(sampleHtml);
  const links = collectLinks(root);
  assert.ok(links.length > 0, 'Should have at least one link');
  for (const link of links) {
    assert.equal(link.type, 'link');
    assert.ok(typeof link.title === 'string' && link.title.length > 0, `Link title should be non-empty: ${JSON.stringify(link)}`);
    assert.ok(typeof link.url === 'string' && link.url.length > 0, `Link url should be non-empty: ${JSON.stringify(link)}`);
  }
});

test('folder nodes have type === folder and children array', () => {
  function collectFolders(node) {
    const folders = [];
    if (node.type === 'folder') {
      folders.push(node);
      for (const child of (node.children || [])) {
        folders.push(...collectFolders(child));
      }
    }
    return folders;
  }

  const root = parseBookmarkHtml(sampleHtml);
  const folders = collectFolders(root);
  assert.ok(folders.length > 0, 'Should have at least one folder');
  for (const folder of folders) {
    assert.equal(folder.type, 'folder');
    assert.ok(Array.isArray(folder.children), `Folder should have children array: ${folder.title}`);
  }
});

test('titles with & characters are parsed correctly (not truncated or mangled)', () => {
  function findLinkByTitle(node, title) {
    if (node.type === 'link' && node.title === title) return node;
    for (const child of (node.children || [])) {
      const found = findLinkByTitle(child, title);
      if (found) return found;
    }
    return null;
  }

  const root = parseBookmarkHtml(sampleHtml);
  // The fixture has "AT&T - Official Website" — entity AT&T should parse as the literal string with &
  const attLink = findLinkByTitle(root, 'AT&T - Official Website');
  assert.ok(attLink, 'AT&T bookmark should be found with & character intact');
});

test('ADD_DATE attributes are parsed as integers when present', () => {
  const root = parseBookmarkHtml(sampleHtml);
  // Root children should include folders with add_date
  const devFolder = root.children.find(n => n.title === 'Development');
  assert.ok(devFolder, 'Development folder should exist');
  assert.equal(typeof devFolder.addDate, 'number', 'addDate should be a number');
  assert.equal(devFolder.addDate, 1609459200, 'addDate should be parsed as integer');
});

test('ADD_DATE is undefined when attribute is absent', () => {
  function findFolderByTitle(node, title) {
    if (node.type === 'folder' && node.title === title) return node;
    for (const child of (node.children || [])) {
      const found = findFolderByTitle(child, title);
      if (found) return found;
    }
    return null;
  }

  const root = parseBookmarkHtml(sampleHtml);
  // "Misc & Special Characters" folder has no ADD_DATE in the fixture
  const miscFolder = findFolderByTitle(root, 'Misc & Special Characters');
  assert.ok(miscFolder, 'Misc folder should exist');
  assert.equal(miscFolder.addDate, undefined, 'addDate should be undefined when not present');
});

test('DD elements do not break parsing (bookmark count is still correct)', () => {
  function countLinks(node) {
    let count = 0;
    if (node.type === 'link') count++;
    for (const child of (node.children || [])) count += countLinks(child);
    return count;
  }

  const root = parseBookmarkHtml(sampleHtml);
  const linkCount = countLinks(root);
  // The fixture has 31 <A HREF= occurrences; DD elements should not affect count
  assert.equal(linkCount, 31, `Should find all 31 links, found ${linkCount}`);
});

test('every node has an id property (UUID format)', () => {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function checkIds(node) {
    assert.ok(typeof node.id === 'string', `Node should have id: ${node.title}`);
    assert.match(node.id, uuidPattern, `Node id should be UUID format: ${node.id}`);
    for (const child of (node.children || [])) checkIds(child);
  }

  const root = parseBookmarkHtml(sampleHtml);
  checkIds(root);
});
