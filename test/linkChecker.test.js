import { describe, it, mock, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// We mock globalThis.fetch before importing the module under test
// so the module picks up the mock at import time.
// Since Node.js ESM caches modules, we do all fetch-mocking via a shared
// mockFetch reference that tests swap out via mock.method.

let checkUrl, checkAll, buildCheckedTree;

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal Response-like object.
 * @param {number} status
 * @param {string} contentType
 * @param {string} body
 * @param {string} [url]
 */
function makeResponse(status, contentType = 'text/html', body = '', url) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url: url ?? 'https://example.com',
    headers: {
      get(name) {
        if (name.toLowerCase() === 'content-type') return contentType;
        return null;
      },
    },
    text: async () => body,
  };
}

/**
 * Build a minimal BookmarkNode tree for testing buildCheckedTree / checkAll.
 */
function makeTree() {
  return {
    id: 'root',
    type: 'folder',
    title: 'Bookmarks',
    children: [
      { id: 'f1', type: 'folder', title: 'Folder', children: [
        { id: 'a', type: 'link', title: 'OK', url: 'https://ok.com' },
        { id: 'b', type: 'link', title: 'Dead', url: 'https://dead.com' },
        { id: 'c', type: 'link', title: 'Uncertain', url: 'https://ratelimit.com' },
      ]},
    ],
  };
}

// ─── dynamic import after module-level setup ──────────────────────────────────

before(async () => {
  // Import the module under test.
  // Tests control fetch via globalThis.fetch which the module reads at call time.
  const mod = await import('../src/linkChecker.js');
  checkUrl = mod.checkUrl;
  checkAll = mod.checkAll;
  buildCheckedTree = mod.buildCheckedTree;
});

// ─── checkUrl status resolution ───────────────────────────────────────────────

describe('checkUrl status resolution', () => {

  it('returns ok for 200 HEAD response', async () => {
    globalThis.fetch = async (url, opts) => makeResponse(200, 'text/plain', '', url);
    const result = await checkUrl('https://ok.com');
    assert.equal(result.status, 'ok');
  });

  it('returns ok for 200 response and captures finalUrl on redirect', async () => {
    globalThis.fetch = async (url, opts) => makeResponse(200, 'text/plain', '', 'https://redirected.com');
    const result = await checkUrl('https://ok.com');
    assert.equal(result.status, 'ok');
    assert.equal(result.finalUrl, 'https://redirected.com');
  });

  it('returns dead for 404 HEAD response', async () => {
    globalThis.fetch = async (url, opts) => makeResponse(404, 'text/plain', '', url);
    const result = await checkUrl('https://dead.com');
    assert.equal(result.status, 'dead');
  });

  it('returns dead for AbortError (timeout)', async () => {
    globalThis.fetch = async () => { const e = new Error('abort'); e.name = 'AbortError'; throw e; };
    const result = await checkUrl('https://timeout.com');
    assert.equal(result.status, 'dead');
  });

  it('returns dead for ENOTFOUND (DNS failure)', async () => {
    globalThis.fetch = async () => { const e = new Error('ENOTFOUND dns.com'); e.code = 'ENOTFOUND'; throw e; };
    const result = await checkUrl('https://dns.com');
    assert.equal(result.status, 'dead');
  });

  it('returns uncertain for 429 response', async () => {
    globalThis.fetch = async (url, opts) => makeResponse(429, 'text/plain', '', url);
    const result = await checkUrl('https://ratelimit.com');
    assert.equal(result.status, 'uncertain');
  });

  it('returns ok for 401 response', async () => {
    globalThis.fetch = async (url, opts) => makeResponse(401, 'text/plain', '', url);
    const result = await checkUrl('https://auth.com');
    assert.equal(result.status, 'ok');
  });

  it('returns ok for 403 response', async () => {
    globalThis.fetch = async (url, opts) => makeResponse(403, 'text/plain', '', url);
    const result = await checkUrl('https://forbidden.com');
    assert.equal(result.status, 'ok');
  });

  it('returns dead for malformed URL', async () => {
    const result = await checkUrl('not a valid url');
    assert.equal(result.status, 'dead');
  });

});

// ─── HEAD-first with GET fallback ─────────────────────────────────────────────

