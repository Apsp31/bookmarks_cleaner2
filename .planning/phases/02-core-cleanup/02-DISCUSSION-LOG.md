# Phase 2: Core Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-03-23
**Phase:** 02-core-cleanup
**Mode:** discuss
**Areas discussed:** Cleanup trigger, Duplicate bookmark resolution, Folder merge confirmation UX

---

## Gray Areas Presented

1. Cleanup trigger — auto vs manual
2. Which duplicate to keep — first/most-recent/highest
3. Folder merge confirmation UX — list+approve-all / inline flags / blocking modal
4. Session architecture (user declined to discuss)

## Decisions Made

### Cleanup Trigger
- **Decision:** Manual "Run Cleanup" button after file loads
- **Rationale:** "Users can process" phrasing in roadmap implies intent; gives user a moment to review raw tree before changes

### Which Duplicate Wins
- **Decision:** First occurrence (depth-first, top-down)
- **Rationale:** Simple and deterministic; ADD_DATE can be missing or zero

### Folder Merge Confirmation UX
- **Decision:** Inline ⚠️ badges in tree with per-row [→ Merge] / [Keep separate] buttons, plus bulk "Approve all merges"
- **User note:** "option to merge or keep separate per line, but also option to approve all at once (or by higher level section)"

### Session Architecture
- **Not discussed** — Claude decided: add `session.cleanTree` alongside `session.tree`; export prefers `cleanTree` when present

## No Corrections
All selected decisions confirmed on first pass.
