---
phase: 6
slug: classification-quality
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | none — invoked via npm script |
| **Quick run command** | `node --test test/classifier.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test/classifier.test.js`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-W0-01 | W0 | 0 | CLASS-04 | golden-file regression | `node --test test/classifier.golden.test.js` | ❌ W0 | ⬜ pending |
| 6-01-01 | 01 | 1 | CLASS-01 | unit | `node --test test/classifier.test.js` | ✅ | ⬜ pending |
| 6-01-02 | 01 | 1 | CLASS-02 | unit | `node --test test/classifier.test.js` | ✅ | ⬜ pending |
| 6-01-03 | 01 | 1 | CLASS-03 | unit | `node --test test/classifier.test.js` | ✅ | ⬜ pending |
| 6-01-04 | 01 | 1 | CLASS-04 | golden-file | `node --test test/classifier.golden.test.js` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 2 | CLASS-05 | unit | `node --test test/classifier.test.js` | ✅ | ⬜ pending |
| 6-02-02 | 02 | 2 | CLASS-06 | unit | `node --test test/classifier.test.js` | ✅ | ⬜ pending |
| 6-03-01 | 03 | 3 | CLASS-06 | manual | See manual verifications below | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/classifier.golden.test.js` — golden-file regression test covering CLASS-04 baseline; must be written and passing BEFORE any `CATEGORY_KEYWORDS` edits

*All other test infrastructure exists — `test/classifier.test.js` is extended in-place for CLASS-01 through CLASS-03 and CLASS-05 through CLASS-06.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toggle badge appears on `-`-prefixed folders in checked state left panel | CLASS-06 | DOM rendering check | Load app, upload bookmarks, run link check, verify `[↺ reclassify]` badge appears on folders starting with `-` in left panel |
| Toggle button changes state on click | CLASS-06 | Alpine reactivity + DOM state | Click `[↺ reclassify]` button — verify badge changes to toggled state; click again to revert |
| Opted-in folder contents classified normally after re-classify | CLASS-06 | End-to-end UI flow | Toggle a `-` folder on, click Classify, verify links appear in category folders instead of their original `-` folder |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