describe('HEAD-first with GET fallback', () => {

  it('falls back to GET when HEAD returns 405', async () => {
    let callCount = 0;
    globalThis.fetch = async (url, opts) => {
      callCount++;
      if (opts?.method === 'HEAD') return makeResponse(405, 'text/plain', '', url);
      // GET call
      return makeResponse(200, 'text/plain', '', url);
    };
    const result = await checkUrl('https://nohead.com');
    assert.equal(result.status, 'ok');
    assert.equal(callCount, 2);
  });

  it('falls back to GET when HEAD throws a network error', async () => {
    let callCount = 0;
    globalThis.fetch = async (url, opts) => {
      callCount++;
      if (opts?.method === 'HEAD') throw new Error('network error');
      return makeResponse(200, 'text/plain', '', url);
    };
    const result = await checkUrl('https://nohead.com');
    assert.equal(result.status, 'ok');
    assert.equal(callCount, 2);
  });

  it('does NOT fall back to GET when HEAD returns 404 (non-2xx is definitive)', async () => {
    let callCount = 0;
    globalThis.fetch = async (url, opts) => {
      callCount++;
      return makeResponse(404, 'text/plain', '', url);
    };
    const result = await checkUrl('https://dead-head.com');
    assert.equal(result.status, 'dead');
    assert.equal(callCount, 1);
  });

  it('returns dead when HEAD returns 405 and GET also returns non-2xx', async () => {
    globalThis.fetch = async (url, opts) => {
      if (opts?.method === 'HEAD') return makeResponse(405, 'text/plain', '', url);
      return makeResponse(404, 'text/plain', '', url);
    };
    const result = await checkUrl('https://nohead.com');
    assert.equal(result.status, 'dead');
  });

});

// ─── OG metadata extraction ───────────────────────────────────────────────────

describe('OG metadata extraction', () => {

  const htmlBody = `
    <html>
      <head>
        <meta property="og:title" content="Test Title" />
        <meta property="og:description" content="Test Description" />
        <meta property="og:image" content="https://example.com/img.png" />
        <meta name="description" content="Meta desc" />
      </head>
    </html>
  `;

  it('extracts OG metadata from 2xx HTML GET response', async () => {
    // HEAD returns 405 to trigger GET fallback with body
    globalThis.fetch = async (url, opts) => {
      if (opts?.method === 'HEAD') return makeResponse(405, 'text/plain', '', url);
      return makeResponse(200, 'text/html; charset=utf-8', htmlBody, url);
    };
    const result = await checkUrl('https://og.com');
    assert.equal(result.status, 'ok');
    assert.ok(result.metadata, 'metadata should be present');
    assert.equal(result.metadata.title, 'Test Title');
    assert.equal(result.metadata.description, 'Test Description');
    assert.equal(result.metadata.image, 'https://example.com/img.png');
  });

  it('metadata is null when HEAD returns 2xx (no body access)', async () => {
    globalThis.fetch = async (url, opts) => makeResponse(200, 'text/plain', '', url);
    const result = await checkUrl('https://ok.com');
    assert.equal(result.status, 'ok');
    // HEAD succeeded — no body parsed, so metadata absent
    assert.ok(!result.metadata, 'metadata should be absent when HEAD succeeds');
  });

  it('metadata is null when GET returns non-HTML content-type', async () => {
    globalThis.fetch = async (url, opts) => {
      if (opts?.method === 'HEAD') return makeResponse(405, 'text/plain', '', url);
      return makeResponse(200, 'application/json', '{}', url);
    };
    const result = await checkUrl('https://json.com');
    assert.equal(result.status, 'ok');
    assert.ok(!result.metadata, 'metadata should be absent for non-HTML');
  });

});

// ─── buildCheckedTree ─────────────────────────────────────────────────────────

