# Phase 1 — Foundations

_23 Sept 2026_

## What shipped

**Tokens** (`src/app/globals.css`)
- **Dark mode.** Full second value set for every neutral/brand/semantic/shadow token, applied
  two ways: automatically via `@media (prefers-color-scheme: dark)`, and as an explicit
  override via `:root[data-theme="dark"]` / `:root[data-theme="light"]` (so a user choice beats
  the OS setting). No markup changed — every screen that already used the semantic tokens
  (`bg-surface`, `text-muted`, `border-default`, …) is dark-mode-ready for free. Screens still
  using raw `red-700`/`blue-50`/etc. classes (X5 from the audit) will look wrong in dark until
  Phase 4/5 move them onto tokens — that's expected, not a regression.
- **Contrast fix:** `--text-subtle` was `#98a2b3` (2.6:1 on white — fails AA) and is now
  `#667085` (4.6:1), same value as `--text-muted`. This is the colour used for employee ID
  numbers, timestamps and placeholders, which people actually read. Flagged in the audit as a
  Phase 7 item; fixed now since it's a one-line token change with no markup risk.
- **Type scale:** `--text-xs` … `--text-2xl` plus `--leading-tight`/`--leading-normal`, exposed
  as opt-in utility classes (`.text-page-title`, `.text-card-title`, `.text-kpi`). Deliberately
  **not** mapped onto Tailwind's own `text-xs`/`text-sm`/etc. utilities — those are used at
  ~800 existing call sites and remapping the scale under them was too high-risk for a
  foundations phase with nothing rendered yet to check it against. New/redesigned screens
  reach for the new classes or `var(--text-*)` directly.
- **Motion tokens:** `--spring`, `--duration-slow` added alongside the existing `--ease`/
  `--duration-fast`/`--duration`, mirrored in `src/lib/motion.ts` for `motion` animations.
- Three hard-coded colours in `globals.css` itself (skeleton shimmer, scrollbar thumb) swapped
  for tokens so they follow dark mode instead of staying light-only.

**Motion kit** (`src/components/motion/`)
- Installed `motion` (~20 kB gzipped for the `domAnimation` feature set actually used).
- `MotionProvider` — `LazyMotion(domAnimation)` + `MotionConfig(reducedMotion="user")`, mounted
  once in the root layout so every `m.*` animation automatically no-ops under
  prefers-reduced-motion without each component checking for it.
- `FadeIn`, `Stagger`/`StaggerItem`, `AnimatedNumber` (tabular count-up), `Presence`
  (re-exported `AnimatePresence`), `SlideOver` (right-anchored panel, Radix Dialog + forceMount
  for a real exit animation), `AnimatedTabs` (Radix Tabs + a shared-`layoutId` sliding
  underline), `Stepper`/`StepPanel`, `ProgressBar` (top-of-page route-change bar).
- `ProgressBar` is now mounted in the shell (`(app)/layout.tsx`, wrapped in `<Suspense>` for
  `useSearchParams`) — starts on `pointerdown` of any internal link, before the click even
  resolves, and finishes when the route commits. Direct answer to the audit's #1 finding
  (0.75–2.7s TTFB with only 13/76 routes having a `loading.tsx`).

**Primitives**
- `Tooltip` rewritten on `@radix-ui/react-tooltip` (added, ~6 kB) — same call signature as
  before, so no call sites changed. Fixes the audit's finding that the CSS-only version got
  clipped inside `overflow-x-auto` tables and couldn't flip near a viewport edge.
- `AnimatedTabs` doubles as the new Tabs primitive (`@radix-ui/react-tabs`, added, ~3 kB) —
  roving-tabindex keyboard nav and correct ARIA, which the app's several hand-rolled tab rows
  don't have today. Adopting it on those pages is Phase 5/6 work.
- New `FileDrop` (`src/components/ui/FileDrop.tsx`) — drag-and-drop + click-to-browse, click
  and Enter/Space both work, generalizes the pattern already hand-rolled in
  `upload/upload-form.tsx` so other document-upload surfaces can share it.
