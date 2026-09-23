# Phase 4 — DataTable + list pages

_23 Sept 2026_

## Why this phase is scoped down, and how

The Phase 0 audit counted **~42 hand-rolled tables** outside the shared
`DataTable` component. The original plan was to roll `DataTable` out across
all of them. I'm not doing that in this pass, and want to say plainly why
rather than claim partial work as complete:

- A large share of those hand-rolled tables carry **real destructive
  actions** — bulk delete (Clients, Suppliers), CSV bulk import that creates
  records, per-row delete with cascade rules the server action enforces
  (e.g. "clients with projects can't be deleted — you'll be told which").
  Converting one of these to `DataTable` means re-wiring selection state,
  bulk-action wiring, and column visibility logic that's currently
  hand-verified working code.
- **I have no way to verify any of it.** This environment still has no
  login credentials, and the guardrails also say not to submit forms against
  the live database even if I could sign in. Rewriting ~30 list pages that
  each touch real records, with zero ability to click through a single one
  of them afterward, is exactly the kind of change that could silently
  break a working delete/bulk flow in production. That's a worse outcome
  than leaving the table hand-rolled for one more phase.

So this phase strengthens the shared primitive (safe — it's additive, and
the 8 pages already using it get the improvement for free) and stops there,
rather than doing a wide, unverified sweep.

## What shipped

**`DataTable.tsx`** (used today by Employees, Projects, Sites, Suppliers'
subsidiary list, and 4 others):
- **Animated bulk-action bar.** It used to pop in/out instantly on
  selection; now it slides down with a height/opacity transition
  (`Presence` + `m.div`), and back out the same way on Clear or when the
  last row is deselected.
- **Better no-results state.** "No rows match "x"." was the entire message
  with no way out except manually clearing the search box. Now it explains
  what to try and includes a "Clear search" button — the pattern
  `EmptyState` already uses elsewhere (what happened → why it matters →
  what to do), applied to the filtered-to-nothing case specifically, which
  `EmptyState` itself doesn't cover (that component is for genuinely empty
  data, not a search that matched nothing).
- Confirmed `toolbarExtra` (for filter chips/tabs) already existed in the
  component's API from before this phase — the "filter chips" item on the
  audit's Phase 4 list is already achievable per-page via composition, not
  something the primitive itself was missing.

## Deferred (flagging, not doing silently)

- **The wide `DataTable` rollout itself** — all ~34 remaining hand-rolled
  tables, per the reasoning above. If you want this done, I'd suggest doing
  it a module at a time, with you available to click through each one right
  after (create/delete/bulk-select/CSV import) before moving to the next,
  rather than me doing all 34 in a row unverified.
- **Row-level mount/exit animation** (a deleted row animating out instead of
  vanishing) — `DataTable`'s rows are plain `<tr>`; wrapping them in `m.tr`
  inside `AnimatePresence` is possible but has real cross-browser quirks
  with `display: table-row` that I didn't want to introduce without being
  able to test it. The audit's guardrail (never animate more than ~30 rows
  at once) also means this only matters for the visible page anyway.
- **Virtualisation** — no list in this app currently has enough rows (the
  live data has single/low-double-digit counts per module) to need it; the
  Phase 0 audit already flagged this as "defer until a list actually
  exceeds ~500 rows."

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — unchanged from the Phase 1–3 baseline.
- `npm run build` — clean.
- **Could not verify live** — same standing limitation. The bulk-bar
  animation and no-results state are both additive, non-destructive UI
  changes to a component 8 existing pages already render successfully
  (confirmed via `build`), so the risk here is much lower than a full
  rewrite would have been, but I still haven't seen either one animate.

Continuing to Phase 5 (forms & flows), scoped the same way — real, additive
UI improvements the codebase's own patterns already cover safely, not a
blind rewrite of every module's server-action-backed forms.