describe('buildCheckedTree', () => {

  it('removes dead nodes', () => {
    const linkStatuses = new Map([
      ['a', { status: 'ok' }],
      ['b', { status: 'dead' }],
      ['c', { status: 'ok' }],
    ]);
    const tree = makeTree();
    const result = buildCheckedTree(tree, linkStatuses);
    const links = result.children[0].children;
    assert.equal(links.length, 2);
    assert.ok(links.every(n => n.linkStatus !== 'dead'));
  });

  it('keeps ok and uncertain nodes', () => {
    const linkStatuses = new Map([
      ['a', { status: 'ok' }],
      ['b', { status: 'dead' }],
      ['c', { status: 'uncertain' }],
    ]);
    const tree = makeTree();
    const result = buildCheckedTree(tree, linkStatuses);
    const links = result.children[0].children;
    assert.equal(links.length, 2);
    const statuses = links.map(n => n.linkStatus);
    assert.ok(statuses.includes('ok'));
    assert.ok(statuses.includes('uncertain'));
  });

  it('preserves empty folders (empty-folder cleanup is Phase 5)', () => {
    const linkStatuses = new Map([
      ['a', { status: 'dead' }],
      ['b', { status: 'dead' }],
      ['c', { status: 'dead' }],
    ]);
    const tree = makeTree();
    const result = buildCheckedTree(tree, linkStatuses);
    // folder f1 should remain even if all children removed
    assert.equal(result.children.length, 1);
    assert.equal(result.children[0].type, 'folder');
    assert.equal(result.children[0].children.length, 0);
  });

  it('does not mutate the input tree', () => {
    const linkStatuses = new Map([
      ['a', { status: 'ok' }],
      ['b', { status: 'dead' }],
      ['c', { status: 'uncertain' }],
    ]);
    const tree = makeTree();
    const originalChildCount = tree.children[0].children.length;
    buildCheckedTree(tree, linkStatuses);
    assert.equal(tree.children[0].children.length, originalChildCount);
  });

  it('annotates surviving nodes with linkStatus', () => {
    const linkStatuses = new Map([
      ['a', { status: 'ok', finalUrl: 'https://ok.com' }],
      ['b', { status: 'dead' }],
      ['c', { status: 'uncertain' }],
    ]);
    const tree = makeTree();
    const result = buildCheckedTree(tree, linkStatuses);
    const links = result.children[0].children;
    const okNode = links.find(n => n.id === 'a');
    assert.ok(okNode, 'ok node should exist');
    assert.equal(okNode.linkStatus, 'ok');
  });

});

// ─── checkAll with onProgress ─────────────────────────────────────────────────

describe('checkAll with onProgress', () => {

  it('calls onProgress for each checked URL', async () => {
    globalThis.fetch = async (url, opts) => makeResponse(200, 'text/plain', '', url);
    const tree = makeTree();
    const progressEvents = [];
    const result = await checkAll(tree, (evt) => progressEvents.push(evt));

    assert.equal(progressEvents.length, 3);
    for (const evt of progressEvents) {
      assert.ok(typeof evt.checked === 'number', 'checked should be a number');
      assert.ok(typeof evt.total === 'number', 'total should be a number');
      assert.ok(typeof evt.currentUrl === 'string', 'currentUrl should be a string');
      // eta may be null/Infinity for first event
      assert.ok('eta' in evt, 'eta should be present in event');
    }
  });

  it('returns checkedTree, deadCount, uncertainCount', async () => {
    globalThis.fetch = async (url, opts) => {
      if (url.includes('dead')) return makeResponse(404, 'text/plain', '', url);
      if (url.includes('ratelimit')) return makeResponse(429, 'text/plain', '', url);
      return makeResponse(200, 'text/plain', '', url);
    };
    const tree = makeTree();
    const result = await checkAll(tree, () => {});

    assert.ok(result.checkedTree, 'should return checkedTree');
    assert.equal(result.deadCount, 1);
    assert.equal(result.uncertainCount, 1);
  });

  it('progress total matches the number of links in the tree', async () => {
    globalThis.fetch = async (url, opts) => makeResponse(200, 'text/plain', '', url);
    const tree = makeTree();
    let lastEvent = null;
    await checkAll(tree, (evt) => { lastEvent = evt; });
    assert.equal(lastEvent.total, 3);
    assert.equal(lastEvent.checked, 3);
  });

});

// ─── redirect capture ────────────────────────────────────────────────────────

describe('redirect capture', () => {

  it('includes finalUrl when response.url differs from input', async () => {
    globalThis.fetch = async (url, opts) => makeResponse(200, 'text/plain', '', 'https://final.com');
    const result = await checkUrl('https://redirected.com');
    assert.equal(result.status, 'ok');
    assert.equal(result.finalUrl, 'https://final.com');
  });

  it('finalUrl absent (or equal to input) when no redirect occurs', async () => {
    globalThis.fetch = async (url, opts) => makeResponse(200, 'text/plain', '', 'https://stable.com');
    const result = await checkUrl('https://stable.com');
    assert.equal(result.status, 'ok');
    // When response.url === input, finalUrl should either be absent or equal input
    if (result.finalUrl !== undefined) {
      assert.equal(result.finalUrl, 'https://stable.com');
    }
  });

});
