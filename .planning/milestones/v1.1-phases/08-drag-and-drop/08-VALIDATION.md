---
phase: 8
slug: drag-and-drop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node --test (built-in) |
| **Config file** | none — existing test runner |
| **Quick run command** | `node --test src/tests/treeOps.test.js` |
| **Full suite command** | `node --test src/tests/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test src/tests/treeOps.test.js`
- **After every plan wave:** Run `node --test src/tests/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | DND-01 | unit | `node --test src/tests/treeOps.test.js` | ❌ W0 | ⬜ pending |
| 8-01-02 | 01 | 1 | DND-02 | manual | visual inspection during drag | N/A | ⬜ pending |
| 8-01-03 | 01 | 1 | DND-03 | unit | `node --test src/tests/treeOps.test.js` | ❌ W0 | ⬜ pending |
| 8-01-04 | 01 | 1 | DND-04 | unit | `node --test src/tests/treeOps.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/treeOps.test.js` — add stubs for reorderNode (DND-01, DND-03, DND-04)

*Existing infrastructure covers test runner setup. Only new unit tests are needed for reorderNode.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Insertion line visible at valid drop positions during drag | DND-02 | Requires live browser drag interaction | Start drag on a folder, hover over sibling positions, verify blue insertion line appears between rows |
| No highlight on invalid drop targets | DND-02 | Requires live browser drag interaction | Drag folder over bookmarks (not folders), verify no drop indicator appears |
| Context menu opens normally after drag | DND-04 | Requires sequential UI interaction | Complete a drag reorder, then right-click a folder, verify menu opens without triggering edit |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
