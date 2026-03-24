# Phase 6: Classification Quality - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-03-24
**Phase:** 06-classification-quality
**Mode:** discuss
**Areas discussed:** Path/subdomain category mapping, Hyphen-prefix folder structure, Opt-in UI placement

## Areas Presented

| Area | Selected for discussion? |
|------|--------------------------|
| Path/subdomain category mapping | ✓ Yes |
| Hyphen-prefix folder structure | ✓ Yes |
| Opt-in UI placement | ✓ Yes |
| Keyword precision approach | No (Claude's discretion) |

## Decisions Made

### Path/subdomain category mapping
- **Question:** `docs.*`, `/docs/` — map to existing "Reference" or new "Documentation" category?
- **Decision:** Map to existing categories — no new top-level categories.
  - `docs.*` / `/docs/` → Reference
  - `blog.*` / `/blog/` → News
  - `shop.*` / `/shop/` → Shopping
  - `/api/` → Development

### Hyphen-prefix folder structure
- **Question:** In the classified output, how do bookmarks from `-Pinned`, `-Work` folders appear?
- **Decision:** Keep as top-level folder with original name. The `-Pinned` folder appears in the hierarchy as a folder literally named `-Pinned`, sitting alongside Development, News, etc.

### Opt-in UI placement
- **Question:** Where does the CLASS-06 "reclassify hyphen-prefix folders normally" control live?
- **Decision:** Inline toggle on each hyphen-prefix folder in the left tree panel (during the `checked` state). Each `-`-named folder row gets a small `[↺ reclassify]` badge/button. Default is preserved.

## No Corrections

No decisions were revised during discussion.
