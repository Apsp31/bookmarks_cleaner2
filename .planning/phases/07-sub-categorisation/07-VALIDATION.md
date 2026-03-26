---
phase: 7
slug: sub-categorisation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (built-in, Node 18+) |
| **Config file** | none — test runner invoked directly |
| **Quick run command** | `node --test test/hierarchyBuilder.test.js test/exporter.test.js` |
| **Full suite command** | `node --test test/**/*.test.js` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test/hierarchyBuilder.test.js test/exporter.test.js`
- **After every plan wave:** Run `node --test test/**/*.test.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 0 | HIER-01 | unit | `node --test test/hierarchyBuilder.test.js` | ❌ W0 | ⬜ pending |
| 7-01-02 | 01 | 0 | HIER-01 | unit | `node --test test/hierarchyBuilder.test.js` | ❌ W0 | ⬜ pending |
| 7-01-03 | 01 | 0 | HIER-02 | unit | `node --test test/hierarchyBuilder.test.js` | ❌ W0 | ⬜ pending |
| 7-01-04 | 01 | 0 | HIER-02 | unit | `node --test test/hierarchyBuilder.test.js` | ❌ W0 | ⬜ pending |
| 7-01-05 | 01 | 0 | HIER-03 | unit | `node --test test/hierarchyBuilder.test.js` | ❌ W0 | ⬜ pending |
| 7-01-06 | 01 | 0 | HIER-04 | unit | `node --test test/hierarchyBuilder.test.js` | ❌ W0 | ⬜ pending |
| 7-01-07 | 01 | 0 | HIER-05 | unit | `node --test test/hierarchyBuilder.test.js` | ❌ W0 | ⬜ pending |
| 7-01-08 | 01 | 0 | HIER-06 | unit | `node --test test/hierarchyBuilder.test.js` | ❌ W0 | ⬜ pending |
| 7-01-09 | 01 | 0 | HIER-06 | unit | `node --test test/hierarchyBuilder.test.js` | ❌ W0 | ⬜ pending |
| 7-01-10 | 01 | 0 | HIER-06 | unit | `node --test test/hierarchyBuilder.test.js` | ❌ W0 | ⬜ pending |
| 7-01-11 | 01 | 0 | HIER-06 | unit | `node --test test/exporter.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Update UUID assertion in `test/hierarchyBuilder.test.js` line 139–146 to assert slug format (starts with `folder-`, no UUID pattern)
- [ ] Add test: deterministic IDs — same input produces same output IDs on two calls (HIER-01)
- [ ] Add test: 21 Development links → sub-folders created (HIER-02)
- [ ] Add test: 19 Development links → stays flat, no sub-folders (HIER-02)
- [ ] Add test: Development links route to correct sub-category (Frontend, Backend, DevOps/Cloud, Tools, Learning, AI/ML) (HIER-03)
- [ ] Add test: openai.com and huggingface.co land in AI/ML sub-folder (HIER-04)
- [ ] Add test: SUBCATEGORY_MIN_COVERAGE_RATIO = 0.6 skip behaviour — mostly unrecognised domains keeps flat (HIER-05/HIER-02)
- [ ] Add test: maxDepth assertion for sub-split case — 21+ Development links → max depth = 3 (HIER-06)
- [ ] Add test: `pruneEmptyFolders` removes empty folder node (HIER-06)
- [ ] Add test: `pruneEmptyFolders` preserves non-empty siblings (HIER-06)
- [ ] Add test in `test/exporter.test.js`: no `<DL><p>\s*</DL><p>` pattern after pruning (HIER-06)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Edit operations (delete, move) survive classify re-run | HIER-01 | Requires browser session state interaction | 1. Upload bookmarks, classify. 2. Note node ID in DevTools. 3. Delete a bookmark. 4. Re-classify. 5. Confirm prior edit was not reverted and tree is consistent. |
| Sub-folders appear correctly in right-panel review tree | HIER-02/03 | Requires browser rendering | Upload bookmarks with 21+ Development links, classify, confirm Development folder shows sub-folders in right panel |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