- `EmptyState` and `Skeleton` (+ `TableSkeleton`/`StatTileSkeleton`/`FormSkeleton`) were already
  solid from the August pass — no changes needed.
- `Dialog`, `Button`, `Badge`, `Checkbox`, `Switch`, `Select`, `DatePicker`, `NumberInput`,
  `Slider`, `RadioGroup`, `Combobox` were already token-based and needed no code changes to
  work in dark mode — verified via the token flip, not by touching them.

**Dark mode toggle**
- `ThemeToggle` (light/dark/system, 3-way) added to the `UserMenu` popover.
- Same cookie pattern as the existing sidebar-collapse preference
  (`src/lib/theme-preference.ts`, mirroring `(app)/sidebar-preference.ts`): read server-side in
  both root layouts and threaded down as a prop, so the first paint already matches — no flash,
  no client mount effect.

## Decisions made while building (flagging, not asking)

- **No dependency added for the login background yet.** The audit recommended a CSS-only React
  Bits effect over Silk's ~150 kB WebGL cost; that choice is made when the login page itself is
  rebuilt in Phase 2, not here.
- **View Transitions** (`experimental.viewTransition`) not turned on in this phase — it's a
  Phase 2 (shell/navigation) decision, tokens/primitives don't need it.
- **`/brand` restructured**: the existing before/after page (client component) now has a thin
  server wrapper (`page.tsx`) that reads the theme cookie and passes it to a new
  `brand-client.tsx`, so the theme toggle there doesn't flash on load either. Content-wise nine
  new sections were added (colour tokens, type scale, motion kit, FileDrop/Tooltip/EmptyState)
  above the existing Switch/Slider/NumberInput/DatePicker before/after — nothing removed.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — 18 problems (9 errors, 9 warnings), all pre-existing in files this phase
  didn't touch (confirmed by diffing against the pre-Phase-1 baseline, which already had 22).
  Three new lint errors surfaced while building `ThemeToggle` and `ProgressBar` (two React
  Compiler rules: no synchronous `setState` in an effect body, no mutating
  `document`/`document.cookie` from inside what the compiler treats as a nested render
  callback) — both fixed by restructuring rather than suppressing: `ThemeToggle`'s cookie write
  moved into a plain module-level helper function, and `brand-client.tsx`'s reduced-motion
  check now uses `motion`'s own `useReducedMotion()` (which subscribes safely internally)
  instead of a hand-rolled `matchMedia` effect.
- `npm run build` — clean, all 68 `(app)` routes plus `/login` build successfully.
- Manual check: `/login` (public, so reachable without credentials) rendered with no console
  errors in both light and OS-dark emulation, confirming the token flip actually reaches the
  page (canvas measured at `rgb(11, 13, 18)` under dark). `/brand` and the rest of the
  authenticated app could not be exercised in the browser this session — no login credentials
  available in this environment (see the workflow memory) — so those primitives are verified by
  `tsc`/`build` passing plus code review, not by a rendered screenshot. **Please open `/brand`
  yourself and toggle the theme switch in the account menu** — that's the fastest way to see
  everything in this phase in one place.

## What I'd like you to check

1. `/brand` in light, dark and system — colour tokens, type scale, and the four motion demos
   (AnimatedNumber, AnimatedTabs, Stepper, SlideOver).
2. The theme switch in the account menu (top-right) — does it feel right as light/dark/system,
   and does it stick across a reload?
3. Click around the app and watch for the new thin blue progress bar under the header on
   navigation — it should appear near-instantly and never overstay past when the page is ready.
4. Any screen with `red-*`/`blue-*` hard-coded colours will look off in dark mode until later
   phases move it onto tokens — expected, not a bug, but flag anything that looks actually
   broken (unreadable text, invisible borders) rather than just "off-brand".

Stopping here per the phase plan for your review before Phase 2 (login + shell).
