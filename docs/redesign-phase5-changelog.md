# Phase 5 — Forms & flows

_23 Sept 2026_

## Scope, and why it's narrower than the original plan

The original plan was module-by-module for all 9 modules' forms and
multi-step flows. Like Phase 4, most of that work touches server actions
that create, edit or delete real records (the employee wizard, demand
allocation, check-in, timesheet entry) — I can't verify any of that live in
this environment, and the guardrails say not to submit forms against the
live database regardless. Restructuring a step count, a validation gate, or
a submit handler unverified is a real risk of silently breaking a working
flow, not just a cosmetic risk.

So this phase picked specific, **additive or purely presentational** fixes
from the audit's ranked list — ones where I could reason confidently about
correctness from the code alone, without needing to exercise the actual
create/edit/delete path:

## What shipped

- **`FormSaveBar` now hides itself when there's nothing to act on**
  (Phase 0 finding: it rendered permanently, so an employee/client/supplier
  record you opened and never touched still showed a live "Save changes"
  button — easy to edit a read-only visit by accident). It now animates in
  only once the form is dirty, mid-save, just-saved, or errored, and
  defaults `dirty` to `false` rather than treating a missing prop as
  "always show" — the safer failure direction for a button that writes
  data. Both existing call sites (client and supplier edit forms) already
  passed `dirty` explicitly, so this is a pure behaviour fix, not a
  half-migration.
- **Client Timesheet grid** (`invoices/client-timesheet/client-timesheet-grid.tsx`,
  the app's densest daily-editing screen):
  - Day headers now show the date number under the weekday name ("Tue" →
    "Tue" + "12") — the data (`DailyHourCell.date`) was already there, just
    not rendered.
  - Fixed the cell inputs' `outline-none` with no replacement, which the
    audit measured as `outline-style: none` on a focused cell — i.e. no
    visible focus at all. Replaced with the same focus-ring treatment used
    elsewhere (`focus-visible:ring-2`, which is Tailwind's box-shadow-based
    ring utility, not the native `outline` shorthand this codebase's own
    notes flag as unreliable under Tailwind v4).
  - Added `aria-label` to every cell ("Ajay Kumar, Tue") — there were none,
    so a screen reader had no way to tell which employee/day a given input
    belonged to.
  - Sticky header row and sticky Employee column, using the same
    scroll-container pattern `DataTable` already uses successfully (a
    capped-height wrapper is what makes `sticky top-0` stick to itself
    rather than the viewport — documented in this codebase's own design-
    system notes as an easy way to get wrong).
- **Daily Attendance calendar**: every unmarked day used to render in the
  same red/error style, including every future day in the month (Phase 0
  finding — 20+ days on a freshly-opened month all read as "something's
  wrong"). Unmarked-but-future days now render neutral ("Not due yet");
  unmarked past days still render red (a real gap). I deliberately did
  **not** also special-case weekends, even though the audit suggested it —
  this codebase has no existing weekend/working-day convention (it's
  project-specific, per the per-project holiday calendar), and guessing one
  risked marking a real working Saturday as "not due" for a site that works
  six days.

## Deferred (flagging, not doing silently)

- **The employee wizard** (merge "Trades & notes" + "Notes" into one step,
  add a completeness/progress indicator, sticky footer, draft persistence).
  This is the single highest-value item on the audit's ranked list, and I
  did not touch it this phase — it's 1,734 lines with real per-step
  validation gates and an AI-extraction flow, and reducing the step count
  specifically risks breaking the "jump to the step that owns a checklist
  field" logic that already exists. This deserves its own pass with the
  ability to actually click through it afterward.
- **Fill-down/paste/keyboard-range-select** for the timesheet grid — the
  audit's biggest ask for that screen, and also the riskiest: it touches
  the actual edit/save data path (`editCell`, `saveRow`), not just layout
  or a11y. Deferred for the same reason as the wizard.
- Every other module's forms (Demand, Facilities, Business Partners,
  Projects/NOCs, Sales, Billing, Admin) — not started this phase.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — unchanged from the Phase 1–4 baseline (18 problems, none
  new). Confirmed the `new Date()` call the attendance-calendar fix needed
  doesn't trip the same purity rule that's flagged elsewhere in this
  codebase — it only fires on impure calls used inline as an argument
  (e.g. inside a Prisma filter object), not on a plain `const today = new
  Date()` declaration, which is the same pattern this file's own parent
  page already used without complaint.
- `npm run build` — clean.
- **Could not verify live** — same standing limitation. Every change this
  phase was chosen specifically to be low-risk to reason about without
  running it (CSS/layout/a11y/visibility fixes, no data-path changes), but
  "low-risk to reason about" isn't "verified," and I want to be honest
  about that distinction rather than imply I clicked through any of this.

Continuing to Phase 6 (detail pages & feedback layer), scoped the same way.
