# Phase 8: Drag-and-Drop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-03-26
**Phase:** 08-drag-and-drop
**Mode:** discuss
**Areas analyzed:** Drop indicator style, Drag trigger, Reorder API shape

## Gray Areas Presented

| Area | Description |
|------|-------------|
| Drop indicator style | What visual appears at valid drop positions during drag? |
| Drag trigger | Grab-handle icon vs whole folder header row draggable? |
| Reorder API shape | Extend `/api/edit` op: 'reorder' vs new `/api/reorder` endpoint |

## User Selected Areas

User selected: **Drop indicator style** only. Drag trigger and Reorder API shape left to Claude's discretion.

## Discussed: Drop Indicator Style

**Options presented:**
1. Insertion line — 2px horizontal line between folder rows (top-half = insert before, bottom-half = insert after). Familiar from VS Code, Finder, Linear.
2. Folder highlight — blue/accent border or background on hovered folder row. Simpler but ambiguous (insert here vs drop into).

**User chose:** Insertion line (option 1)

## Claude's Discretion Decisions

### Drag Trigger
Chose whole `div.tree-folder-header` row as draggable (not a separate handle icon).
**Why:** The header is already the click/contextmenu target. No extra DOM element needed. Simplest integration.

### Reorder API Shape
Chose extending `/api/edit` with `op: 'reorder'`, `nodeId`, `parentFolderId`, `newIndex`.
**Why:** Consistent with existing delete/move/keep pattern in `edit.js` and `treeOps.js`. Same client `editOp()` helper pattern. No new route file needed.

## No Corrections Made

User confirmed insertion line — no other corrections requested.
