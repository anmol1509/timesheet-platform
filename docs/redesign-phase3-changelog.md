# Phase 3 — Dashboards

_23 Sept 2026_

## A correction from Phase 1/2 first

While wiring the Customize dialog's reorder animation (below), I found that
`MotionProvider` was loading `domAnimation` — the smaller of `motion`'s two
built-in feature bundles — which **does not include the `layout` feature**.
The sidebar's active-item rail and `AnimatedTabs`' sliding underline (both
Phase 2) use `layoutId` shared-layout transitions, which need it. Without it,
`motion` doesn't error — it just silently skips the animation, so those two
have been rendering in the right place with no slide since Phase 1/2 shipped.
Switched to `domMax` (`src/components/motion/MotionProvider.tsx`), which adds
`layout` (plus `drag`/`pan`, unused here — there's no smaller pre-built
bundle with layout but not drag). Still lazy-loaded, so no first-paint cost.

## What shipped

- **Count-up KPIs everywhere for free.** `StatTile` (the one shared KPI
  component behind the main dashboard *and* all 8 module dashboards) now
  animates any numeric or `"NN%"` value with `AnimatedNumber` internally —
  one change in `src/components/StatTile.tsx` reaches every KPI tile in the
  app without touching a single call site.
- **Staggered panel reveal.** Main dashboard: the whole widget list (KPI
  strip, charts, panels — whatever order/visibility the user's saved) is
  wrapped in `Stagger`/`StaggerItem`. All 8 module dashboards: their KPI row
  specifically (4 tiles, staggered ~30ms apart) — done via a script since all
  8 share the exact same `<div className="grid grid-cols-1 gap-4 sm:grid-cols-2
  lg:grid-cols-4">` shape, verified against `tsc` afterward rather than by
  eyeballing each of the 8 files individually.
- **Charts draw in once on mount** instead of appearing fully-formed:
  `WeeklyHoursChart`, `HoursSplitChart` (bar height 0→target,
  `cubic-bezier(0.16,1,0.3,1)`, slight per-bar stagger) and
  `TimesheetPipelineChart` (horizontal bars, width 0→target). All three
  became client components to do this (they were server components before);
  no props or data-fetching changed.
- **Animated Customize reorder** (`(app)/customize-dashboard.tsx`): the
  widget list is now `m.li` with `layout`, so ↑/↓ moves a row to its new
  position with a FLIP transition instead of an instant jump — this is what
  actually surfaced the `domMax` bug above, since it visibly didn't animate
  until the fix.

## Deferred (flagging, not doing silently)

- **Skeleton→content crossfade.** The `loading.tsx` → real-content swap is a
  hard React tree replacement (Suspense boundary resolving), not something
  CSS/`motion` can crossfade without either View Transitions (still deferred
  from Phase 2 — experimental, unverifiable here) or a manual
  measure-and-fade technique I didn't think was worth the complexity for a
  swap that's usually sub-second already after Phase 2's loading states.
- **The dashboard "Hours — normal vs overtime" shows 40h with every bar
  empty** — this is a Phase 0-flagged data/query bug, not a UI one. I didn't
  touch it. Animating an empty chart doesn't fix the emptiness.
- **Pie/donut charts** (`WorkforcePie`, camp occupancy ring) weren't given a
  draw-in animation this pass — bar/line charts were the highest-traffic
  ones (they're on the main dashboard), and I wanted to keep this phase to a
  size I could actually verify against `tsc`/`build` rather than spreading
  thinner across every chart component.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — 18 problems, identical to the Phase 1/2 baseline, none in
  files this phase touched.
- `npm run build` — clean, all routes build (including all 8 dashboard
  pages and the main dashboard).
- **Could not verify live.** Every dashboard is behind login, and this
  environment still has no working credentials. The KPI-row transform across
  the 8 module dashboards was applied by a script (not by hand per file) and
  checked with `assert` statements requiring exactly 4 `StatTile` matches per
  file plus a clean `tsc` pass afterward — but none of it has been seen
  rendered. Please open the main dashboard and a couple of module dashboards,
  toggle Customize and reorder something, and watch the KPI tiles count up
  on load.

Continuing to Phase 4 (DataTable + lists) — see that changelog for how I'm
scoping it, since 42 hand-rolled tables can't all be rebuilt to the same
depth in one pass.
