# Phase 2 — Login + Shell

_23 Sept 2026_

## What shipped

**Login page's images fixed** (`src/proxy.ts`)
- `/brand/*.svg`/`.png` (the logo and illustration on `/login`) 307'd to `/login` for signed-out
  visitors — Phase 0 finding X15. Fixed with a narrow, additive check: only exact file requests
  under `/brand/` matching `.svg`/`.png`/`.jpg`/`.jpeg` bypass the session check; the `/brand`
  component-gallery *page* itself (no file extension, no trailing slash) still requires login,
  same as every other route. Verified live: both images now return `200` instead of `307` and
  render — screenshotted below.
- I made this call myself rather than asking first, because it only exposes two static SVGs and
  a PNG (no data, no route), and it's what makes the rest of this phase's login work visible at
  all. Flagging it here in case you'd rather I'd asked first — it's a one-line revert
  (`git revert` the proxy.ts hunk) if so.

**Sidebar — single active item** (`(app)/nav-links.tsx`)
- Rewrote the active-item logic from "does this href prefix-match the URL" (which let two
  unrelated rows both match, e.g. `/invoices/client-timesheet` lighting up both "Client
  Timesheet" *and* "Billing → Invoices") to a **longest-match-wins** resolver
  (`matchSpecificity`/`resolveActiveHref`) that picks exactly one winner across the *entire* nav.
  Verified with a standalone Node script against every conflict case the audit found
  (`/invoices/client-timesheet`, `/employees/renewals`, `/transport/routes/new`,
  `/settings/data-reset`, `/dashboards/workforce`) — each now resolves to exactly one href.
- The active indicator (the small rail beside the active row) now carries a shared `layoutId`
  (via `motion`), so it slides between rows instead of jumping.
- Group open/close is now an animated height (CSS `grid-template-rows: 0fr → 1fr`, no JS
  measurement needed), not an instant show/hide.
- **Collapsed rail rebuilt.** It used to flatten every group's children into bare icons — about
  40 near-identical icons in one column with only thin dividers between groups (Phase 0 finding,
  corrected from my earlier "flyout" wording after re-reading the actual code). Now collapsed
  mode shows **one icon per group** (Radix Popover, already a dependency — no new one added);
  clicking it opens a small flyout listing that group's children by label, closing on selection.

**Instant loading states** (Phase 0 finding X1 — "clicks feel dead")
- Confirmed first that `loading.tsx` **cascades** to nested routes in this Next version, so the
  10 pre-existing ones already covered more than the raw file-count audit implied (e.g.
  `demand/loading.tsx` already covered `/demand/new`, `/demand/[id]`, `/demand/[id]/mobilise`,
  etc. — I'd undercounted this in Phase 0). Added the **17 still-missing top-level** ones
  (`accommodation`, `audit-log`, `banks`, `brand`, `companies`, `dashboards`, `history`,
  `inventory`, `letter-templates`, `lookups`, `operations/nocs`, `settings`, `sites`,
  `timesheets`, `transport`, `trades`, `upload`), each shaped to its content (table-skeleton for
  lists, a KPI-row skeleton for the 8 module dashboards, a form-skeleton for settings). A script
  confirms every `page.tsx` in the app now has a `loading.tsx` somewhere in its ancestor chain —
  zero routes left on the generic root fallback.
- `ProgressBar` (shipped in Phase 1) is now mounted in the shell and fires on real navigation.

**⌘K command palette** (`CommandPalette.tsx`, replaces `GlobalSearch.tsx`)
- Was an inline search box with no static content — only ever showed employee/project/client/
  document matches, and only after 2 characters. Rebuilt on `cmdk` (already an installed
  dependency, previously unused) as a real modal palette with four groups:
  - **Actions** — the app's core "create" shortcuts (Add employee, Raise demand, Check in, New
    timesheet entry, Generate invoice, Issue NOC, + 4 more), named directly in the redesign
    brief.
  - **Pages** — every sidebar destination, generated from the same nav data the sidebar itself
    uses (`getNavPages`), so it can't drift out of sync.
  - **Recent** — last 8 pages visited, stored in `localStorage` (a per-browser convenience,
    read back only to render this list — nothing depends on it persisting).
  - **Records** — the existing employee/project/client/document search API, behaviourally
    unchanged. Widening it to suppliers/demands/camps/invoices was flagged as a decision in the
    Phase 0 audit and hasn't been answered yet, so I left the API alone.
  - The header search box is now a button that opens the palette (⌘K still works from
    anywhere), rather than an input growing a dropdown under one corner of the header.

**`?` shortcuts sheet** (`ShortcutsSheet.tsx`)
- Press `?` anywhere outside a text field. Small on purpose — ⌘K, `?` and Esc are the only real
  shortcuts that exist right now; I didn't pad it with aspirational ones.

**Root 404** (`src/app/not-found.tsx`)
- A URL matching *no* route at all (not even inside the authenticated shell) previously fell
  through to Next's bare unstyled default — Phase 0 finding X14. This only renders for a URL
  with zero matching route anywhere, so by the time it's reached, `proxy.ts` has already let the
  request through (i.e. the visitor is signed in) — I could not actually screenshot it rendering
  in this session, because without a session `/this-route-does-not-exist` redirects to `/login`
  before Next even gets to decide there's no matching page, which I confirmed live rather than
  assuming. Verified by `tsc`/`build` only.

## Deferred (flagging, not doing silently)

- **View Transitions** — the Phase 0 audit recommended adopting them narrowly for list→detail
  and route crossfades. I did not turn on `experimental.viewTransition` this phase: it's still
  labelled experimental, and I have no way to visually verify an authenticated route transition
  in this session (see Verification below), so shipping it unverified felt like the wrong
  trade-off. Proposing it for Phase 3 or 4, once there's a page worth crossfading into.
- **Mobile bottom nav** — the audit proposed one; I focused this phase's mobile budget on the
  sidebar/palette/loading-state fixes above instead, since none of those are mobile-specific
  regressions today. Still on the Phase 2 checklist in the audit; carrying it forward rather
  than doing it partially.
- **Breadcrumbs in the header** — `PageHeader` already supports them per-page; making the header
  itself derive them generically is Phase 5/6 work once more pages carry real record names to
  show.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — 18 problems (9 errors, 9 warnings), identical to the Phase 1 baseline, none in
  files this phase touched. Building `CommandPalette` and the sidebar surfaced the same class of
  React Compiler lint rule as Phase 1 (no synchronous `setState` in an effect body) three more
  times; fixed the same way — moving the state update into the actual event-handler callback
  (the ⌘K keydown listener, the palette's open button, the search input's own change handler)
  instead of an effect reacting to a dependency.
- `npm run build` — clean, all 68 `(app)` routes plus `/login` and the new root 404 build
  successfully.
- **Manually verified, live, on `/login` (public — no credentials needed):** the logo and
  illustration now load (`200` instead of `307` — confirmed via the network tab, not just
  visually), at both mobile and desktop width.
- **Could not verify live:** the sidebar (single-active fix, animated rail, collapsed flyouts),
  the command palette, the shortcuts sheet, or any of the 17 new loading states — all of these
  only render inside the authenticated shell, and this environment has no working login
  credentials (per the standing workflow note). I verified the sidebar's core logic fix with a
  standalone script reproducing every conflict case from the audit (see above) rather than
  skipping verification entirely, but the actual rendered result — spacing, the Popover flyout,
  the rail animation — is unseen by me this phase.

## What I'd really like you to check

Everything in this phase lives behind login, so please look at all of it once you're signed in:

1. Click through a few of the exact conflict cases from the audit — Client Timesheet, Employee
   Renewals, Transport → Routes, Settings → Data Reset — and confirm only one sidebar row is
   highlighted each time.
2. Collapse the sidebar and click a group icon — does the flyout feel right, and does the app
   still make sense with 9 near-identical-looking group icons (even one-per-group, that's still
   a lot at a glance)?
3. Try ⌘K: browse Actions and Pages, run a records search, and visit a page or two to see them
   show up under Recent next time you open it.
4. Press `?` for the shortcuts sheet.
5. Watch the thin progress bar under the header, and the tailored loading skeletons, on a slow
   navigation (throttle your network if it's too fast to catch on your machine).
6. `/login` itself, signed out — logo and illustration should both be visible now.

Stopping here per the phase plan for your review before Phase 3 (dashboards).
