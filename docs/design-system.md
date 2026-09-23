# Design system

_Living reference for the redesign — 23 Sept 2026. See `/brand` (behind login)
for a rendered version of the tokens and motion kit._

## Tokens (`src/app/globals.css`)

All colour lives in CSS custom properties on `:root`, with a second value set
for dark mode — automatic via `@media (prefers-color-scheme: dark)`, or
forced via `:root[data-theme="dark"]` / `:root[data-theme="light"]` (set by
`ThemeToggle`, read server-side from a cookie so there's no flash). **Never
hard-code a hex value or a raw Tailwind colour utility (`red-700`,
`blue-50`…) in new code** — reach for the semantic token or its Tailwind
alias instead, so it survives the theme switch:

| Semantic token | Tailwind alias | Use for |
|---|---|---|
| `--canvas` | `bg-canvas` | Page background, behind cards |
| `--surface` / `-subtle` / `-hover` / `-sunken` | `bg-surface`, `bg-surface-subtle`, `bg-surface-hover`, `bg-surface-sunken` | Cards, table headers, hover states, wells |
| `--border` / `-strong` | `border-default`, `border-strong` | Hairlines, input borders |
| `--text` / `-secondary` / `-muted` / `-subtle` | `text-primary`, `text-secondary`, `text-muted`, `text-subtle` | Copy hierarchy — see contrast note below |
| `--brand-primary` (+ `-hover`/`-active`/`-soft`/`-border`) | `text-brand`, `bg-brand-soft`, … | Primary actions, active nav, focus rings |
| `--success` / `--warning` / `--error` / `--info` (+ `-soft`/`-border` each) | `text-[var(--success)]`, `bg-[var(--success-soft)]`, … | Status only — never decorative |

**Contrast:** `--text-subtle` was `#98a2b3` (2.6:1 on white — fails AA) and
was corrected to `#667085` (4.6:1, same as `--text-muted`) in Phase 1. It's
used for employee IDs, timestamps and placeholders — text people actually
read, not truly decorative meta.

**Radius scale:** controls 8px (`rounded-control`), cards 10px
(`rounded-card`), overlays 14px (`--radius-xl`). Nothing rounder — this was
an explicit product decision (the old `rounded-3xl` look was removed on
purpose) and holds everywhere **except `/login`**, which uses a
deliberately larger, marketing-style radius (`rounded-tl-[300px]` on the
sign-in panel, pill inputs) confined to `src/app/login/*` and documented
inline in `globals.css` under the "Login" section — don't copy that pattern
elsewhere.

**Type scale:** `--text-xs` … `--text-2xl` plus `.text-page-title` /
`.text-card-title` / `.text-kpi` utility classes. These are **additive** —
existing Tailwind `text-xs`/`text-sm`/`text-base`/etc. utilities (used at
~800 call sites) were deliberately left unmapped to this scale rather than
remapped underneath them, since that was too high-risk to do blind. New
screens should reach for the new classes; don't assume `text-sm` means
`var(--text-sm)` anywhere in the existing codebase.

**Motion tokens:** `--ease`, `--spring`, `--duration-fast` (120ms),
`--duration` (160ms), `--duration-slow` (320ms) in CSS; mirrored in
`src/lib/motion.ts` (`EASE`, `SPRING`, `DURATION*`) for `motion` components,
so a CSS transition and a `motion` animation on adjacent elements settle in
step.

## Motion kit (`src/components/motion/`)

Built on `motion` (Framer Motion's current package, imported from
`motion/react`), wrapped once in `MotionProvider` (root layout) with
`LazyMotion(domMax)` + `MotionConfig(reducedMotion="user")`. **Use `domMax`,
not `domAnimation`** — this was wrong for a few phases (see the Phase 3
changelog): `domAnimation` doesn't include the `layout` feature, so any
`layoutId` shared-element transition (the sidebar's active rail, every
`AnimatedTabs`-style underline) silently does nothing under it. `domMax`
also pulls in `drag`/`pan` (unused), but there's no smaller bundle with
layout-but-not-drag, and it's lazy-loaded regardless.

Every animation automatically respects `prefers-reduced-motion` via
`MotionConfig` — components don't need their own media-query check.

| Component | Use for |
|---|---|
| `FadeIn` | A card/panel/section that mounts once |
| `Stagger` / `StaggerItem` | A short list revealing together (≤ ~30 items — table rows don't qualify) |
| `AnimatedNumber` | Count-up for a KPI value. **`StatTile` already does this internally** for any numeric or `"NN%"` value — most call sites don't need to reach for `AnimatedNumber` directly |
| `Presence` | Re-export of `AnimatePresence` — wrap a list whose items mount/unmount (a bulk-action bar, a filtered-out row) so exits animate |
| `SlideOver` | Right-anchored panel (record detail without leaving the list) |
| `AnimatedTabs` | Radix Tabs + a shared-`layoutId` sliding underline. For a page with its own tab-switching logic already built (most detail pages), the pattern is inlined directly — see `supplier-tabs.tsx` / `project-tabs.tsx` for the ~15-line shape to copy, rather than forcing the page onto `AnimatedTabs`' own content-rendering contract |
| `Stepper` / `StepPanel` | Numbered step row + slide transition for multi-step forms |
| `ProgressBar` | Top-of-page route-change indicator, mounted once in the shell |

## Primitives (`src/components/ui/`, `src/components/`)

Reach for these before hand-rolling: `Button` (5 variants incl. `dangerGhost`
for row-level deletes — reserve solid `danger` for page-level, rare
actions), `Input`/`Textarea`/`InputWithIcon`, `Select`, `Combobox`,
`DatePicker`, `Checkbox`, `Switch`, `RadioGroup`/`SegmentedControl`,
`Slider`, `NumberInput`, `PhoneInput`, `CountrySelect`, `Dialog` (+
`DialogContent`/`DialogFooter`), `ConfirmDialog` (typed-confirmation
destructive actions — replaces `window.confirm`, which should never appear
in this codebase again), `Tooltip` (Radix-based since Phase 1 — portals
correctly out of `overflow-x-auto` tables, which the old CSS-only version
didn't), `FileDrop` (drag-and-drop, added Phase 1), `Toast`
(`useToastActions()`), `CsvImportDialog`.

Shared page-level pieces: `PageHeader`, `EmptyState` (what happened → why it
matters → what next), `Skeleton` + `TableSkeleton`/`StatTileSkeleton`/
`FormSkeleton`, `StatTile` (KPI tile — animates its own value), `Badge`,
`DataTable` (table of record — sorting, quick filter, column visibility,
row selection with an animated bulk-action bar since Phase 4, CSV
import/export, pagination), `FormSaveBar` (sticky save footer — **only
shows when the form is actually dirty/pending/saved/errored**, since
Phase 5; don't reintroduce an always-visible save bar).

## Dark mode

Any component built purely from semantic tokens (the whole primitive
library above) works in dark mode automatically — no per-component dark:
styling needed. Screens still using raw Tailwind colour utilities
(`red-700`, `blue-50`, `emerald-100`…) will render wrong in dark until
they're moved onto tokens; that's tracked, ongoing debt from before this
redesign, not a regression from it. **Never use Tailwind's `dark:` variant**
— it only reads the OS media query, not the `data-theme` override
`ThemeToggle` sets, so it would silently ignore a user's explicit choice.
Use the CSS custom properties (which already branch on both) instead.

## Known, deliberately deferred

These were considered and explicitly not done — see the individual phase
changelogs (`docs/redesign-phase*-changelog.md`) for the reasoning:

- **View Transitions** (`experimental.viewTransition`) — recommended for a
  narrow role (route crossfade + list→detail shared-element morphs) but
  never enabled; still experimental, and impossible to verify without a
  browser session against an authenticated route in this environment.
- **The full `DataTable` rollout** across ~34 remaining hand-rolled tables,
  and most module-specific form/flow rewrites (employee wizard step count,
  timesheet grid keyboard nav/fill-down, demand pipeline restructuring,
  check-in as a single Stepper, etc.) — these touch real create/edit/delete
  server-action logic with no way to click through the result afterward in
  this environment. Recommended to do incrementally, module by module, with
  live verification between each one.
- **Mobile bottom nav**, **breadcrumbs derived generically in the header**,
  **weekend-aware attendance colouring** (no existing working-day
  convention to build on — it's per-project), **row-level table
  mount/exit animation**, **illustrated empty states** (`EmptyState` has
  the icon slot; nothing beyond a Lucide icon was added).

## What to verify before trusting any of this rendered correctly

Every phase from 2 onward was built and reasoned about **without ever
being seen rendered in this environment** — there are no working login
credentials here, and most of the app lives behind auth. Everything passed
`tsc --noEmit`, `npm run lint` (holding at the same 18 pre-existing,
unrelated problems throughout — none introduced by this redesign), and
`npm run build` after every change, and Phase 0/1/2's login-page and public-
route work was the only part actually confirmed live in a browser. Treat
that gap as real: click through this yourself, particularly the sidebar,
command palette, dashboards, and the timesheet grid's sticky header/column
before trusting them in front of anyone else.
