# Phase 5: Editable UI - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-03-24
**Phase:** 05-editable-ui
**Mode:** assumptions
**Areas analyzed:** Before/After Layout Model, Context Menu Editing & Mutation Model, Summary Panel Data Source, Empty Folder Pruning

## Assumptions Presented

### Before/After Layout Model
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Two-column layout extending current single-panel classified screen; two x-ref containers; renderTree() called twice | Confident | `public/index.html` lines 579-582 (single panel); `public/app.js` lines 15-161 (renderTree signature) |

### Context Menu Editing & Mutation Model
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Single floating div context menu; edit ops sync to new POST /api/edit route; server is source of truth | Likely | Pattern from `/api/cleanup`, `/api/classify`; `src/routes/export.js` reads `session.classifiedTree` directly |

### Summary Panel Data Source
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| All four counters sourced from existing Alpine state; no new API endpoint needed | Confident | `public/app.js` lines 183, 187, 209 — deadCount, cleanupStats, mergeCandidates all present |

### Empty Folder Pruning (CLASS-03)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| pruneEmptyFolders() in src/shared/treeUtils.js, called from export route before exportToNetscape() | Likely | `src/routes/export.js` is single serialization choke point; hierarchyBuilder already prevents empties at build time |

## Corrections Made

No corrections — all assumptions confirmed.
