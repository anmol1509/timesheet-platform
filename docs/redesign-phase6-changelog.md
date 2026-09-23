# Phase 6 — Detail pages & feedback layer

_23 Sept 2026_

## What shipped

- **Animated tabs, rolled out to 4 hand-rolled tab components** that all
  shared the exact same shape (a `border-b-2` per-button underline, swapped
  instantly on click): Project detail, Supplier detail, Employee edit, and
  the Demand documents (NOC/Undertaking/Profile) tabs. Each now uses a
  `layoutId` shared-element underline (the same pattern `AnimatedTabs`
  shipped in Phase 1) so the active indicator slides between tabs instead
  of jumping — without touching any of the actual tab *content* or the
  state that drives it, since all four already separated "which tab is
  active" from "what's inside it" cleanly.
- **Destructive actions: fixed the one confirmed `window.confirm`** left in
  the app (`clients/delete-clients-button.tsx`) — swapped for the existing
  `ConfirmDialog` component with no change to the actual delete logic or
  server action, just the confirmation UI (a styled dialog instead of the
  browser's native, unstyleable, easy-to-blur-past `confirm()`).
- **Data Reset's per-module cards no longer sit red at rest.** The Phase 0
  audit's finding: every module's "Reset" button was `btn-danger` (solid
  red), all the time, on every card — the page read as a wall of red
  buttons rather than one page with a genuinely dangerous action. Changed
  the trigger buttons to secondary (grey); the actual danger styling stays
  where it belongs, on the confirmation dialog's real "Delete all X"
  submit button. Left "Reset Everything" (the single page-level, all-
  modules action) as solid red/on a red card — that one's used sparingly
  by design and the strong treatment is earned there.

## Deferred (flagging, not doing silently)

- **Activity timelines / document panels** for detail pages (employee,
  project, client, supplier) — the audit's plan calls for read-first detail
  pages with work/accommodation history rendered as a timeline. That's a
  structural change to how each detail page is laid out (which fields show
  by default vs. behind "Edit"), not a presentational one, and touches the
  same edit-vs-view question flagged as risky in Phase 5. Not started.
- **Every other hand-rolled tab component** beyond the four converted — a
  handful more exist (e.g. within Suppliers' subsidiary switcher, some
  dashboards' internal panels) but weren't confirmed to share the identical
  safe shape the four converted ones did, and I didn't want to convert one
  I hadn't actually read closely just to hit a bigger number.
- **Radix Popover/Tooltip + AnimatePresence pass** on remaining dialogs —
  `Dialog.tsx` and `SlideOver` already use `AnimatePresence`-equivalent
  patterns from Phase 1; `Tooltip` moved to Radix in Phase 1 too. What's
  left is mostly per-page custom dropdown/menu code that wasn't audited
  closely enough this phase to touch confidently.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — unchanged from the Phase 1–5 baseline.
- `npm run build` — clean.
- **Could not verify live** — same standing limitation as every phase
  since Phase 2. All four tab conversions and the two button/dialog swaps
  were chosen because they're narrow, mechanical, and I could read the
  full before/after diff and be confident nothing else in the file changed
  behaviourally — but "read closely" isn't "clicked through," and none of
  this has been seen rendered.

Continuing to Phase 7 (polish & QA) to close out this pass.
