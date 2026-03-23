---
phase: 3
slug: link-checker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | none — test runner invoked directly |
| **Quick run command** | `node --test test/linkChecker.test.js` |
| **Full suite command** | `node --test test/**/*.test.js` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test/linkChecker.test.js`
- **After every plan wave:** Run `node --test test/**/*.test.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | — | setup | `node --test test/linkChecker.test.js` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | LINK-01, LINK-03, LINK-04 | unit | `node --test test/linkChecker.test.js` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 1 | LINK-01 | unit | `node --test test/linkChecker.test.js` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 1 | LINK-02 | unit | `node --test test/linkChecker.test.js` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 2 | LINK-05 | unit | `node --test test/linkChecker.test.js` | ❌ W0 | ⬜ pending |
| 3-03-02 | 03 | 2 | LINK-05 | manual | browser DevTools — EventSource stream visible | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/linkChecker.test.js` — stubs for LINK-01 through LINK-05 (mock fetch via `node:test` mock.module())
- [ ] Verify `src/linkChecker.js` module skeleton exists with exported `checkUrl` and `checkAll` signatures

*Existing infrastructure: `test/parser.test.js`, `test/dedup.test.js`, `test/exporter.test.js`, `test/fuzzy.test.js`, `test/roundtrip.test.js` — all use `node:test`; pattern is established.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SSE progress stream visible in browser | LINK-05 | Requires running browser + loaded bookmark file | Open DevTools → Network → filter `check-links` → verify event stream with `checked`, `total`, `currentUrl`, `eta` fields updating in real time |
| ETA and count display in UI during check | LINK-05 | Requires UI interaction | Load bookmarks → click "Check Links" → verify counter and URL display update while checker runs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
