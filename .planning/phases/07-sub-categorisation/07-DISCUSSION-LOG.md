# Phase 7: Sub-Categorisation - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-03-26T00:00:00.000Z
**Phase:** 07-sub-categorisation
**Mode:** assumptions
**Areas analyzed:** Node ID Strategy, Sub-Categorisation Placement, Depth Cap and Empty Folder Pruning, Test Coverage Shape

## Assumptions Presented

### Node ID Strategy (HIER-01)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Change crypto.randomUUID() to deterministic slug/hash IDs for folder nodes in buildHierarchy | Confident | src/hierarchyBuilder.js lines 63, 71; src/routes/edit.js lines 20–28; src/shared/treeOps.js |

### Sub-Categorisation Placement (HIER-02–05)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Sub-folder logic lives entirely in buildHierarchy; classifier.js untouched | Confident | src/hierarchyBuilder.js owns flatten→group→folder pipeline; src/routes/classify.js separation |
| Sub-taxonomy mapping (domain → sub-category) lives in hierarchyBuilder.js as local constant | Confident | Phase 6 CONTEXT.md deferred section; REQUIREMENTS.md HIER-03/04/05 targeting hierarchyBuilder.js |

### Depth Cap and Empty Folder Pruning (HIER-06)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Depth enforced by design in buildHierarchy (max 3 levels); pruneEmptyFolders added to treeOps.js, called from edit route | Likely | src/exporter.js serialises children: [] unconditionally; no prune step exists; test/exporter.test.js has no empty-DL test |

### Test Coverage Shape
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| New tests in test/hierarchyBuilder.test.js and test/exporter.test.js using existing node:test pattern | Confident | All test files use node:test + node:assert/strict; maxDepth helper already exists in hierarchyBuilder.test.js lines 19–22 |

## Corrections Made

No corrections — all assumptions confirmed.

## External Research

No external research performed — codebase provided sufficient evidence for all assumption areas.
