---
phase: 5
slug: editable-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`) |
| **Config file** | None — runner invoked directly via `npm test` |
| **Quick run command** | `node --test test/treeUtils.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test/treeUtils.test.js`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | CLASS-03 | unit | `node --test test/treeUtils.test.js` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 0 | UI-02 | unit | `node --test test/treeUtils.test.js` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | CLASS-03 | unit | `node --test test/treeUtils.test.js` | ✅ | ⬜ pending |
| 5-02-02 | 02 | 1 | UI-02 | unit | `node --test test/treeUtils.test.js` | ✅ | ⬜ pending |
| 5-03-01 | 03 | 1 | UI-01 | manual | Browser visual check | N/A | ⬜ pending |
| 5-03-02 | 03 | 1 | UI-03 | manual | Browser visual check | N/A | ⬜ pending |
| 5-04-01 | 04 | 2 | UI-02 | manual | `POST /api/edit` curl + browser | N/A | ⬜ pending |
| 5-05-01 | 05 | 2 | CLASS-03 | unit | `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/treeUtils.test.js` — stubs for CLASS-03 (pruneEmptyFolders), UI-02 (deleteNode, moveNode, markKeep)

*Wave 0 creates the test file with test stubs before implementation begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Side-by-side layout renders both panels | UI-01 | Browser visual — no DOM assertion framework | Upload bookmarks → classify → verify two columns visible |
| Context menu appears on right-click | UI-02 | Browser visual + interaction | Right-click node in right panel → verify menu appears with 3 options |
| `POST /api/edit` returns mutated tree | UI-02 | Requires running server | `curl -X POST /api/edit -d '{"op":"delete","nodeId":"<id>"}' → verify classifiedTree changes |
| Summary panel shows correct counts | UI-03 | Browser visual — reactive Alpine state | Run full pipeline → verify 4 data points match expectations |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
