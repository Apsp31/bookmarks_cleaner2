# Phase 4: Classifier and Structure - Discussion Log (Auto Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-03-23
**Phase:** 04-classifier-and-structure
**Mode:** discuss (--auto flag)
**Areas analyzed:** Classification Data Source, Taxonomy Design, Session State Extension, Route and Module Boundaries, Frontend Trigger

## Assumptions Presented

### Classification Data Source
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Domain rules map → OG metadata, no additional fetches | Confident | `src/linkChecker.js` lines 48-64 (OG capture), `src/shared/types.js` line 11 (metadata field), `03-CONTEXT.md` D-16/D-18 |

### Session State Extension
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Add `classifiedTree` field, extend export chain | Confident | `src/session.js` (tree/cleanTree/checkedTree pattern), `src/routes/export.js` (priority chain), `02-CONTEXT.md` D-07, `03-CONTEXT.md` D-03/D-04, `src/shared/types.js` line 10 (category stub) |

### Hierarchy Proposal Shape
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Use `BookmarkNode` tree structure (not separate data structure) | Likely | `src/shared/types.js` (only one tree type), `src/exporter.js`, all prior pipeline stages produce BookmarkNode trees |

### Route and Module Boundaries
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| New `src/classifier.js` + `src/routes/classify.js` | Likely | `src/routes/cleanup.js`, `src/routes/check.js` pattern; `src/dedup.js`, `src/linkChecker.js` logic separation |

## Corrections Made

No corrections — --auto mode, all assumptions Confident/Likely, proceeding without user prompts.

## Auto-Resolved

- Taxonomy design (external research topic): auto-resolved from REQUIREMENTS.md CLASS-01 examples (github.com→Development, youtube.com→Video, reddit.com→Community) and PROJECT.md constraints (max 3 levels, no LLM)
- Fallback category: auto-selected "Other" as the uncategorised bucket label
- Single-item categories: auto-selected "keep as-is" (Phase 5 handles user reorganisation)
