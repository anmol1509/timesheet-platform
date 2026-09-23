# Redesign audit — Phase 0

_23 Sept 2026 · live site `timesheet-platform-theta.vercel.app` · read-only (nothing submitted)_

## How this was done

- **Every route in `src/app/(app)` + `/login` + an unknown URL (68 routes)** was loaded in a
  same-origin iframe at exactly **1440×900, 768×1024 and 375×812**, and measured: horizontal
  overflow, layout shift (CLS), unlabelled fields, unnamed buttons, tap targets < 32px at 375,
  native `<input type=date>`/`<select>` counts, broken images. Results are in
  [Appendix A](#appendix-a--measured-sweep).
  I used iframes because the browser pane kept resizing and clearing any emulated viewport.
- **Every module was screenshotted at 1440**, key screens at 375 and 768, and dialogs/flows
  were opened without submitting. The screenshots were taken inside the review session and
  are not saved to the repo. The pane has no save-to-disk path. Phase 5's before/after sets
  will be committed as files (see "Screenshots" at the end).
- **Dark mode:** emulating `prefers-color-scheme: dark` changes nothing. There is **no dark
  mode**: zero `dark:` classes and zero colour-scheme media queries. Everything below is "light
  only". Dark is net-new work in Phase 1, not a restyle.
- **Code read:** `globals.css`, the shell, all primitives, every flow component.
- **Timing:** server TTFB and time-to-hydrated measured for the heaviest routes.

Data is thin (6 employees, 4 demands, 1 camp, 0 invoices/NOCs/quotations/vehicles), so empty
states are over-represented and density problems under-represented. I judged tables for
a realistic 200–2,000 rows.

---

## Cross-cutting findings (these matter more than any single screen)

| # | Finding | Evidence |
|---|---|---|
| X1 | **Clicks feel dead.** TTFB is 0.75–2.7 s on every navigation. Only 13 of 76 routes have a `loading.tsx`, so on the other ~60 the old page just sits there after a click. There is no route progress indicator. | `/attendance` TTFB 2.66 s, `/employees/[id]` full load 8.4 s; `find src/app -name loading.tsx` → 13 |
| X2 | **~1 s hydration gap** after content paints: buttons are visible but not interactive (my first Customize click did nothing). | `/demand` content 1.05 s → hydrated 2.04 s; `/attendance` 6.5 s → 7.5 s |
| X3 | **Sidebar highlights two items at once.** `isActive` is prefix-based and has no "longest match wins" rule. | `/employees/renewals` → Employees + Renewals; `/invoices/client-timesheet` → Client Timesheet **and** Billing › Invoices (the group opens too); `/transport/routes/new` → Transport + Routes; `/settings/data-reset` → Data Reset + Settings |
| X4 | **No dark mode.** | see method |
| X5 | **Design-system adoption is shallow.** 60/76 pages hand-roll their title instead of `PageHeader`; about 42 table components bypass `DataTable`; about 350 raw palette classes (`red-700`, `blue-50`…); 68 hex values in TSX; 69 `rounded-xl/2xl/3xl/full`; `<Button>` used in only 8 files. | greps in the session |
| X6 | **Feedback layer is thin.** Toasts are used in 3 files. Most mutations report via inline `<p>` text or not at all. `useFormStatus` is used nowhere, and pending states are ad hoc. | |
| X7 | **Destructive actions are ever-present.** Red "Delete" text links on every row of Trades, Documents, Projects, Clients, Suppliers, Letter Templates, Inventory, Camps rooms. A red Delete button sits beside the page title on Project, Client, Supplier, Inventory and Demand detail. `window.confirm` is still used in `clients/delete-clients-button.tsx`. | screenshots |
| X8 | **Dates:** 55 native `<input type=date>` render `dd/mm/yyyy` chrome that differs per browser, although a shared `DatePicker` exists. The employee detail page alone has 20. | sweep |
| X9 | **Labels:** 176 `<label>` elements without `htmlFor`. Several are wrapping labels, but the sweep found real unlabelled fields: Client Timesheet grid (60), New Timesheet Entry (36), Camps (8), Settings (6), Quotation/new (5), Routes/new (3), Audit Log (3), Trades (2), Project detail (2). Unnamed icon buttons: Clients (5), Suppliers (5), NOC/new (7), Check-In (7). | sweep |
| X10 | **Mobile is "desktop, narrower".** Tap targets under 32px: Trades 46, Camps 43, Employees 20, Employees/new 12, Check-In 10. Tables never collapse to cards. Toolbars wrap into 3–4 rows before the first record. Real page overflow at 375 on 3 routes: dashboard header (+20px), Client Timesheet (+76px), Client detail (+57px). | sweep |
| X11 | **Search is records-only.** ⌘K focuses an inline search box that is not a palette. It searches employees, projects, clients and documents only. "camp", "invoice", supplier names, demand numbers and pages return nothing. No actions, no recents, no keyboard help. | `/api/search?q=camp` → all empty |
| X12 | **"Go"-button filters.** Client Timesheet, Invoices and Generate Sheets make you change a select and then press Go. Filters should apply on change and live in the URL. | |
| X13 | **Motion is nearly absent**, which is fine, but so is state feedback. Rows appear and disappear with no transition, bulk-action bars pop in, and there are no count-up or skeleton-to-content crossfades. CLS is 0 everywhere, which is a good baseline to protect. | sweep: cls 0 on all routes |
| X14 | **The unknown-URL 404 is Next's unstyled default** (black "404 \| This page could not be found", no shell). `(app)/not-found.tsx` only catches `notFound()` inside the segment, and there is no `app/not-found.tsx`. | screenshot |
| X15 | **Brand images are broken on /login.** `src/proxy.ts` `PUBLIC_PATHS = ["/login"]`, and the matcher doesn't exclude `/brand/*`, so `/brand/*.svg` 307→`/login` when signed out. `/brand` (the component gallery) also now needs login, although it used to be public. | `curl -I …/brand/burj-al-aweer-mark.svg` → 307 |

---

## Login (`/login`)

**Now:** 480px form column + illustration panel (panel hidden < lg). Email, password,
"Remember Me", Log In, footer copyright.

Issues
- Logo and illustration **broken** (X15). The company's first impression is two broken-image icons.
- No show/hide password, no caps-lock hint, no `autoFocus` on email.
- Error is a raw `bg-red-50 text-red-700` block with no icon and no `role="alert"`, so it isn't announced.
- Button label swaps "Log In" → "Logging in…" and the width jumps. No spinner.
- There's no hand-off into the app: a hard redirect straight into a 2–3 s dashboard load with no feedback.
- Wordmark colour is hard-coded `#1E2A6E`.

Proposed
- Two-panel layout: left brand panel with a subtle animated background (React Bits
  **Silk** or **Grid Motion**, lazy-loaded, **static gradient** under reduced motion and < 768px),
  a SplitText headline, and the company mark. Right: form.
- Show/hide eye toggle, caps-lock hint, email `autoFocus`, `role=alert` error with shake
  (≤ 200ms, reduced-motion safe), and a spinner inside a fixed-width button.
- On success: the form fades, the brand mark scales into the sidebar logo position (View
  Transition name `brand-mark`), and the dashboard skeleton shows immediately.

## Shell

Sidebar (9 groups + Administration/Settings), BranchSwitcher, search, notifications, user menu, mobile drawer.

Issues
- X3 double-active items. The active indicator is a static bar that jumps between items.
- Groups open and close instantly, with no height animation. Collapsed (56px), every group flattens into its children as bare icons, about 40 near-identical icons in one column with only thin dividers between groups. You find items by hovering for tooltips.
- BranchSwitcher is a native `<select>` (the only `select` on most pages).
  **"All branches" silently blocks creates**: Add Employee, Add Supplier and supplier edit show a yellow warning banner telling you to go use the switcher. It should be an inline "Pick a branch" control inside the banner.
- No breadcrumbs in the header. Pages have a mix of "← Back" links and PageHeader crumbs.
- Mobile: the drawer works, but there's no bottom nav, search collapses to a small box, and branch switcher is hidden at < sm.
- No `?` shortcut sheet, and no keyboard shortcuts besides ⌘K.
- 404/500 inside the shell are fine but generic (FileQuestion icon, "Browse employees" is the only suggestion).

Proposed
- Single-active matching (longest href wins). Animated active pill (`layoutId`). Smooth group
  collapse (height auto, 200ms). When collapsed, show one icon per **group** with a hover/focus
  flyout listing its children, instead of 40 bare icons.
- ⌘K becomes a real command palette: **Pages** (all 60 nav targets), **Actions** (Add employee,
  Raise demand, Check in, New timesheet entry, Generate invoice, Issue NOC…), **Records**
  (existing API) and **Recent** (last 8 visited, localStorage, per-viewer).
- `?` opens a shortcut sheet. `g e` / `g d` / `g t` go-to chords. `c` creates on list pages.
- Header breadcrumbs derived from the route plus an optional record name slot.
- Mobile: bottom nav (Dashboard · Workforce · Demand · Timesheets · More) and a full-height drawer for the rest.
- Top route progress bar (starts on `pointerdown` of any internal link, completes on commit)
  plus `loading.tsx` skeletons for **every** route (X1).
- Root `app/not-found.tsx` inside a lightweight shell. Error page shows the digest with a copy button.

## Dashboard (`/`) + 8 module dashboards

Issues
- Clean and calm already: the best screen in the app. KPI tiles, charts, a Needs attention queue.
- "Hours — normal vs overtime" shows **40h** in the header but every daily bar is empty. The
  bars and the total are computed from different sources, or the bars fail silently.
  **Needs a data check before restyling.**
- Module dashboards are reached by a tab row that duplicates the sidebar groups.
- 375: header actions overflow by 20px (Customize / Upload timesheet / Add employee in one row).
- Customize dialog: up/down chevrons are about 16px targets, reorder is instant (no animation),
  "Visible" toggles are text pills, and there's no "reset to default".
- No skeleton→content crossfade, no count-up, and no sparkline/trend on 3 of 4 KPIs.

Proposed: count-up KPIs (tabular), sparkline plus delta per KPI, charts draw in once per session,
staggered panel reveal (≤ 8 items, 30ms stagger), animated reorder in Customize (FLIP via
`layout`), header actions collapse into a "+ New" menu at < sm, and module-dashboard tabs
become `AnimatedTabs`.

## Workforce

### Employees list
- Two adjacent segmented controls (All/On work/Bench and All/Supplier/Our employees) read as one
  control. Merge them into filter chips with counts.
- Table scrolls horizontally at 1440 with 6 rows, and the last column ("Pro…"/status badge) is
  clipped. Too many default columns.
- Compliance shows "No records" for everyone, which is a **data gap** (see memory: empty
  columns). Render it as "—" with a tooltip rather than a grey pill on every row.
- "Import CSV" button is taller than the other toolbar buttons (inconsistent class).
- 375: filters, search, columns, import and export take about 60% of the first screen, and
  names are truncated.

### Add employee (`/employees/new`)
It is **already an 8-step wizard** with AI extraction from the document pack, which is good.
- Step bar wraps onto 2 lines at 1440 inside a narrow column.
- Redundant steps: "Trades & notes" **and** "Notes". Merge them into 7 steps.
- No completeness indicator for the whole record (document checklist is 0/4 only).
- No draft persistence: refresh loses everything, including uploaded-and-parsed documents.
  `beforeunload` warns, but that's all.
- "All branches" blocks saving, but the user only learns that from a banner (see Shell).
- Previous is shown disabled on step 1, and Next isn't sticky on long steps.

Proposed: `Stepper` with numbered/checked steps, a progress ring with % complete, keyboard
(`⌘↵` next, `⌘⇧↵` back), a sticky footer, a sessionStorage draft (fields only; files re-upload
with a clear notice), a review step with "edit" jump-links, and an animated step slide (160ms).

### Employee detail (`/employees/[id]`)
- The Overview tab **is** the edit form, and "Save changes" is pinned at the bottom even when
  nothing has changed. There's no read view, so it's easy to edit by accident.
- Header: status badges clip at < 400px. At 375 the tabs stack vertically as a list, and the page scrolls horizontally.
- 20 native date inputs. Slowest page in the app (8.4 s full load).
- Photo avatar sometimes renders empty at 1440 while the image loads (no placeholder).

Proposed: read-first detail with a summary header (photo, ID, status, deployment, compliance
chips) and a "Edit" toggle per section. FormSaveBar appears **only when dirty**, with Discard.
Document chips in the header become one-click upload targets. Work/accommodation/PPE history as an
activity timeline. Tabs scroll horizontally on mobile.

### Instant View / Renewals / Trades / Documents
- **Instant View:** blank until you pick someone. Offer recent employees and the most
  incomplete records. Print styles exist.
- **Renewals:** "1 **days** overdue" (plural bug). Runway pills are neutral grey, and only
  overdue gets colour. No row action ("Upload renewal", "Open employee").
  Proposed: urgency ramp (overdue/7/30/60/90 → error/warning/info/neutral), group by urgency,
  one-click upload.
- **Trades:** create form + list on one page, and a red **Delete** on every row, including
  trades with 5 employees. 46 tap targets < 32px at 375.
- **Documents:** "Valid documents 0 / Expiring 0" with 6 docs because no expiry was
  captured (data gap). Download/Delete text links.

## Projects

- **List:** lowercase status ("active", "completed"), empty Timeline "— — —", Edit/Delete red text per row.
- **New:** flat form, no required markers, 2 native dates, submit left-aligned below the fold.
- **Detail:** **10 tabs wrapping to 2 lines** (Basic Detail, Documents, Approved Rates, LPO,
  Holiday Details, Location Details, Sites, Other Details, Related Users, Inventory Details).
  Only header action is Delete. Six native dates. "Location Details" has no map.
  Proposed: summary header (client, manager, dates, staff count, sites) and grouped tabs
  (Overview · Commercial [rates, LPO] · Sites & location · People · Documents · Inventory).
  Location uses a static map preview (no new map dependency without asking).
- **Sites:** fine. Clear empty state.
- **NOCs list / new / detail:** list is empty. New: flat form, **7 unnamed icon buttons**, no
  preview of the merged letter. "Create NOC" is disabled with no reason given.
  Proposed: 3-step Stepper (Demand & template → Employees → Preview & create), with the PDF preview
  inline on the last step.

## Demand (core pipeline)

- The 4-stage cycle is **spread across 5 sibling pages** (View Demands, Mobilization, Site
  Arrival, Demobilisation, Generate Doc) that each list the same demands. No single demand
  shows "where am I in the cycle".
- **Create Demand:** decent. Project disables until a client is picked, and there's a trade rows
  editor. The Day/Night toggle is a two-button pair plus a "Remove" link that looks disabled.
- **View Demands:** status only ("Open"). No requested/approved/mobilised/on-site progress.
- **Demand detail:** hierarchy is upside down. The Remarks textarea and Save come **before**
  Trades. Approval is a tiny number input + Update per trade. Create NOC (primary) and Delete
  Request sit together top-right.
- **Mobilise:** trade list left, workers right. "0 / 2 mobilised" is a small pill. The empty
  state ("No idle worker holds Helper. Use Other trades…") is good copy.
- **Site Arrival / Demobilisation:** Approve/Disapprove as green/red text links per row. At
  1440 the Demobilisation table is cramped: "ON THE JOB" wraps onto 3 lines, company names onto
  3 lines. Filters are split across two cards.
- **Generate Doc:** fine list, but "Nobody yet" pills and a text-link Generate.

Proposed: a **pipeline header on every demand** (Stepper: Raised → Approved → Mobilised → On
site → Demobilised) with counts per stage that animate when workers move. The View Demands
list gets a stacked progress bar per demand. The stage pages keep their URLs but share one
`DemandStageTabs` (AnimatedTabs) with counts. Row moves animate out of one stage list
(`AnimatePresence`, ≤ 30 rows). Demand detail is reordered: pipeline → trades/allocation →
remarks.

## Facilities

- **Camps:** occupancy is shown **twice** (KPI tile 14% + a big donut card 14%). The room
  and bed map is good. Per-room "+ Beds" number input and a red Delete sit in each room card,
  with 8 unlabelled fields. 43 small targets at 375.
- **Create Check-In:** check-in to camp and bed allocation are **two different pages**. Check-in
  opens a non-modal dialog for camp only, then says "a bed isn't picked yet — that's the
  next step, Bed Allocation" (a separate nav item). 7 unnamed icon buttons.
  Proposed: one Stepper flow (Employees → Camp → Room & bed (visual map) → Review), with
  "skip bed for now" preserved. Bulk selection carries through.
- **Bed Allocation:** card grid of people with "Switch Room". Proposed: split view, with
  unallocated people on the left and a room/bed map on the right. Click a person, then a bed
  (keyboard accessible, not drag).
- **Transport / Routes / Inventory:** empty transport. Routes/new stops use tiny ↑/↓ with
  unlabelled inputs. Inventory detail has three stacked forms (details, variants, issuance)
  on one page, and Delete sits at the top-right.
- **`/accommodation`** is a redirect that paints an empty shell first.

## Timesheets

- **URL/IA problem:** Client Timesheet, Daily Entry, New and Sync live under `/invoices/*`,
  so the sidebar lights up Billing too (X3), and breadcrumbs say "Invoices".
- **Daily Attendance:** month calendar where **every unmarked day is red**, including future
  days (the 28 "Nothing marked" days scream error). Weekends aren't distinguished. The day
  editor is below the calendar ("Pick a day…"), so every day needs a scroll.
  Proposed: the calendar becomes a compact heat-strip, with neutral for future, muted for
  weekend/holiday, amber for draft, green for submitted, and red only for past working days
  that are unmarked. The selected day opens a side panel (SlideOver) with keyboard P/A/L/H/O
  hotkeys per row, and ↑/↓ moves between people.
- **Client Timesheet grid (the heaviest daily task):**
  - Day headers are weekday names only ("Tue Wed Thu…") with **no date number**.
  - No sticky employee column and no sticky header, so you lose who you're editing after scrolling.
  - Cell inputs have `outline-none`, **no aria-label**, and no keyboard navigation (no arrow
    keys, no Enter-down, no fill-down, no range select, no paste of a copied Excel row).
  - **Save is per row**, so a 30-worker month is 30 Save clicks. Row total doesn't update as
    you type. No column (day) totals.
  - Filters need the **Go** button (X12). The status pill "CLIENT APPROVED" wraps onto 2 lines.
  - Four bulk buttons are always visible and disabled.
  - At 375 the client select overflows the card.
  Proposed: spreadsheet ergonomics (see Phase 5 plan). Arrow/Tab/Enter navigation,
  shift-select ranges, ⌘D fill-down, paste TSV, sticky name + header, weekend/holiday shading,
  live row and column totals, dirty cells tinted with **one** "Save n changes" bar
  (client-side loop over the existing `saveRow` action, so no new server logic), and ⌘S to save.
- **Daily entry / New entry:** same grid problems. New Entry has `ID NO`, `Name`… inputs with
  placeholders only.
- **Attendance Sync:** "Everything agrees" empty state is good.
- **Upload:** a good drop zone, but past uploads aren't listed under it and there's no parse
  progress. `/upload/[id]` couldn't be audited with live data because there are no uploads.
- **Generate Sheets (`/companies`, `/companies/[id]/generate`):** Go button. Card grid for one
  company. The review page shows **Helper rate 0.00 → amount 0.00 with no warning** (the
  invoice page does warn, which is inconsistent). Download XLSX/PDF buttons have no
  progress state.
- **History:** fine table. "Reopen →" link.

## Business Partners

- **Clients list:** hand-rolled table (not DataTable). The "Avg basic rate: **Not set**" KPI tile
  is useless.
- **Client detail:** one 2,590px page. Document upload comes first, then a long company form,
  then contacts and trade rates. Delete is next to the title.
  Proposed: tabs (Overview · Contacts · Rates · Documents), with a read view first.
- **Suppliers list:** "All branches" banner blocks Add. Row actions are three icons + Edit +
  Delete.
- **Supplier detail:** a browser-tab-like strip (subsidiaries + "+") sits **above** the back link
  and title. A red Delete button sits directly under the title, above the tabs. The Documents tab is
  the default. The 3 approval statuses aren't visible in the header.
  Proposed: header with name, approval status stepper (3 states) and a subsidiary switcher as
  a dropdown. Tabs: Overview · Company · Contact & Payment · Documents. **Workmen Comp import
  becomes a Stepper**: Upload → Reading (progress) → Review table (editable, errors
  highlighted) → Create (result summary with links).
- **Banks:** empty (no data). List + detail are audited from code only.

## Sales

- Enquiries empty (good empty state copy). Quotations list is empty and hand-rolled.
- **Quotation new:** flat form. The line-item row is 6 **placeholder-only** inputs with no running
  total. There are no totals at all until the detail page.
  Proposed: line-item editor with labelled columns, live subtotal/VAT/total footer, add rows
  with Enter, and a PDF preview on the detail page.

## Billing

- **Invoices:** Go-button month picker. Card grid. "AED 0 / Margin: AED -55" in small red
  text is the only signal that rates are missing.
- **Invoice generate:** good warning banner about missing rates and a clear line-item table.
  But **"Issue invoice" is enabled with a total of AED 0.00**, next to two draft download
  buttons of equal weight.
  Proposed: a 3-step flow (Review → Issue → Download/Send) with a confirmation summary before
  issuing. Gating on zero total would be a **rule change, so I'm asking**
  ([Needs your decision](#needs-your-decision-dataquery-or-logic)).
- **Invoice History:** empty (no data).

## Settings & Administration

- **Settings:** one long page combining Billing entity, Branches and Team, with forms in side cards.
  Proposed: a left sub-nav (Company · Branches · Team · Preferences).
- **Lookups:** functional list.
- **Letter Templates:** a plain textarea. Placeholders sit in a collapsed `<details>`. **No
  preview.** Delete is a red link per row.
  Proposed: editor + live preview with sample data, click-to-insert merge fields, and unknown
  `{{FIELD}}` highlighted.
- **Audit Log:** the entity column shows **raw IDs** (`DEMAND_REQUEST · cmu83r8d…`) and
  SCREAMING_CASE types. "View changes" opens a diff.
  Proposed: human labels, a relative time with the exact time on hover, filter chips, and a
  side-by-side diff with changed keys only.
- **Data Reset:** already has a good "live database" banner, typed "RESET ALL" + acknowledgement,
  and per-module typed names. But the per-module **Reset** buttons are solid red on every card, so
  the page reads as a dashboard of red buttons.
  Proposed: secondary "Reset…" buttons. The danger styling moves into the confirmation step
  (count of records, per-branch scope, typed name, 3-second hold-to-confirm).
- **`/brand`:** today it's a before/after page for 4 primitives, not a gallery. Phase 1 rebuilds it.

---

## Top tasks — click counts today

"Click" = pointer action, not counting typing. n = number of workers.

| Task | Today | Pages visited | Target | How |
|---|---|---|---|---|
| Create employee (from list) | **12–14** (+2 if "All branches") | 1 (8 steps) | 8–9 | 7 steps, ⌘↵, inline branch pick, auto-advance after extraction |
| Raise demand → approve → mobilise → site arrival | **≈ 20 + 2n** | 5 | ≈ 12 + n | pipeline header links each stage, pre-selected demand, "Mobilise all idle matches" |
| Camp check-in (to a bed) | **≈ 7 + 4n** | 2 | ≈ 5 + 2n | single Stepper with a bed map |
| Fill a month's client timesheet (30 workers) | **30 row-saves + ≈ 26×30 cell edits** | 1 | 1 save + fill-down/paste | spreadsheet grid |
| Generate an invoice | **≈ 7 + n** (rate fixes elsewhere) | 2–3 | ≈ 5 | filter on change, inline rate fix, 3-step flow |
| Issue a NOC | **≈ 11 + n** | 2 | ≈ 7 + n | 3-step Stepper with preview, "select all allocated" |

---

## Accessibility summary

- Focus ring: the global rule is correct. The client timesheet cells add `outline-none` and I
  measured `outline-style: none` on a focused cell, so they need their own cell focus style.
- Unlabelled fields and unnamed buttons: see X9 and Appendix A.
- Error messages aren't `role=alert` (login, most forms). `aria-invalid` is used in only 7 places.
- Colour-only status: the attendance calendar (red/amber/green) has no text or shape for the
  state, apart from "2 marked" on marked days.
- Tables with row checkboxes have no `aria-label` per checkbox ("Select Ajay Kumar").
- Contrast to verify in Phase 7: `--text-subtle #98a2b3` on white is **2.6:1**. It's used for
  secondary IDs (e.g. "BAACCC002" beside names) that people actually read.

## Motion & View Transitions decision

- `motion` (`motion/react`): `LazyMotion` + `domAnimation` + `m.*`. See the dependency table below.
- **View Transitions:** Next 16.2 supports `experimental.viewTransition` with React's
  `<ViewTransition>`. Route navigations are transitions, so the animations fire automatically, and
  `<Link transitionTypes>` (added in v16.2) lets list→detail and back use directional variants.
  Browsers without support just navigate normally.
  **Recommendation:** adopt it **narrowly** in Phase 2. Crossfade the `<main>` content on route
  change (120ms), and use shared-name morphs only for list→detail titles and avatars (employee,
  demand, project). Keep in-page motion (tabs, lists, dialogs, steppers) on `motion`.
  Risk: it's still flagged experimental. It's a one-line config toggle to back out.

## Dependencies I'd add (asking before Phase 1)

| Package | Size (min+gz) | Why existing deps can't do it |
|---|---|---|
| `motion` | ~4.6 kB for `m` + ~15 kB `domAnimation`, loadable async | Nothing in the tree does layout/FLIP, `AnimatePresence` exit animations, or springs. CSS keyframes can't animate unmounts or reorders. |
| `@radix-ui/react-tooltip` | ~6 kB (shares Radix primitives already installed) | The current CSS-only Tooltip can't collide-detect, can't portal out of `overflow` tables, and doesn't delay or announce reliably. |
| `@radix-ui/react-tabs` | ~3 kB | Tabs are hand-rolled per page. This gives roving focus and arrow keys for free. |
| React Bits **Silk** or **Grid Motion** (copied in, not a package) | Silk needs `three`/`@react-three/fiber` (**~150 kB**). Grid Motion is DOM/CSS-only (~2 kB) | Login only. I recommend a DOM/CSS option (Grid Motion or a CSS "Aurora") to avoid WebGL. I'll show both on `/brand` before choosing. |
| `@tanstack/react-virtual` (**defer**) | ~5 kB | Only if a list passes about 500 rows. Today's data doesn't need it. |

No map library is proposed. Project location will use a static preview/link unless you want one.

## Needs your decision (data, query or logic)

These fall outside "UI only", so I haven't planned to touch them without a yes:

1. **`src/proxy.ts`**: let `/brand/*` static assets through without a session (fixes the broken
   login images), and decide whether the `/brand` gallery page should be public again.
2. **Search API** (`/api/search`): add suppliers, demands, camps, invoices, NOCs. This is a
   read-only query change.
3. **Timesheet URLs**: move `/invoices/client-timesheet/*` under `/timesheets/*` with
   redirects from the old paths. This is routing only, but it changes bookmarked URLs.
4. **Invoice issue with AED 0.00 total**: block, or confirm with a warning?
5. **Audit Log entity names**: needs a read-side lookup of each entity's display name.
6. **Hours chart shows 40h with empty bars**: likely a data/query bug and not UI.
7. **Performance:** TTFB of 0.75–2.7 s is server/DB-bound. The redesign will hide it
   (skeletons, progress bar, prefetch), but it won't make it faster.

---

## Top 20 changes, ranked (impact × frequency ÷ effort)

1. **`loading.tsx` skeleton for every route + top progress bar.** Kills dead clicks (X1). Phase 2.
2. **Client timesheet grid: keyboard nav, sticky name/header, dates in headers, fill-down/paste,
   single "Save n changes".** Phase 5.
3. **Single-active sidebar + animated indicator + collapsed flyouts** (X3). Phase 2.
4. **Dark mode + tuned neutrals and type scale** (X4). Phase 1.
5. **⌘K command palette with pages, actions, recents** (X11). Phase 2.
6. **Demand pipeline header + stage tabs with animated counts.** Phase 5.
7. **FormSaveBar only when dirty, read-first detail pages** (employee, client, project, supplier). Phases 5/6.
8. **Destructive actions moved into row menus + ConfirmDialog everywhere; no solid red buttons at rest** (X7). Phase 6.
9. **Attendance calendar: neutral future/weekend, red only for real gaps, side-panel editor with hotkeys.** Phase 5.
10. **DataTable everywhere (~42 hand-rolled tables) + filter chips + saved views + mobile card mode.** Phase 4.
11. **Toast + `useFormStatus` pending pattern for every mutation** (X6). Phases 1/5.
12. **Check-in as one Stepper with a bed map.** Phase 5.
13. **DatePicker replaces 55 native date inputs** (X8). Phase 5.
14. **Login rebuild + fix brand assets (with your OK on proxy).** Phase 2.
15. **Filters apply on change and persist in the URL** (X12). Phase 4.
16. **Employee wizard: 7 steps, progress ring, draft persistence, sticky footer.** Phase 5.
17. **Invoice/Generate Sheets: consistent missing-rate warnings, 3-step issue flow.** Phase 5.
18. **Mobile: bottom nav, card rows, collapsed toolbars, ≥ 40px targets** (X10). Phases 2/4/7.
19. **Labels and names: every field and icon button, `role=alert` errors, per-row checkbox labels** (X9). All phases, verified in 7.
20. **Root 404 + Letter Template live preview + Audit Log human diff.** Phases 2/6.

---

## Per-module checklist

Legend: ☐ to do · each box maps to a phase commit.

**Foundations (P1)**
- ☐ Tokens: type scale, tabular nums, tuned neutrals, dark mode, elevation, focus, motion (CSS + `src/lib/motion.ts`)
- ☐ Motion kit: FadeIn, Stagger/StaggerItem, AnimatedNumber, Presence, SlideOver, AnimatedTabs, Stepper, ProgressBar
- ☐ Primitives: Button, Input, Select, DatePicker, Checkbox/Switch, Tabs, Dialog, Sheet, Toast, Badge, Stepper, FileDrop, EmptyState, Skeleton
- ☐ `/brand` gallery (light/dark, reduced motion toggle)

**Login + Shell (P2)**
- ☐ Login (brand panel, show/hide, caps lock, alert, spinner, hand-off)
- ☐ Sidebar single-active + animated indicator + group collapse + collapsed flyouts
- ☐ Route progress bar + `loading.tsx` on every route
- ☐ ⌘K palette (pages/actions/records/recents) · `?` sheet · go-to chords
- ☐ Header breadcrumbs · BranchSwitcher (Radix Select) · inline branch pick in "All branches" banners
- ☐ Mobile bottom nav + drawer
- ☐ Root 404 · error · global-error

**Dashboards (P3)**
- ☐ Main dashboard: count-up KPIs, sparklines, draw-in charts, crossfades, stagger
- ☐ Customize: animated reorder, bigger targets, reset to default
- ☐ 8 module dashboards

**Lists (P4)**
- ☐ DataTable: density, hover, animated bulk bar, filter chips, saved views, inline edit + undo, empty/no-results, mobile cards
- ☐ Roll out: Employees · Renewals · Trades · Documents · Projects · Sites · NOCs · Demands · Mobilisation · Site Arrival · Demobilisation · Generate Doc · Camps · Check-In · Transport · Routes · Inventory · Upload · Companies · History · Clients · Suppliers · Banks · Enquiries · Quotations · Invoices · Invoice History · Lookups · Letter Templates · Audit Log

**Forms & flows (P5)**
- ☐ Workforce: Add employee wizard · Employee edit · Renewals actions
- ☐ Demand: Create · Detail/allocation · Mobilise · Site Arrival · Demobilisation · pipeline header · Generate Doc
- ☐ Facilities: Check-In Stepper · Bed map · Camps · Routes stops · Inventory
- ☐ Timesheets: Attendance · Client grid · Daily · New · Sync · Upload + review · Generate Sheets
- ☐ Business Partners: Client · Supplier (+ WC import Stepper) · Bank
- ☐ Projects/NOCs: Project new/detail · NOC Stepper + preview
- ☐ Sales: Enquiry · Quotation line items + totals
- ☐ Billing: Invoice review → issue → download
- ☐ Admin: Settings sub-nav · Lookups · Letter template preview · Data Reset confirmation

**Detail pages & feedback (P6)**
- ☐ Employee · Project · Client · Supplier · Bank · Demand · Inventory · Transport · Route · Quotation · NOC · Upload
- ☐ Radix Dialog/Popover/Tooltip + AnimatePresence · destructive confirmations · activity timelines

**Polish & QA (P7)**
- ☐ Illustrated empty states · consistency sweep (raw colours → tokens, radii)
- ☐ Keyboard-only pass · AA contrast · labels
- ☐ Lighthouse + bundle delta per route · reduced motion · dark mode · 375/768/1440
- ☐ `docs/design-system.md`

## Screenshots

Phase 0 screenshots were taken live in the review session. From Phase 1 on, I'll save
before/after images to `docs/redesign/screens/<phase>/<route>@<width>-<theme>.png` using a
headless capture script that reads your session cookie from an env var you set locally. I
won't handle the cookie itself. Tell me if you'd rather I keep screenshots out of the repo.

---

## Appendix A — measured sweep

_ovX = horizontal overflow px at 1440/768/375 (negative = scrollbar gutter, fine). small = tap
targets < 32px at 375. unlab = visible fields without a label. unnamed = buttons/links with no
accessible name. date/sel = native date inputs / selects (sel includes the header branch
switcher). load = full iframe load at 1440, ms._

| Route | load | ovX 1440/768/375 | CLS | small@375 | unlab | unnamed | date | sel | h1 |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 4122 | -10 / -10 / **20** | 0 | 2 | 0 | 0 | 0 | 1 | 1 |
| `/dashboards/workforce` | 3422 | -10 / -10 / -10 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/dashboards/business-partners` | 4563 | 0 / 0 / -10 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/dashboards/sales` | 1116 | 0 / 0 / -10 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/dashboards/projects` | 3793 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/dashboards/demand` | 1006 | 0 / 0 / -10 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/dashboards/facilities` | 2459 | 0 / 0 / -10 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/dashboards/timesheets` | 3914 | 0 / -10 / -10 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/dashboards/billing` | 1024 | 0 / 0 / -10 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/employees` | 2570 | 0 / 0 / -10 | 0 | **20** | 0 | 0 | 0 | 1 | 1 |
| `/employees/new` | 2687 | 0 / 0 / -10 | 0 | 12 | 0 | 0 | 1 | 1 | 1 |
| `/employees/[id]` | **8431** | -10 / -10 / -10 | 0 | 1 | 1 | 1 | **20** | 1 | 1 |
| `/employees/instant-view` | 1034 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/employees/renewals` | 1533 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/trades` | 2403 | -10 / -10 / -10 | 0 | **46** | 2 | 1 | 0 | 1 | 1 |
| `/documents` | 2489 | 0 / -10 / -10 | 0 | 6 | 1 | 0 | 0 | 1 | 1 |
| `/projects` | 2478 | 0 / 0 / 0 | 0 | 11 | 0 | 0 | 0 | 1 | 1 |
| `/projects/new` | 3872 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 2 | 1 | 1 |
| `/projects/[id]` | 2761 | -10 / -10 / -10 | 0 | 3 | 2 | 2 | 6 | 1 | 1 |
| `/sites` | 1010 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/operations/nocs` | 1358 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/operations/nocs/new` | **6015** | 0 / 0 / -10 | 0 | 7 | 0 | **7** | 1 | 1 | 1 |
| `/demand/new` | 2453 | 0 / 0 / 0 | 0 | 0 | 1 | 0 | 0 | 1 | 1 |
| `/demand` | 999 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/demand/[id]` | 5099 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/demand/[id]/mobilise` | 5090 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 |
| `/demand/[id]/documents` | 2279 | 0 / 0 / 0 | 0 | 2 | 0 | 0 | 0 | 1 | 1 |
| `/demand/mobilisation` | 2678 | 0 / 0 / 0 | 0 | 8 | 0 | 0 | 0 | 1 | 1 |
| `/demand/site-arrival` | 3365 | 0 / 0 / 0 | 0 | 9 | 0 | 0 | 1 | 1 | 1 |
| `/demand/demobilisation` | 2446 | 0 / -10 / -10 | 0 | 7 | 0 | 0 | 1 | 1 | 1 |
| `/demand/documents` | 1036 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/accommodation` (redirect) | 1006 | 0 / -10 / -10 | 0 | 43 | 0 | 0 | 0 | 1 | 0 |
| `/accommodation/camps` | 1488 | -10 / -10 / -10 | 0 | **43** | **8** | 0 | 0 | 1 | 1 |
| `/accommodation/checkin` | 2197 | -10 / -10 / -10 | 0 | 10 | 0 | **7** | 0 | 1 | 1 |
| `/accommodation/bed-allocation` | 1523 | 0 / 0 / -10 | 0 | 3 | 0 | 0 | 0 | 1 | 1 |
| `/transport` | 1903 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/transport/routes` | 3921 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/transport/routes/new` | 2526 | 0 / 0 / 0 | 0 | 2 | 3 | 0 | 0 | 1 | 1 |
| `/inventory` | 1308 | 0 / 0 / 0 | 0 | 2 | 0 | 0 | 0 | 1 | 1 |
| `/inventory/[id]` | 1261 | -10 / -10 / -10 | 0 | 4 | 0 | 0 | 1 | 1 | 1 |
| `/attendance` | 2696 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/invoices/client-timesheet` | 1966 | 0 / 0 / **76** | 0 | 7 | **60** | 3 | 0 | 5 | 1 |
| `/invoices/client-timesheet/new` | 2539 | 0 / 0 / 0 | 0 | 1 | **36** | 0 | 0 | 1 | 1 |
| `/invoices/client-timesheet/daily` | 1099 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 1 | 1 | 1 |
| `/invoices/client-timesheet/sync` | 1173 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/upload` | 1151 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/companies` | 1142 | 0 / 0 / 0 | 0 | 2 | 1 | 2 | 0 | 2 | 1 |
| `/history` | 3926 | 0 / -10 / -10 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/timesheets/manual` (redirect) | 855 | 0 / -10 / 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 |
| `/clients` | 799 | 0 / 0 / -10 | 0 | 9 | 1 | 5 | 0 | 1 | 1 |
| `/clients/new` | 1327 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 2 | 1 | 1 |
| `/clients/[id]` | 5019 | -10 / -10 / **57** | 0 | 8 | 1 | 0 | 4 | 1 | 1 |
| `/suppliers` | 2659 | 0 / 0 / -10 | 0 | 13 | 1 | 5 | 0 | 1 | 1 |
| `/suppliers/[id]` | 4179 | 0 / 0 / -10 | 0 | 2 | 0 | 0 | 1 | 2 | 1 |
| `/banks` | 1593 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/sales/enquiries` | 1029 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/sales/enquiries/new` | 1111 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/sales/quotations` | 1027 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/sales/quotations/new` | 859 | 0 / 0 / -10 | 0 | 0 | 5 | 0 | 1 | 1 | 1 |
| `/invoices` | 1276 | 0 / 0 / 0 | 0 | 0 | 1 | 0 | 0 | 2 | 1 |
| `/invoices/history` | 1308 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/settings` | 2468 | -10 / -10 / -10 | 0 | 0 | 6 | 0 | 0 | 1 | 1 |
| `/lookups` | 1527 | 0 / 0 / 0 | 0 | 2 | 0 | 0 | 0 | 1 | 1 |
| `/letter-templates` | 3952 | 0 / 0 / 0 | 0 | 2 | 0 | 0 | 0 | 2 | 1 |
| `/audit-log` | 1934 | -10 / -10 / -10 | 0 | 2 | 3 | 0 | 0 | 3 | 1 |
| `/settings/data-reset` | 2236 | -10 / -10 / -10 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `/brand` | 1014 | -10 / -10 / -10 | 0 | 10 | 0 | 10 | 1 | 1 | 1 |
| unknown URL (bare Next 404) | 72 | 0 / 0 / 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |

**Takeaways:** CLS is 0 on every route at every width, which the redesign must keep. Real
horizontal page overflow at 375 on only 3 routes: `/` (+20), `/invoices/client-timesheet`
(+76) and `/clients/[id]` (+57). The mobile problem is density and tap targets, not overflow.
The unlabelled-field hot spots are the two timesheet grids (60 and 36 cells).
