---
phase: 2
slug: core-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) |
| **Config file** | none — tests run via `npm test` → `node --test test/**/*.test.js` |
| **Quick run command** | `node --test test/dedup.test.js test/fuzzy.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test/dedup.test.js test/fuzzy.test.js`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | DEDUP-01, DEDUP-02 | unit | `node --test test/dedup.test.js` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 0 | DEDUP-03, DEDUP-04 | unit | `node --test test/fuzzy.test.js` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | DEDUP-02 | unit | `node --test test/dedup.test.js` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | DEDUP-01 | unit | `node --test test/dedup.test.js` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 1 | DEDUP-03 | unit | `node --test test/fuzzy.test.js` | ❌ W0 | ⬜ pending |
| 2-02-04 | 02 | 1 | DEDUP-04 | unit | `node --test test/fuzzy.test.js` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | DEDUP-01–04 | integration | `npm test` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 2 | DEDUP-03, DEDUP-04 | manual | n/a | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/dedup.test.js` — stubs for DEDUP-01 (dedup walk) and all 7 DEDUP-02 normalization patterns
- [ ] `test/fuzzy.test.js` — stubs for DEDUP-03 (folder name fuzzy match) and DEDUP-04 (subtree fingerprinting)

*Existing infrastructure: `node:test` runner confirmed from `package.json`. No framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ⚠️ badge shown inline for similar folder names | DEDUP-03 | DOM rendering requires browser visual check | Load file, click Run Cleanup, verify ⚠️ appears next to flagged folders |
| Bulk "Approve all merges" applies all candidates | DEDUP-03 | Multi-step UI interaction | Click Approve all merges, verify all flagged folders merged in tree |
| Duplicate subtree flagged with merge/keep inline | DEDUP-04 | DOM rendering requires browser visual check | Load file with duplicate folder contents, verify inline flag shown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
