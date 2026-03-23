---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` (no extra install — Node 20+) |
| **Config file** | none — Wave 0 creates `test/` directory |
| **Quick run command** | `node --test test/parser.test.js test/exporter.test.js` |
| **Full suite command** | `node --test test/**/*.test.js` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test/parser.test.js test/exporter.test.js`
- **After every plan wave:** Run `node --test test/**/*.test.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | FILE-01 | unit | `node --test test/parser.test.js` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | FILE-03 | unit | `node --test test/exporter.test.js` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | FILE-01+03 | unit | `node --test test/roundtrip.test.js` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 2 | FILE-02 | manual | Browser: file loads → backup downloads | n/a | ⬜ pending |
| 1-02-02 | 02 | 2 | FILE-01 | manual | Browser: drop zone accepts file, stats shown | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/parser.test.js` — stubs for FILE-01 (parse round-trip, edge cases: `&` in titles, empty folders, nested folders)
- [ ] `test/exporter.test.js` — stubs for FILE-03 (HTML escaping, DL/DT/H3/A structure, ADD_DATE format)
- [ ] `test/roundtrip.test.js` — stubs for FILE-01+03 (parse → export → re-parse, assert identical counts)
- [ ] `test/fixtures/sample.html` — minimal valid Chrome bookmark export with edge cases (`&`, `"`, `<`, `>` in titles)

*Node 20 built-in test runner requires no install — just `node --test`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Backup auto-downloads on file load | FILE-02 | Browser download API — cannot assert in unit test | Load any .html file → confirm browser Downloads notification appears with dated filename |
| Drop zone drag-and-drop accepts file | FILE-01 | Browser drag events — cannot simulate in Node test | Drag bookmarks.html to drop zone → confirm stats panel appears |
| Read-only tree renders collapsed folders | CONTEXT D-04 | DOM rendering — visual check only | After load, confirm folder nodes have toggle, leaf nodes show title + URL |
| Chrome can import the exported file | FILE-03 | Requires running Chrome | Export from app → Chrome Settings → Import bookmarks → verify count matches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
