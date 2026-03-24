/**
 * Golden-file regression test for the classifier pipeline.
 *
 * This file captures the current URL → category baseline BEFORE any
 * CATEGORY_KEYWORDS changes. No change to classification logic may alter
 * previously-passing entries here without an explicit decision.
 *
 * GOLDEN maps URL strings (and optional metadata) to expected category labels.
 * Each entry calls classifyNode and asserts .category matches the expected value.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyNode } from '../src/classifier.js';

// ─── Golden fixture ────────────────────────────────────────────────────────────
// Format: { url, metadata?, expected }
// metadata-based entries exercise the classifyByMetadata fallback.
// All entries passed against the codebase at time of fixture creation (2026-03-24).

const GOLDEN = [
  // ── Development ───────────────────────────────────────────────────────────
  { url: 'https://github.com/foo/bar',               expected: 'Development' },
  { url: 'https://www.github.com/foo',               expected: 'Development' },
  { url: 'https://stackoverflow.com/questions/1',    expected: 'Development' },
  { url: 'https://npmjs.com/package/lodash',         expected: 'Development' },
  { url: 'https://developer.mozilla.org/docs/Web',   expected: 'Development' },

  // ── Video ─────────────────────────────────────────────────────────────────
  { url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',  expected: 'Video' },
  { url: 'https://www.youtube.com/watch?v=abc',       expected: 'Video' },
  { url: 'https://vimeo.com/123456',                  expected: 'Video' },
  { url: 'https://twitch.tv/somechannel',             expected: 'Video' },
  { url: 'https://ted.com/talks/some_talk',           expected: 'Video' },

  // ── Social / Community ────────────────────────────────────────────────────
  { url: 'https://reddit.com/r/programming',         expected: 'Social / Community' },
  { url: 'https://news.ycombinator.com/item?id=1',   expected: 'Social / Community' },
  { url: 'https://twitter.com/someone/status/1',     expected: 'Social / Community' },
  { url: 'https://x.com/someone',                    expected: 'Social / Community' },
  { url: 'https://linkedin.com/in/someprofile',      expected: 'Social / Community' },

  // ── News ──────────────────────────────────────────────────────────────────
  { url: 'https://bbc.com/news/technology',          expected: 'News' },
  { url: 'https://theguardian.com/uk/news',          expected: 'News' },
  { url: 'https://techcrunch.com/2024/01/01/story',  expected: 'News' },
  { url: 'https://arstechnica.com/tech-policy/2024', expected: 'News' },
  { url: 'https://wired.com/story/ai-chips-2024',    expected: 'News' },

  // ── Shopping ──────────────────────────────────────────────────────────────
  { url: 'https://amazon.com/dp/B0001234',           expected: 'Shopping' },
  { url: 'https://ebay.com/itm/123456',              expected: 'Shopping' },
  { url: 'https://etsy.com/listing/123456',          expected: 'Shopping' },
  { url: 'https://bestbuy.com/site/product/123',     expected: 'Shopping' },

  // ── Tools ─────────────────────────────────────────────────────────────────
  { url: 'https://notion.so/workspace',              expected: 'Tools' },
  { url: 'https://trello.com/b/abc/board',           expected: 'Tools' },
  { url: 'https://regex101.com/',                    expected: 'Tools' },
  { url: 'https://excalidraw.com/',                  expected: 'Tools' },

  // ── Reference ─────────────────────────────────────────────────────────────
  { url: 'https://wikipedia.org/wiki/JavaScript',    expected: 'Reference' },
  { url: 'https://en.wikipedia.org/wiki/Node.js',    expected: 'Reference' },
  { url: 'https://wolframalpha.com/input?i=pi',      expected: 'Reference' },
  { url: 'https://arxiv.org/abs/2301.00001',         expected: 'Reference' },

  // ── Design ────────────────────────────────────────────────────────────────
  { url: 'https://figma.com/file/xyzABC123',        expected: 'Design' },
  { url: 'https://dribbble.com/shots/popular',       expected: 'Design' },
  { url: 'https://fonts.google.com/specimen/Inter',  expected: 'Design' },
  { url: 'https://unsplash.com/photos/abc',          expected: 'Design' },

  // ── Finance ───────────────────────────────────────────────────────────────
  { url: 'https://bloomberg.com/markets',            expected: 'Finance' },
  { url: 'https://coinbase.com/price/bitcoin',       expected: 'Finance' },
  { url: 'https://investopedia.com/terms/s/stock',   expected: 'Finance' },
  { url: 'https://stripe.com/docs/payments',         expected: 'Finance' },

  // ── Learning ──────────────────────────────────────────────────────────────
  { url: 'https://coursera.org/learn/machine-learning', expected: 'Learning' },
  { url: 'https://udemy.com/course/javascript',         expected: 'Learning' },
  { url: 'https://khanacademy.org/math/calculus',       expected: 'Learning' },
  { url: 'https://freecodecamp.org/news/article',       expected: 'Learning' },

  // ── classifyByMetadata fallback (URLs not in DOMAIN_RULES) ────────────────
  {
    url: 'https://some-dev-blog.example.com/post/1',
    metadata: { title: 'GitHub Actions CI/CD setup', description: 'programming and code pipeline' },
    expected: 'Development',
  },
  {
    url: 'https://my-videos.example.net/watch?id=5',
    metadata: { title: 'Watch the best stream', description: 'video channel playlist' },
    expected: 'Video',
  },
  {
    url: 'https://articles.example.org/breaking-news',
    metadata: { title: 'Breaking news report', description: 'headline journalism editorial' },
    expected: 'News',
  },
];

// ─── Golden-file assertions ────────────────────────────────────────────────────

describe('classifier golden-file regression', () => {
  for (const fixture of GOLDEN) {
    const label = fixture.metadata
      ? `${fixture.url} (via metadata) → ${fixture.expected}`
      : `${fixture.url} → ${fixture.expected}`;

    it(label, () => {
      const node = {
        id: 'golden-test',
        type: 'link',
        title: 'Golden test',
        url: fixture.url,
        ...(fixture.metadata ? { metadata: fixture.metadata } : {}),
      };
      const result = classifyNode(node);
      assert.equal(
        result.category,
        fixture.expected,
        `Expected ${fixture.url} to classify as "${fixture.expected}" but got "${result.category}"`
      );
    });
  }
});
