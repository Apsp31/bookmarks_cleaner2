---
phase: 4
slug: classifier-and-structure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | None — test command in `package.json` scripts |
| **Quick run command** | `node --test test/classifier.test.js test/hierarchyBuilder.test.js` |
| **Full suite command** | `node --test test/**/*.test.js` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test/classifier.test.js test/hierarchyBuilder.test.js`
- **After every plan wave:** Run `node --test test/**/*.test.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | CLASS-01 | unit | `node --test test/classifier.test.js` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | CLASS-02 | unit | `node --test test/classifier.test.js` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 0 | STRUCT-01 | unit | `node --test test/hierarchyBuilder.test.js` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 0 | STRUCT-02 | unit | `node --test test/hierarchyBuilder.test.js` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | CLASS-01 | unit | `node --test test/classifier.test.js` | ✅ W0 | ⬜ pending |
| 04-01-06 | 01 | 1 | CLASS-02 | unit | `node --test test/classifier.test.js` | ✅ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | STRUCT-01 | unit | `node --test test/hierarchyBuilder.test.js` | ✅ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | STRUCT-02 | unit | `node --test test/hierarchyBuilder.test.js` | ✅ W0 | ⬜ pending |
| 04-02-03 | 02 | 2 | CLASS-01,CLASS-02,STRUCT-01,STRUCT-02 | integration | `node --test test/**/*.test.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/classifier.test.js` — stubs covering CLASS-01 (domain→category lookup with www-strip) and CLASS-02 (OG metadata fallback, graceful degradation for absent metadata)
- [ ] `test/hierarchyBuilder.test.js` — stubs covering STRUCT-01 (max depth 3, all links present) and STRUCT-02 (empty categories dropped, single-category collections)

*No framework install needed — `node:test` is built-in. No shared fixture file needed — test data is constructed inline per existing test patterns.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Classify Bookmarks" button renders classifiedTree in existing tree panel | CLASS-01, CLASS-02, STRUCT-01 | Visual tree rendering requires browser; EventSource/DOM behavior can't be asserted programmatically | Load app, run cleanup + link check, click "Classify Bookmarks", verify tree updates with category folders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
