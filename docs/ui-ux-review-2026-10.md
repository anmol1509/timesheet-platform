# UI / UX review — October 2026

_13 Oct 2026 · branch `claude/jolly-pasteur-v3es5i` · reviewed against `main` @ `353a40d`_

This review builds on the Phase 0 audit (`docs/redesign-audit.md`) and the six
redesign phases that followed. Every one of those phases says it was **never seen
rendered**. This review was. The app ran locally against a seeded database
(about 34 workers, 6 projects, 6 demands, bills and expenses). **36 routes** were
loaded in Chromium at **1440×900** and **390×844**, screenshotted, scanned with
**axe-core 4.10** (WCAG 2.1 AA plus best practice), and measured for overflow,
tap targets, rendered font sizes and how far down the first table row sits.
Targeted interaction checks covered tab order, dark mode and the command palette.
The numbers are in [Appendix A](#appendix-a--measured-sweep), and the reproduction
steps (including a migration bug that blocks a fresh setup) are in
[Appendix C](#appendix-c--reproducing-this-review-locally).

---

## Executive summary

### What is already strong

- **A real token system.** `src/app/globals.css` defines semantic colour, radius,
  elevation, motion and type tokens with a full dark theme. Light-mode text tokens all
  pass AA: `--text-subtle` is 4.97:1 on white and 4.72:1 on table headers.
- **Good primitives.** Radix-based `Dialog`, `Tooltip`, `Popover` and `Checkbox`, a
  **typeable** `DatePicker` (dd/mm/yyyy first, calendar second, which is right for
  dates copied off passports), `ConfirmDialog`, `Toast`, `EmptyState`, `Skeleton`,
  `StatTile`, `PageHeader`. Native `<input type="date">` went from 55 to 2.
- **Shell fundamentals are fixed.** Exactly one sidebar row is active (longest match
  wins). The collapsed rail shows one icon per group with a flyout. 28 `loading.tsx`
  files plus a route progress bar. A ⌘K palette with **Actions / Pages / Recents**
  that works well live. A `?` shortcut sheet. Sidebar pins.
- **Some genuinely good ERP screens.** The Demand list packs allocation bars,
  supplier-offer chips and age into one scannable row. The Approvals inbox has a
  list + detail split with `j`/`k` navigation. `DataTable` has sticky headers,
  column picker, Excel/CSV export, tree rows and an animated bulk bar.

### Main pain points

| # | Pain point | Evidence |
|---|---|---|
| P1 | **List pages bury the list.** KPI tiles and charts sit above every major table, so the first record is below or at the fold. | First table row at **y=879 px** on `/employees` (viewport 900), 729 on `/clients`, 965 on `/data-health`. The Approvals work queue starts at about 830. |
| P2 | **The highest-frequency data-entry screens are unchanged.** | Client Timesheet still saves **per row**, has no arrow-key navigation and a "Go" filter button. Daily Attendance makes you pick a day before anything shows, and each row's status is a searchable popover with raw codes (`SICK_LEAVE`). Quotation line items are placeholder-only with no totals. |
| P3 | **Design-system adoption is shallow, so the same thing looks different on every page.** | `Field` is used in **1** file, `Section` in **1**, `FormSaveBar` in **2**, `<Button>` in **10** (vs **403** `.btn` class strings), `DataTable` in **11** of **76** table files. **346** hand-rolled label strings vs **8** `.field-label`. **14** distinct font sizes rendered in `<main>`. **10** separate status→colour maps, and the same status renders as `ACTIVE`, `active` and `Active` on three detail pages. |
| P4 | **Detail pages have no common anatomy.** | Three content widths (≈770 / ≈900 / full), "← Back" links on 21 pages vs breadcrumbs on others, Documents-first on Client and Supplier, Delete as the only header action. Forms are editable on arrival with a sticky "Save changes" shown even when nothing changed (Employee). |
| P5 | **Keyboard and screen-reader paths are expensive.** | **38 Tab presses** to reach page content (every nav link has a focusable Pin button), **no skip link**, unlabelled checkboxes (axe `button-name` ×10), progress bars without names (×21), and `Select` has no type-ahead. |
| P6 | **Dark mode is not yet trustworthy.** | Hard-coded hover hex values, 75 raw palette classes in 16 files, compliance row tints that turn into pale stripes, white-on-brand primary buttons at **3.29:1**, and nav count badges at **2.0:1** / **2.9:1**. |
| P7 | **Feedback is fragmented.** | Toasts are used in **3** files. About **60** components set ad-hoc inline status text. `FormValidation` injects its own DOM notice. `ConfirmDialog` closes before the action runs, with no pending or error state. 9 `window.confirm` calls remain. |

### Status of the Phase 0 "Top 20"

| Done (verified live) | Partly done | Still open |
|---|---|---|
| Single-active sidebar; collapsed flyouts; ⌘K palette; dark mode; route progress bar; typeable dates; root 404; login assets | Loading skeletons (28 routes); `DataTable` rollout (11 tables); ConfirmDialog everywhere (9 `confirm()` left); sticky grid header/name column | Timesheet grid keyboard/fill-down/single save; Go-button filters; employee wizard 8→7 steps; read-first detail pages; demand pipeline header; check-in as one flow; quotation line-item editor; toast-based feedback; mobile bottom nav |

---

## Quick wins (low effort, high impact)

Each is ≤ ½ day, local to one or two files, and changes no server logic.

| # | Change | Where | Why |
|---|---|---|---|
| QW1 | **Open Daily Attendance on today** when no `?date=` is given in the current month. | `src/app/(app)/attendance/page.tsx:23` | Removes one click from the most repeated daily task. The page currently opens on "Pick a day on the calendar". |
| QW2 | **Fix DataTable's empty-filter message.** It reads `No rows match ""` and "Clear search" leaves the dropdown filters set. | `src/components/data-table/DataTable.tsx:567-583` | Dead end on every filtered table. [Snippet](#t2-datatable-no-results-state-ignores-dropdown-filters) |
| QW3 | **Add a skip link, name the sidebar `<nav>`, and take Pin buttons out of the Tab order.** | `src/app/(app)/app-shell.tsx:131`, `src/app/(app)/nav-links.tsx:545-560, 562` | 38 → about 20 tab stops before content; meets WCAG 2.4.1. [Snippet](#n1-keyboard-path-to-content-is-38-tab-stops) |
| QW4 | **`Select` with `required` doesn't validate.** The attribute sits on a hidden input, which browsers exclude from validation. | `src/components/ui/Select.tsx:61`; used by `payroll/create-run-form.tsx:21`, `vendor/(portal)/profile/profile-forms.tsx:103`, `vendor/(portal)/workers/add-worker.tsx:47` | A silent empty submit. [Snippet](#f3-required-on-select-is-a-no-op) |
| QW5 | **Replace the hard-coded hover hex values** (`#c3c8d4`, `#bcc2cf`) with a `--border-hover` token. | `globals.css:442, 480`; `ui/Button.tsx:8`; `data-table/DataTable.tsx:302` | Light-grey borders flash on dark surfaces on every hover. |
| QW6 | **Theme the compliance row tint.** `bg-red-50/60` / `bg-amber-50/60` become pale stripes under light text in dark mode. | `src/lib/compliance.ts:28-32` | The most-used table becomes unreadable in dark mode. |
| QW7 | **Swap raw reds and greens for tokens** in the shared feedback primitives. | `ui/ConfirmDialog.tsx:44`, `DeleteButton.tsx:37`, `FormSaveBar.tsx:74-75` | These ship on dozens of screens. |
| QW8 | **Name the unlabelled controls**: row checkboxes in the timesheet grid and check-in table, hours inputs in attendance, `role="progressbar"` bars. | `invoices/client-timesheet/client-timesheet-grid.tsx:189, 221`; `accommodation/checkin/checkin-table.tsx`; `attendance/attendance-form.tsx:468-490`; `DeploymentPipelineFunnel` / demand & project allocation bars | Clears axe `button-name` (critical) and `aria-progressbar-name` (serious, 21 nodes). |
| QW9 | **Humanise status labels everywhere.** `"CLIENT_APPROVED".replace("_"," ")` only replaces the first underscore and keeps SCREAMING case; the attendance status options show `SICK_LEAVE`. | `client-timesheet-grid.tsx:231`; `attendance-form.tsx:465, 601`; `projects/project-list.tsx:285`; `clients/[id]/page.tsx:52` | One `formatStatus()` helper. See [DS2](#ds2-one-status-registry). |
| QW10 | **Apply filters on change** (drop the "Go" / "Filter" buttons). | `invoices/client-timesheet/page.tsx:155-183`, `approvals/approvals-board.tsx:152-160`, `companies/page.tsx:102` | Phase 0 finding X12, still open. [Snippet](#t4-filters-need-a-go-button) |
| QW11 | **Stop `Select` stretching to full width inside filter rows.** The Approvals filter bar renders "Any wait" and "Anyone" as 1,100 px-wide bars. | `approvals/approvals-board.tsx:155, 157` (wrap each in `w-44`), or add a `className` prop to `Select`'s root | Visible layout bug at 1440. |
| QW12 | **Move toasts clear of the AI button.** Both are `fixed right-4 bottom-4`. | `ui/Toast.tsx:54` → `bottom-20 sm:bottom-24` | Toasts currently stack on top of the assistant button. The button also covers the last column and row actions of tables (visible on Projects and Supplier bills). |
| QW13 | **Define or remove `rounded-overlay`.** The utility doesn't exist, so the assistant panel renders with square corners. | `NavAssistant.tsx:314`; add `--radius-overlay: var(--radius-xl)` to `@theme` | |
| QW14 | **Show sort affordance at rest** (`opacity-0` → `opacity-40`). | `DataTable.tsx:543` | Sorting can't be discovered without hovering each header. |
| QW15 | **De-duplicate employee header badges.** "Active · Active" appears because employment and stage are both labelled "Active". | `employees/[id]/page.tsx:228-238` | Rename the stage chip ("Deployed" / "On bench", as the list already does via `deployBadge`). |
| QW16 | **Let the wizard's step bar scroll instead of wrapping** ("8 Review" lands alone on a second line). | `employees/new/wizard.tsx:832` (`flex-wrap` → `flex-nowrap overflow-x-auto`) | |
| QW17 | **Delete stray `src/app/(app)/finance/page.tsx-E`** (a `sed -i -E` backup committed in `8a99aee`). | — | Dead file that drifts from the real page. |

---

## Component-level recommendations

Severity: **High** blocks or slows a daily task, or fails WCAG A/AA. **Medium** causes
inconsistency or friction. **Low** is polish.

### 1. Navigation & layout

#### N1. Keyboard path to content is 38 tab stops — **High**

- **Issue.** Measured on `/employees`: 38 Tab presses before focus enters `<main>`.
  Every sidebar link is followed by its own "Pin X" button (`nav-links.tsx:545`), which
  doubles the stops. There is no skip link. The sidebar `<nav>` (`nav-links.tsx:562`) has
  no accessible name, so it can't be told apart from the breadcrumb and pagination navs.
  The count badge uses `aria-label` on a plain `<span>` (`nav-links.tsx:538`), which
  most screen readers ignore.
- **Fix.** Add a skip link and give `<main>` an id. Name the nav. Take Pin out of the
  Tab order (it stays reachable by pointer, and the palette can offer "Pin this page").
  Put the count in visually-hidden text.
- **Files.** `src/app/(app)/app-shell.tsx`, `src/app/(app)/nav-links.tsx`, `src/components/CommandPalette.tsx`

```tsx
// app-shell.tsx — before
<main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pt-7">

// after
<a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:shadow-popover">
  Skip to content
</a>
…
<main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-6 pb-24 outline-none sm:px-6 lg:px-8 lg:pt-7">
```

```tsx
// nav-links.tsx — before
<nav className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
…
<span className="tabular ml-auto …" aria-label={`${count} need attention`}>{count > 99 ? "99+" : count}</span>
…
<button type="button" onClick={() => togglePin(item.href)} aria-label={…} …>

// after
<nav aria-label="Main" className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
…
<span className="tabular ml-auto …" aria-hidden>{count > 99 ? "99+" : count}</span>
<span className="sr-only">, {count} need attention</span>
…
<button type="button" tabIndex={-1} onClick={() => togglePin(item.href)} aria-label={…} …>
```

#### N2. Sidebar chrome crowds out navigation — **Medium**

- **Issue.** At 1440×900 the nav list is cut off at "COMMERCIAL" on every page. The
  sticky footer holds **two** "Need help?" cards (Ask Assistant AI, Report an issue),
  about 140 px together, and a floating AI button repeats the first. The branch name
  appears three times (sidebar `BranchCard`, header `BranchSwitcher`, page context) and
  is truncated in both chrome positions ("Al Noor Manpower Servic…").
- **Fix.** Collapse the two help cards into one `?` icon row (Assistant · Report issue ·
  Shortcuts). Keep the floating button, since it is reachable from every page. Drop
  `BranchCard` when `BranchSwitcher` is visible (super admin). For other roles keep the
  card and let the name wrap to two lines.
- **Files.** `src/app/(app)/app-shell.tsx:97-101`, `src/components/BrandMark.tsx`, `src/components/SupportTicketCard.tsx`

#### N3. Sidebar mixes actions with destinations, and labels disagree — **Medium**

- **Issue.** "Create Demand", "Create Check-In" and "Add Candidate" are **actions**
  listed as **pages**. The same action has three names: sidebar "Create Demand", list
  button "New Request", palette "Raise demand", page title "Raise Demand". "Onboarding"
  (a people workflow) sits under **Setup**. Only one group can be open at a time
  (`nav-links.tsx` `toggle`), so moving between Demand and Facilities collapses the one
  you came from.
- **Fix.** Remove action rows from the nav (they live in the palette's Actions group
  and each list's primary button). Adopt a verb glossary: **New** for create, never
  Create/Add/Raise interchangeably. Move Onboarding under People. Allow several groups
  open, and persist the set instead of a single `nav.openGroup`.
- **Files.** `src/app/(app)/nav-links.tsx:83-255`, `src/components/CommandPalette.tsx:41-52`

#### N4. Section tabs render above the page title — **Medium**

- **Issue.** `AppShell` renders `<SectionTabs />` before `{children}` (`app-shell.tsx:132`),
  so on Client Timesheet, Supplier bills and similar pages the tab strip sits **above**
  the `<h1>`. Hierarchy reads tabs → title → content.
- **Fix.** Let `PageHeader` accept a `tabs` slot rendered under the description, or have
  `SectionTabs` portal into a slot inside `PageHeader`. At minimum, move it below the
  header with a `data-section-tabs` anchor that pages place.
- **Files.** `src/app/(app)/app-shell.tsx`, `src/components/SectionTabs.tsx`, `src/components/PageHeader.tsx`

#### N5. Detail pages have no common anatomy — **High**

- **Issue (measured).** Content width differs per detail page: Supplier about 770 px,
  Project/Demand about 900 px, Client full width. Page containers use `max-w-2xl` (3),
  `3xl` (14), `4xl` (6), `5xl` (5) and `6xl` (1), some centred and some left-aligned.
  Navigation back is a "← Back" link on 21 pages, a `PageHeader` breadcrumb on 9, and a
  hand-rolled breadcrumb on Employee. Delete is the **only** header action on Project and
  Client. Client and Supplier open on **Documents** rather than an overview (Phase 0 finding).
- **Fix.** One `DetailLayout`: breadcrumb → title row (name, code, status badge, primary
  actions, overflow `⋯` menu holding Delete) → key-facts strip → tabs → content at a
  single width (`max-w-6xl`, left-aligned). Overview is the default tab and read-only.
  Each section gets an **Edit** affordance that reveals inputs, and `FormSaveBar` shows
  only when dirty.
- **Files.** `projects/[id]/page.tsx`, `clients/[id]/page.tsx`, `suppliers/[id]/page.tsx`, `employees/[id]/page.tsx`, `demand/[id]/page.tsx`, `transport/[id]/page.tsx`, `inventory/[id]/page.tsx`

```tsx
// New: src/components/DetailHeader.tsx (sketch)
export function DetailHeader({ crumbs, title, code, status, actions, menu, facts }: {
  crumbs: Crumb[]; title: string; code?: string; status?: React.ReactNode;
  actions?: React.ReactNode;          // primary first-class actions only
  menu?: React.ReactNode;             // overflow ⋯ — Delete, Archive, Duplicate
  facts?: { label: string; value: React.ReactNode }[];
}) {
  return (
    <PageHeader
      breadcrumbs={crumbs}
      title={title}
      meta={<>{code && <span className="tabular text-sm text-muted">{code}</span>}{status}</>}
      actions={<>{actions}{menu && <OverflowMenu>{menu}</OverflowMenu>}</>}
      description={facts && (
        <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
          {facts.map((f) => (
            <div key={f.label}><dt className="eyebrow">{f.label}</dt><dd className="text-sm text-primary">{f.value}</dd></div>
          ))}
        </dl>
      )}
    />
  );
}
```

#### N6. Mobile overflow and duplicated summary — **Medium**

- **Issue.** At 390 px the dashboard scrolls sideways by **116 px**. The cause is the
  capacity table in `src/lib/dashboardWidgets.tsx:376`, which has no `overflow-x-auto`
  wrapper. `/employees/renewals` measures **536 px** of document overflow; the element
  wasn't isolated, so start with the expiry-timeline section. The "29 %" chip on the
  Employees "Compliance Issues" tile overflows its card. Mobile still has no bottom nav
  (deferred since Phase 2).
- **Fix.** Wrap widget tables in `<div className="overflow-x-auto">`. Add a
  `min-w-0`/`truncate` rule on `StatTile` headers. Rethink the bottom nav once N2/N3 shrink
  the IA.
- **Files.** `src/lib/dashboardWidgets.tsx`, `src/app/(app)/employees/renewals/renewals-board.tsx`, `src/components/StatTile.tsx`

### 2. Dashboard & analytics

#### D1. "Get started" pushes the dashboard below the fold — **Medium**

- **Issue.** At 4/7 complete the checklist takes about 490 px, so KPI tiles start at
  y≈735 and charts below 900. Done steps still list in full.
- **Fix.** Once ≥ 50 % complete, collapse to one line ("3 steps left · Next: add
  company details →"). Hide finished rows. Remember the collapsed state per user. The
  component already has a collapse chevron, so default it to collapsed past a threshold.
- **Files.** `src/components/GetStarted.tsx`, `src/app/(app)/page.tsx`

#### D2. Charts use inconsistent colour and axis labels — **Low**

- **Issue.** Supplier-bill volume uses `--info` blue with bare month numbers ("05 06 07"),
  Demand allocation bars are blue, and the Employees "By trade" bars and treemap are
  brand purple. The Approvals ageing chart uses green→red. The "Nothing marked 31"
  legend on Attendance counts future days.
- **Fix.** Introduce `--chart-1…6` tokens (brand-led, CVD-safe) and use semantic colours
  only where the value **is** a status. Label months `May Jun Jul` via
  `Intl.DateTimeFormat(…, { month: "short" })`.
- **Files.** `src/components/BarList.tsx`, `AgingHistogram.tsx`, `Treemap.tsx`, `finance/bills/bills-board.tsx`, `attendance/attendance-calendar.tsx`

#### D3. Module dashboards duplicate the sidebar — **Low**

The tab row under the dashboard (Workforce · Projects · Demand · …) mirrors sidebar
groups one to one, which Phase 0 also noted. Consider surfacing each module's dashboard
as that module's landing tab instead, and keep the home dashboard for cross-module "needs
attention".

### 3. Data tables & lists

#### T1. KPI and chart blocks bury the table — **High**

- **Issue (measured at 1440×900).** First table row: `/employees` **879 px**,
  `/clients` 729, `/finance/bills` 690, `/data-health` 965. The Approvals queue is about
  830. On phones: Employees 1,581 px, Onboarding 1,578. On Create Check-In the three KPI
  tiles repeat the filter-chip counts directly beneath them ("10 / 10 / 0" vs "All (10) ·
  Not checked in (10) · Awaiting (0)"). The Camps page shows three zero tiles over an empty
  state.
- **Fix.** The list is the page. Move charts behind an **Insights** disclosure (closed by
  default, remembered per viewer). Keep at most one compact KPI strip (`KpiStrip`, already
  in the repo) that **doubles as the filter**: clicking "Bench 9" filters the table. Hide
  KPI tiles entirely while the module is empty.
- **Files.** `employees/page.tsx` + `employee-list.tsx`, `clients/page.tsx`, `finance/bills/bills-board.tsx`, `approvals/approvals-board.tsx`, `accommodation/checkin/checkin-table.tsx`, `accommodation/camps/page.tsx`, `data-health/page.tsx`

```tsx
// employees/page.tsx — after (sketch)
<PageHeader title="Employees" meta={<CountPill>{total}</CountPill>} actions={…} />
<KpiStrip items={[
  { label: "On work", value: onWork, href: "?filter=on-work" },
  { label: "Bench", value: bench, href: "?filter=bench" },
  { label: "Compliance issues", value: issues, tone: "error", href: "?filter=incomplete" },
]} />
<details className="card group" data-persist="employees.insights">
  <summary className="card-header cursor-pointer text-sm font-semibold">Insights — by trade &amp; nationality</summary>
  <div className="grid gap-4 p-5 lg:grid-cols-2">{byTrade}{byNationality}</div>
</details>
<EmployeeList … />
```

#### T2. DataTable "no results" state ignores dropdown filters — **High** (bug)

- **Issue.** When a dropdown filter (not the search box) leaves zero rows, the table
  says `No rows match ""` and offers **Clear search**, which leaves the filter in place.
- **Files.** `src/components/data-table/DataTable.tsx:567-583`

```tsx
// before
<p className="text-sm font-medium text-primary">No rows match &ldquo;{query}&rdquo;</p>
…
<button type="button" onClick={() => setQuery("")} …>Clear search</button>

// after
const activeFilters = Object.values(filterValues).filter(Boolean).length;
<p className="text-sm font-medium text-primary">
  {query ? <>No rows match &ldquo;{query}&rdquo;</> : "No rows match these filters"}
  {query && activeFilters > 0 && " with the current filters"}
</p>
…
<button type="button" onClick={() => { setQuery(""); setFilterValues({}); setPage(1); }} …>
  Clear {query && activeFilters ? "search and filters" : query ? "search" : "filters"}
</button>
```

#### T3. Table state is lost on reload and can't be shared — **Medium**

- **Issue.** Sort, search, dropdown filters, hidden columns and page are all
  `useState` in `DataTable`. Employees reads `?filter=` once (`initialFilter`) but never
  writes it back. A refresh or "Back" from a record resets everything. Column choices
  aren't remembered.
- **Fix.** Sync `q`, `sort`, `f.<key>` and `page` to the URL with
  `router.replace(…, { scroll: false })`. Persist hidden columns per table id in
  `localStorage`, since that is a per-viewer convenience.
- **Files.** `src/components/data-table/DataTable.tsx`, `src/app/(app)/employees/employee-list.tsx`

#### T4. Filters need a "Go" button — **Medium**

- **Issue.** Client Timesheet (`invoices/client-timesheet/page.tsx:155-183`) and Approvals
  (`approvals-board.tsx:152-160`) use GET forms with a submit button. With an empty month
  the filter card is hidden entirely (`months.length > 0`), so "No billable timesheet
  entries for this client/month" offers no way to change client or month, and no next step.
- **Fix.** A tiny client wrapper that submits on change, plus a real `EmptyState` with
  "New entry" / "Import timesheets" actions.

```tsx
// New: src/components/AutoSubmitForm.tsx
"use client";
export function AutoSubmitForm(props: React.FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      {...props}
      onChange={(e) => {
        // Text fields submit on Enter; selects and dates submit immediately.
        if ((e.target as HTMLElement).tagName !== "INPUT" || (e.target as HTMLInputElement).type === "hidden")
          e.currentTarget.requestSubmit();
      }}
    />
  );
}
```

The `Select` primitive's hidden input doesn't fire `change` on its own. Dispatch one from
`handleSelect`: `hiddenRef.current?.dispatchEvent(new Event("change", { bubbles: true }))`.

#### T5. Row clicks aren't keyboard or new-tab friendly — **Medium**

- **Issue.** `rowHref` rows navigate via `onClick` on `<tr>` with `router.push`
  (`DataTable.tsx:595-604`). Rows aren't focusable, Cmd/Ctrl-click doesn't open a new tab,
  and middle-click does nothing. That matters in an ERP where people open five records
  side by side.
- **Fix.** Make the primary cell a real `<Link>` and stretch it over the row with an
  `after:absolute after:inset-0` overlay. Keep `onClick` only as a fallback for the
  rest of the row.

#### T6. Density, sticky columns and nested scrolling — **Medium**

- **Issue.** Default row height is about 60–75 px (Projects: manager name + phone + email
  stacked in one cell; the client repeated under the project name **and** in its own
  column; a decorative identical icon on every row). The table body scrolls inside
  `max-h-[calc(100vh-15rem)]`, so on long pages there are two vertical scrollbars. The
  first column isn't sticky, so the Projects table clips "TI…" at 1440 and identity is lost
  on horizontal scroll. `density="compact"` exists but users can't choose it.
- **Fix.** (a) A density toggle in the Columns popover, persisted per viewer. (b) A
  `stickyFirst` prop on `DataTable` (`sticky left-0 bg-surface z-[5]` on the first data
  `th`/`td`). (c) Default `stickyHeader` to sticky against the page (`top-16`, under the
  app header) instead of an inner scroll box. (d) Trim Projects columns: drop the row
  icon, drop the client subtitle, put manager contact in a hover card.
- **Files.** `src/components/data-table/DataTable.tsx`, `src/app/(app)/projects/project-list.tsx`

#### T7. Only 11 of 76 tables use `DataTable` — **Medium (ongoing)**

The rest hand-roll `<table>` with their own header styles, empty states and no
sort/export. That is why axe reports 12 empty `<th>` across 9 routes. Prioritise by
traffic: **Supplier bills, Expenses, Quotations, Enquiries, Trades, Check-In, Invoice
history, Audit log**. Each conversion is mostly declarative column config.

### 4. Forms & data entry

#### F1. Client Timesheet grid: spreadsheet ergonomics — **High**

- **Issue (code-verified).** `client-timesheet-grid.tsx` keeps one **Save per row**
  (line 248), so a 30-worker month is 30 clicks. There's no arrow/Enter navigation, no
  fill-right or fill-down, no paste from Excel, and the **Total** column doesn't update as
  you type (`e.totalHours` comes from the server). Edits are lost on navigation (no
  `useUnsavedGuard`). Row and select-all checkboxes have no labels. The four bulk buttons
  render permanently disabled. The `LOCKED` status uses raw `bg-slate-800`.
- **Fix.** One dirty-cell set, a sticky **"Save 14 changes"** bar (a client-side loop
  over the existing `updateDailyHoursAction`, so no server change), arrow-key navigation,
  a live total, and TSV paste.

```tsx
// client-timesheet-grid.tsx — cell input, after
<input
  data-r={rowIndex} data-c={i}
  value={cellValue(e.id, i)}
  onChange={(ev) => editCell(e.id, i, ev.target.value)}
  onKeyDown={(ev) => {
    const move = { ArrowUp: [-1, 0], ArrowDown: [1, 0], Enter: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[ev.key];
    if (!move) return;
    if ((ev.key === "ArrowLeft" || ev.key === "ArrowRight") && ev.currentTarget.selectionStart !== ev.currentTarget.selectionEnd) return;
    ev.preventDefault();
    const next = ev.currentTarget.closest("table")?.querySelector<HTMLInputElement>(
      `input[data-r="${rowIndex + move[0]}"][data-c="${i + move[1]}"]`);
    next?.focus(); next?.select();
  }}
  onPaste={(ev) => {
    const rows = ev.clipboardData.getData("text").trimEnd().split(/\r?\n/).map((l) => l.split("\t"));
    if (rows.length === 1 && rows[0].length === 1) return;          // single value: let it paste normally
    ev.preventDefault();
    rows.forEach((cells, dr) => cells.forEach((v, dc) => {
      const target = entries[rowIndex + dr];
      if (target && target.status !== "LOCKED") editCell(target.id, i + dc, v.trim());
    }));
  }}
  aria-label={`${e.employeeName}, ${dayHeaders[i]?.date ?? `day ${i + 1}`}`}
  …
/>

// Live total instead of e.totalHours
const liveTotal = (edited[e.id] ?? parsed[e.id] ?? []).reduce((s, d) => s + (Number(d.value) || 0), 0);
```

```tsx
// One save bar for the whole grid
const dirtyIds = Object.keys(edited);
{dirtyIds.length > 0 && (
  <div className="sticky bottom-0 z-30 flex items-center gap-3 border-t border-default bg-surface/95 px-4 py-3 backdrop-blur">
    <Button onClick={saveAll} disabled={pending}>{pending ? "Saving…" : `Save ${dirtyIds.length} row${dirtyIds.length > 1 ? "s" : ""}`}</Button>
    <Button variant="ghost" onClick={() => setEdited({})}>Discard</Button>
    <span className="text-xs text-muted">⌘S to save</span>
  </div>
)}
```

#### F2. Daily Attendance roll-call is pointer-heavy — **High**

- **Issue.** The page opens with no day selected (see QW1). Per row, status is a
  **searchable popover `Select`** whose options are raw codes (`PRESENT`, `SICK_LEAVE`;
  `attendance-form.tsx:465`), which takes 2–3 interactions per worker. Normal and OT
  hours are `type="number"` with **no label** (lines 468–490). Save sits below the table
  and isn't sticky. "(not yet arrived)" explains itself only in a `title` tooltip. Weekends
  are still red (no working-week setting is applied).
- **Fix.** Replace the per-row Select with a compact segmented control,
  **P · A · L · S · H · O**, with roving focus and letter hotkeys while the row is
  focused. Keep "Mark all present" and add "Mark selected …". Make Save sticky. Show
  the arrival reason as visible helper text.

```tsx
// New: src/components/ui/StatusPills.tsx (sketch)
const OPTIONS = [
  { v: "PRESENT", k: "p", label: "Present" }, { v: "ABSENT", k: "a", label: "Absent" },
  { v: "LEAVE", k: "l", label: "Leave" }, { v: "SICK_LEAVE", k: "s", label: "Sick" },
  { v: "HOLIDAY", k: "h", label: "Holiday" }, { v: "OFF", k: "o", label: "Off" },
];
export function StatusPills({ value, onChange, name, disabled }: { value: string; onChange: (v: string) => void; name: string; disabled?: boolean }) {
  return (
    <RadioGroup.Root value={value} onValueChange={onChange} disabled={disabled} aria-label={`Attendance for ${name}`}
      onKeyDown={(e) => { const o = OPTIONS.find((x) => x.k === e.key.toLowerCase()); if (o) { e.preventDefault(); onChange(o.v); } }}
      className="inline-flex rounded-control border border-strong p-0.5">
      {OPTIONS.map((o) => (
        <RadioGroup.Item key={o.v} value={o.v} title={o.label}
          className="h-7 min-w-7 rounded-[6px] px-1.5 text-xs font-semibold text-muted data-[state=checked]:bg-brand-soft data-[state=checked]:text-[var(--brand-primary)]">
          {o.label[0]}<span className="sr-only">{o.label.slice(1)}</span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
```

#### F3. `required` on `Select` is a no-op — **High** (bug)

- **Issue.** `Select` puts `required` on `<input type="hidden">` (`ui/Select.tsx:61`).
  Hidden inputs are barred from constraint validation, so forms like **Create payroll
  run** (`payroll/create-run-form.tsx:21`) submit with no company chosen. The trigger
  also has no `aria-required`/`aria-invalid`, and a closed trigger has no type-ahead.
  A native `<select>` jumps on letter keys; this one needs Enter, then typing, then Enter.
- **Fix.** Proxy validity onto a visually-hidden but validatable input and mirror the
  state on the trigger. Open the popover on ArrowDown or any printable key, seeding the
  search with that key.

```tsx
// ui/Select.tsx — before
{name && <input type="hidden" name={name} value={value} required={required} />}

// after
{name && (
  <input
    tabIndex={-1} aria-hidden name={name} value={value} required={required}
    onChange={() => {}} // controlled by the popover
    onInvalid={() => { setInvalid(true); triggerRef.current?.focus(); }}
    className="pointer-events-none absolute h-px w-px opacity-0"
  />
)}
<Popover.Trigger asChild disabled={disabled}>
  <button
    ref={triggerRef} type="button" role="combobox" aria-expanded={open}
    aria-required={required || undefined} aria-invalid={invalid || undefined}
    onKeyDown={(e) => {
      if (!open && (e.key === "ArrowDown" || (e.key.length === 1 && !e.metaKey && !e.ctrlKey))) {
        e.preventDefault(); setSeed(e.key.length === 1 ? e.key : ""); setOpen(true);
      }
    }}
    …
```

#### F4. Two label styles and a dozen local `Field`s — **Medium**

- **Issue.** 346 labels use `mb-1 block text-xs font-medium text-muted`. 8 use the
  design-system `.field-label` (12 px / 550 / `text-secondary`). Both appear **side by
  side** on Project detail: "Sales executive", "Project coordinator" and "Project
  manager" (from `PersonField`) look bolder than every other label. 11 files define their
  own local `function Field` (`employees/[id]/edit-form.tsx:911`,
  `projects/[id]/edit-form.tsx:216`, `clients/[id]/edit-form.tsx`,
  `suppliers/[id]/company-form.tsx`, …). The shared `components/form/Field.tsx` is used
  once. None of them wire `aria-describedby` to help or error text.
- **Fix.** (1) Make `.field-label` match the majority look, or the reverse, and decide
  once. (2) Upgrade the shared `Field` to own id/describedby wiring and migrate the 11
  local copies. Most call sites keep the same props.

```tsx
// components/form/Field.tsx — after
export function Field({ label, children, required, help, error, wide, className }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : help ? `${id}-help` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: (children.props as { id?: string }).id ?? id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required,
      })
    : children;
  return (
    <div className={cn(wide && "sm:col-span-2", className)}>
      <label htmlFor={id} className="field-label">
        {label}{required && <span className="ml-0.5 text-[var(--error)]" aria-hidden>*</span>}
      </label>
      {control}
      {error ? <p id={`${id}-err`} role="alert" className="field-error">{error}</p>
        : help ? <p id={`${id}-help`} className="field-help">{help}</p> : null}
    </div>
  );
}
```

#### F5. Long record forms: always editable, always "Save changes" — **Medium**

- **Issue.** The Employee page's sticky footer (`employees/[id]/edit-form.tsx:795-832`)
  renders "Save changes" on a pristine visit. That contradicts `docs/design-system.md` ("only
  shows when … dirty") and re-implements `FormSaveBar` inline. The Overview tab is about 100
  fields with no in-page section nav. The header repeats "No company" three times and the
  mobile number twice.
- **Fix.** Use `FormSaveBar` with `dirty`. Add a sticky left mini-TOC (Status · Identity
  · Passport · Emirates ID · Visa · … · Pay) with `scrollIntoView`. Remove repeated
  facts from the header cards.

#### F6. Quotation line items — **Medium**

- **Issue (visible at 1440).** Six inputs share a `sm:grid-cols-6` row in a 768 px
  column, so placeholders truncate to "OT ra" and "H". Rates carry ± steppers (useless
  for currency). There are no column headers, no line totals and no subtotal/VAT/total.
  Nationality is free text although `CountrySelect` exists. "Create Quotation" is disabled
  with no reason given.
- **Fix.** A table-form editor with headers, live totals, Enter-to-add-row and a reason
  next to the disabled submit.
- **Files.** `src/app/(app)/sales/quotations/new/quotation-form.tsx:148-195`

```tsx
// after (sketch)
<table className="w-full text-sm">
  <thead><tr>
    <th>Trade</th><th className="w-20 text-right">Qty</th><th className="w-28 text-right">Rate (AED/h)</th>
    <th className="w-28 text-right">OT rate</th><th>Nationality</th><th className="w-20 text-right">Hours/day</th>
    <th className="w-28 text-right">Line total</th><th><span className="sr-only">Actions</span></th>
  </tr></thead>
  <tbody>{lines.map((l, i) => (
    <tr key={l.id}>
      <td><Select aria-label={`Line ${i + 1} trade`} … /></td>
      <td><input inputMode="numeric" aria-label={`Line ${i + 1} quantity`} className="input tabular text-right" … /></td>
      <td><input inputMode="decimal" aria-label={`Line ${i + 1} rate`} className="input tabular text-right" … /></td>
      …
      <td className="tabular text-right font-medium">{aed(lineTotal(l))}</td>
      <td><Button variant="dangerGhost" size="sm" iconOnly aria-label={`Remove line ${i + 1}`}><Trash2 /></Button></td>
    </tr>))}
  </tbody>
  <tfoot><tr><td colSpan={6} className="text-right text-muted">Monthly total</td>
    <td className="tabular text-right font-semibold">{aed(total)}</td><td /></tr></tfoot>
</table>
{!clientId && <p className="field-help">Pick a client to create the quotation.</p>}
```

#### F7. Employee wizard — **Medium** (carried over)

Still 8 steps with **both** "Trades & notes" and "Notes" (`employees/new/wizard.tsx:46-55`),
and the step bar wraps (QW16). The draft banner reads "Not saved yet. Your work is saved
automatically as you go." next to a "Save as draft" button, which is contradictory. Say
"Draft saved 2 min ago" after the first autosave and drop the button. The document pack uses
the native file input although `FileDrop` exists. "Previous" shows disabled on step 1; hide it.

#### F8. Demand detail order — **Medium** (carried over)

`demand/[id]/page.tsx` still leads with Remarks + Save, then Supplier offers, then
**Trades** (the actual work). "Create NOC" (primary) and "Delete Request" sit together.
Each trade shows "Not approved" **and** "Awaiting approval". "0 idle Steel Fixer" renders
as a green success chip although zero is the bad case. Reorder to trades → offers →
remarks, move Delete into an overflow menu, and colour idle counts by sufficiency.

### 5. Modals, dialogs & destructive actions

#### M1. `ConfirmDialog` closes before the action and swallows failures — **High**

- **Issue.** `ui/ConfirmDialog.tsx:38-41` closes, then `await onConfirm()`. There's no
  pending state, no error path and no success toast. The danger button is a raw
  `bg-red-600 rounded-lg` instead of the `danger` variant. There's no typed confirmation,
  although `docs/design-system.md` describes one. `DeleteButton` (44 call sites) inherits all of this.
- **Fix.**

```tsx
// ui/ConfirmDialog.tsx — after
const [pending, setPending] = useState(false);
const [error, setError] = useState<string | null>(null);
const [typed, setTyped] = useState("");
const toast = useToastActions();
…
<DialogContent title={title} description={description}>
  {confirmText && (
    <Field label={`Type ${confirmText} to confirm`}><Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus /></Field>
  )}
  {error && <p role="alert" className="field-error">{error}</p>}
  <DialogFooter>
    <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
    <Button
      variant={danger ? "danger" : "primary"}
      loading={pending}
      disabled={!!confirmText && typed !== confirmText}
      onClick={async () => {
        setPending(true); setError(null);
        try { await onConfirm(); setOpen(false); if (successMessage) toast.success(successMessage); }
        catch (e) { setError(e instanceof Error ? e.message : "That didn't work. Nothing was changed."); }
        finally { setPending(false); }
      }}
    >{confirmLabel}</Button>
  </DialogFooter>
</DialogContent>
```

#### M2. Nine `window.confirm` calls remain — **Medium**

`letter-templates/[id]/template-editor.tsx:127-128`, `payroll/loans/loans-board.tsx:224`,
`approvals/approvals-board.tsx:250` (approving **payroll** and **bank-detail changes**
through a browser `confirm()`), `settings/developers/developers-manager.tsx:212`,
`settings/developers/webhooks-manager.tsx:160-161`, `suppliers/contacts/contacts-board.tsx:45`.
Route all of them through `ConfirmDialog`. The payroll and bank cases deserve a summary
(amount, count, payee) in the dialog body.

#### M3. Destructive actions at rest — **Medium**

Trash icons show at rest on every Supplier-bill row beside **Pay**. "Delete" is the only
action in the Project and Client headers. "Remove" outline-red buttons sit on every
quotation line and batch-edit range. Use a row overflow menu (`⋯`) for delete on records
with financial history. Keep `dangerGhost` icon buttons only for disposable rows (draft
lines, ranges).

### 6. Feedback & micro-interactions

#### FB1. One feedback channel — **High**

- **Issue.** Toasts are used in **3** files (employee/client delete + deactivate). About
  60 components set inline status strings (`setResult`, `setNote`, `setStatusResult`
  …), mostly without `role="status"`. `FormValidation` builds its own fixed-position DOM
  notice with inline styles (`components/FormValidation.tsx:8-20`). Server-action errors
  render in yet more styles (`text-red-600`, `text-[var(--error)]`, bordered boxes).
- **Fix.** The rule: **inline for field errors, toast for outcomes.** Route
  `FormValidation.notify` through the toast host (expose a tiny global `toast()` event
  bridge, since it runs outside React). Add a `useActionFeedback(action, { success })`
  helper that wraps `useTransition`, returns `pending`, and toasts `{ error }` / `{ ok }`
  results. Add an **Undo** action slot to toasts for reversible bulk actions
  (deactivate, mark paid).
- **Files.** `src/components/ui/Toast.tsx`, `src/components/FormValidation.tsx`, every `*-board.tsx` / `*-form.tsx` with local result state.

#### FB2. `Button` has no loading state — **Medium**

57 call sites hand-roll `{pending ? "Saving…" : "Save"}`. The label swap changes button
width and there's no spinner. Add `loading` to `Button`:

```tsx
// ui/Button.tsx — add
loading?: boolean;
…
<button … disabled={rest.disabled || loading} aria-busy={loading || undefined} className={cn(classes, loading && "relative text-transparent")}>
  {children}
  {loading && <Loader2 className="absolute h-4 w-4 animate-spin text-current [color:inherit]" aria-hidden />}
</button>
```

#### FB3. Empty states that dead-end — **Medium**

Plain `<p className="empty-state">` messages without actions remain on Client Timesheet
(`page.tsx:193-200`), Camps ("add one below", while the form sits permanently on the page),
Documents and others. Use `EmptyState` with a primary action everywhere. Only 19 files
use it today.

#### FB4. Toast host details — **Low**

No hover-to-pause, no cap on the stack, and it shares the bottom-right corner with the
assistant button (QW12).

### 7. Accessibility

Automated (axe, 36 routes, desktop) plus manual findings, ranked:

| Severity | Rule / issue | Count | Where | Fix |
|---|---|---|---|---|
| Critical | `button-name`: unlabelled Radix checkboxes | 10 | `/accommodation/checkin` | `ariaLabel={\`Select ${name}\`}` |
| Critical | `label`: file inputs and fields without labels | 10 on 3 routes | `/settings/company` (7), `/suppliers/[id]` (2), `/clients/[id]` (1) | Wrap in `Field` / add `aria-label` |
| Serious | `aria-progressbar-name` | 21 on 5 routes | dashboard, demand, projects, clients, import | `aria-label="Allocated 4 of 16"` |
| Serious | `color-contrast` | 21 on 8 routes | Treemap labels `text-white/80` 10 px on brand (4.04:1), `/employees` (9) | Solid white, ≥ 11 px |
| Serious | `link-in-text-block`: brand links distinguished by colour only (1.1:1 vs surrounding text) | 2 | `/finance`, `/suppliers/[id]` | Underline inline links |
| Serious | `definition-list` / `dlitem` | 7 | Employee header `HeaderFact` (`<dl>` children wrapped in extra `div > span`) | `<div><dt/><dd/></div>` only |
| Serious (manual) | No skip link; 38 tab stops | all | see N1 | |
| Serious (manual) | Dark-mode contrast: white on `--brand-primary` **3.29:1** (all primary buttons), white on `--warning` **2.0:1** / `--error` **2.92:1** (nav badges) | all | `globals.css` dark blocks | see DS4 |
| Moderate (manual) | Input borders **1.43:1** against white (WCAG 1.4.11 asks 3:1 for a control's identifying boundary) | all forms | `--border-strong` | `--border-input` token, see DS4 |
| Moderate | `region`: content outside landmarks (assistant FAB, toasts) | 36 | shell | Wrap in `<aside aria-label="Assistant">` |
| Minor | `empty-table-header` | 12 on 9 routes | hand-rolled tables' action column | `<span className="sr-only">Actions</span>` |
| Manual | Tablist misuse: `role="tab"` on `<Link>`s with no `tabpanel` | — | `approvals-board.tsx:143-147` | Use `aria-current` on links, or real tabs |
| Manual | Colour-only state: attendance calendar cells, timesheet cell tints | — | `attendance-calendar.tsx`, grid | Add an icon or text (✓, "A", "—") |

---

## Design system & architectural suggestions

### DS1. Collapse the two button systems into one

Today there are two definitions: `.btn*` in `globals.css` (13 px / weight 550 / h-9, 403
uses) and `<Button>` (14 px / weight 500 / h-9, 10 files). They look nearly but not
exactly alike. There are also about **36** ad-hoc "outline success / outline danger"
buttons (`rounded-lg border border-[var(--success-border)] …`).

- Make `<Button>` render the `.btn` classes, so there's one source of truth and the CSS
  stays the definition for legacy markup.
- Add `successOutline` and `dangerOutline` variants plus `loading`.
- Add an ESLint `no-restricted-syntax` rule that flags `className` strings combining
  `rounded-lg` with a hand-written success or error border colour, to stop new copies.

### DS2. One status registry

There are 10 local `STATUS_COLOR` maps (quotations ×2, projects ×2, demand, transport,
instant view, client timesheet, webhooks, enquiries). They disagree: `ON_HOLD` is red on
projects, and the same status renders in three casings. Centralise:

```ts
// src/lib/status.ts
import type { BadgeColor } from "@/components/Badge";
type Def = { label: string; tone: BadgeColor };
export const STATUS = {
  project:   { ACTIVE: { label: "Active", tone: "green" }, PLANNING: { label: "Planning", tone: "blue" }, ON_HOLD: { label: "On hold", tone: "amber" }, COMPLETED: { label: "Completed", tone: "slate" } },
  quotation: { DRAFT: { label: "Draft", tone: "slate" }, SENT: { label: "Sent", tone: "blue" }, NEGOTIATION: { label: "Negotiating", tone: "amber" }, ACCEPTED: { label: "Accepted", tone: "green" }, REJECTED: { label: "Rejected", tone: "red" }, CONVERTED: { label: "Converted", tone: "green" } },
  timesheet: { DRAFT: { label: "Draft", tone: "slate" }, SUBMITTED: { label: "Submitted", tone: "blue" }, UNDER_REVIEW: { label: "In review", tone: "amber" }, CLIENT_APPROVED: { label: "Client approved", tone: "green" }, REJECTED: { label: "Rejected", tone: "red" }, LOCKED: { label: "Locked", tone: "navy" } },
  // …vehicle, demand, client, supplier, bill
} satisfies Record<string, Record<string, Def>>;

export function formatStatus(raw: string) {
  return raw.toLowerCase().split("_").join(" ").replace(/^\w/, (c) => c.toUpperCase());
}
```

```tsx
// src/components/StatusBadge.tsx
export function StatusBadge<K extends keyof typeof STATUS>({ kind, value, dot = true }: { kind: K; value: string; dot?: boolean }) {
  const def = (STATUS[kind] as Record<string, Def>)[value];
  return <Badge color={def?.tone ?? "slate"} dot={dot}>{def?.label ?? formatStatus(value)}</Badge>;
}
```

Rename `BadgeColor` keys from hues (`green/amber/red/blue`) to intents
(`success/warning/danger/info/neutral/brand`). That stops "green" being used for "0 idle".

### DS3. Make the type scale real

Fourteen sizes render inside `<main>` (12, 13, 11.5, 11, 14, 15, 24, 30, 10, 10.5, 28,
16, 32, 8 px), and the source has **177** arbitrary `text-[Npx]` classes (`text-[11px]` ×73,
`text-[10px]` ×48, `text-[13px]` ×30). The `--text-*` scale is opt-in and Tailwind's
`text-sm` (14 px) silently differs from `--text-sm` (13 px). The unlayered normalisation
rules (`main h1.text-xl`, `main h2.text-sm.font-semibold`, `main table > thead …`) patch
symptoms with specificity.

1. Remap Tailwind's scale to the tokens inside `@theme` (Tailwind v4 reads `--text-*`
   there), so `text-xs/sm/base/lg` **are** the design scale:
   ```css
   @theme inline {
     --text-2xs: 0.6875rem;  /* 11px — table headers, eyebrows, badges */
     --text-xs: 0.75rem;     /* 12px */
     --text-sm: 0.8125rem;   /* 13px — body, cells */
     --text-base: 0.875rem;  /* 14px — controls */
     --text-lg: 1rem;        /* 16px — card titles */
     --text-xl: 1.5rem;      /* 24px — page titles */
     --text-2xl: 1.875rem;   /* 30px — KPIs */
   }
   ```
   Roll out behind a screenshot diff of the 36-route sweep (Appendix C). That is exactly
   the "too high-risk to do blind" step Phase 1 deferred, and it no longer has to be blind.
2. Codemod `text-[10px]`, `text-[10.5px]` and `text-[11px]` → `text-2xs`; `text-[13px]`
   and `text-[13.5px]` → `text-sm`. Ban `text-[` via lint, with an allowlist for the
   letter/PDF preview components.
3. Delete the normalisation block once `PageHeader`/`Section`/`DataTable` cover those
   elements.

### DS4. Token additions and fixes

| Token | Light | Dark | Why |
|---|---|---|---|
| `--border-hover` | `#c3c8d4` | `#454b58` | Replaces 4 hard-coded hex hovers (QW5) |
| `--border-input` | `#8a92a0` (3.13:1) | `#5f6778` (3.18:1) | Non-text contrast for field edges; keep `--border-strong` for dividers |
| `--brand-solid` / `--on-brand` | `#5645d4` / `#fff` | `#6455d0` (white 5.60:1) / `#fff` | Filled buttons, active pagination, badges. Keep `--brand-primary #8b7ff0` in dark for text and icons |
| `--on-warning` / `--on-error` | `#fff` | `#1a1100` (9.35:1) / `#0b0d12` (6.65:1) | Text on solid status fills (nav count badges) |
| `--overlay` | `rgb(16 24 40 / .4)` | `rgb(0 0 0 / .6)` | Replaces `bg-[#101828]/40` in `Dialog.tsx` and `mobile-sidebar.tsx` |
| `--radius-overlay` | `var(--radius-xl)` | — | Fixes the undefined `rounded-overlay` (QW13) |
| `--row-danger` / `--row-warning` | `color-mix(in oklab, var(--error-soft) 60%, transparent)` | same formula | Compliance row tints (QW6) |

Also: `docs/design-system.md` says radii are 8/10/14 px while `globals.css` ships
9/12/16. Update the doc. And the `.theme-force-light` block plus two dark blocks repeat
every value three times. Generate them from one source (a small PostCSS mixin, or keep
dark values in `@media` only and have `[data-theme=dark]` reuse them via
`@custom-media`/`light-dark()` once support is acceptable) so they can't drift.

### DS5. Layout primitives

Add `ListPage`, `DetailPage` and `FormPage` wrappers that fix width, header, tabs slot,
save-bar slot and the KPI/insight placement rules from T1/N5. Most of the
inconsistency (widths, back links vs breadcrumbs, tab position, primary-action
placement, such as "Add bill" sitting below the tabs instead of in the header) disappears
when pages can't choose.

### DS6. Shared formatters

There are 55 locally defined money formatters and 31 date formatters. Dates render as
`2026-09-03` (Supplier bills), `15/07/2026` (DatePicker), `Tue, 13 October 2026`
(dashboard), `3 Sept 2026` (projects) and `17d ago` (demand). Add `src/lib/format.ts`
with `money(n, { currency })`, `date(d, "short" | "long" | "relative")` and
`number(n)`, all fixed to `en-GB` + `Asia/Dubai`, and replace the local helpers.
`attendance/page.tsx:20-22` derives "this month" in **UTC**, which picks the wrong month
for Dubai between 00:00 and 04:00 on the 1st.

### DS7. Guardrails so this doesn't regress

- **ESLint:** `no-restricted-syntax` for `window.confirm`/`confirm(`, raw palette
  classes (`/(bg|text|border)-(red|amber|emerald|…)-\d{2,3}/`), `text-[Npx]`, hex
  colours in `className`.
- **Visual check in CI:** the sweep script from this review (Playwright + axe) against a
  seeded Postgres service container. Fail on new axe violations of serious/critical impact.
- **A `/brand` gallery for every primitive state** (default, hover, focus, disabled,
  invalid, loading, dark), so reviews can happen without logging into a module.

---

## Suggested sequencing

| Sprint | Theme | Items |
|---|---|---|
| 1 | Bugs + quick wins | QW1–QW17, T2, F3, M1 |
| 2 | Daily data entry | F1 (grid), F2 (attendance), T4 (filters on change), FB1 (feedback channel) |
| 3 | System | DS1, DS2, DS4, F4 (`Field`), FB2 (`loading`) |
| 4 | Page anatomy | T1 (list first), N5 + DS5 (detail/list/form layouts), F5, F8 |
| 5 | Scale-out | T7 (`DataTable` rollout), DS3 (type scale with screenshot diff), N2/N3 (IA), N6 (mobile) |

---

## Appendix A — measured sweep

Viewport 1440×900 (D) and 390×844 (M); dev build, so load times are indicative only.
`ovf` = horizontal document overflow in px. `<24` = interactive elements in `<main>`
smaller than 24 px in either dimension. `row1` = y of the first `<tbody>` row (null = no table).

| Route | ovf D | ovf M | <24 D | <24 M | row1 D | row1 M |
|---|---|---|---|---|---|---|
| `/` | 0 | **116** | 24 | 8 | 2242 | 4024 |
| `/employees` | 0 | 0 | **87** | 26 | **879** | 1581 |
| `/employees/new` | 0 | 0 | 2 | 2 | — | — |
| `/employees/[id]` | 0 | 0 | 9 | 7 | — | — |
| `/employees/renewals` | 0 | **536** | 26 | 26 | 720 | 1153 |
| `/documents` | 0 | 0 | 2 | 2 | — | — |
| `/demand` | 0 | 0 | 14 | 6 | 252 | 338 |
| `/demand/[id]` | 0 | 0 | 1 | 0 | — | — |
| `/demand/mobilisation` | 0 | 0 | 8 | 4 | 313 | 378 |
| `/projects` | 0 | 0 | 33 | 0 | 452 | 890 |
| `/projects/[id]` | 0 | 0 | 13 | 11 | 1444 | 2369 |
| `/clients` | 0 | 0 | 36 | 16 | 729 | 1411 |
| `/clients/[id]` | 0 | 0 | 4 | 2 | 2163 | 3262 |
| `/suppliers` | 0 | 0 | 24 | 10 | 549 | 939 |
| `/accommodation/checkin` | 0 | 0 | 10 | 10 | 385 | 769 |
| `/finance/bills` | 0 | 0 | 4 | 4 | 690 | 867 |
| `/finance/expenses` | 0 | 0 | 2 | 0 | 654 | 1041 |
| `/sales/quotations` | 0 | 0 | 10 | 0 | 203 | 302 |
| `/approvals` | 0 | 0 | 11 | 11 | — | — |
| `/settings/company` | 0 | 0 | 8 | 7 | — | — |
| `/trades` | 0 | 0 | 8 | 2 | 411 | 780 |
| `/onboarding` | 0 | 0 | 16 | 0 | 646 | 1578 |
| `/data-health` | 0 | 0 | 35 | 1 | **965** | 1506 |

Routes with nothing notable: `/demand/new`, `/accommodation/camps`, `/attendance`,
`/invoices/client-timesheet`, `/invoices`, `/payroll`, `/finance`,
`/sales/quotations/new`, `/audit-log`, `/inventory`, `/transport`, `/import`.

**Rendered font sizes in `<main>` (desktop, all routes):** 12 px ×1322 · 13 ×1056 ·
11.5 ×302 · 11 ×177 · 14 ×78 · 15 ×65 · 24 ×52 · 30 ×47 · 10 ×26 · 10.5 ×26 · 28 ×20 ·
16 ×8 · 32 ×3 · 8 ×2.

**Tab order (`/employees`):** Open My Assistant → logo → Collapse sidebar → branch card
→ Dashboard → *Pin Dashboard* → Approvals → *Pin Approvals* → Drafts → *Pin Drafts* →
Workforce → Employees → *Pin Employees* → … → first `<main>` control at stop **39**.

## Appendix B — source metrics

| Metric | Count | Command (from `src/`) |
|---|---|---|
| Pages under `(app)` | 117 | `find "app/(app)" -name page.tsx \| wc -l` |
| `loading.tsx` | 28 | `find app -name loading.tsx` |
| Files with `<table>` (app) | 76 | `grep -rl "<table" app` |
| `DataTable` users | 11 | `grep -rl "<DataTable" app` |
| `<Button>` users / `.btn` class uses | 10 / 403 | |
| `Field` / `Section` / `FormSaveBar` users | 1 / 1 / 2 | |
| Local `function Field` definitions | 11 files | `grep -rnE "^function (Field\|Label)" app` |
| Hand-rolled label string | 346 | `mb-1 block text-xs font-medium text-muted` |
| Arbitrary `text-[Npx]` | 177 | |
| Raw palette classes (excl. marketing/login) | 75 in 16 files | |
| Hex colours in app/components TSX | 120 | |
| Toast users | 3 | `grep -rl useToastActions app` |
| `window.confirm` / `confirm(` | 9 | |
| `aria-invalid` | 5 | |
| Local money / date formatters | 55 / 31 | |

## Appendix C — reproducing this review locally

```bash
pg_ctlcluster 16 main start
su postgres -c "psql -c \"CREATE USER app WITH PASSWORD 'app' SUPERUSER;\"" && su postgres -c "createdb -O app erp"
export DATABASE_URL=postgresql://app:app@localhost:5432/erp
npx prisma db push            # see note below — `migrate deploy` fails on an empty DB
npx tsx prisma/seed.ts        # demo@manpowersync.com / changeme123
psql "$DATABASE_URL" -c "INSERT INTO \"Branch\"(id,code,name,emirate,\"isActive\") VALUES ('br_main','MAIN','Demo Branch','Dubai',true)"
psql "$DATABASE_URL" -c "UPDATE \"User\" SET \"branchId\"='br_main'"
mv prisma/scripts/demo-data-manifest.json /tmp/   # the seeder refuses to run while a manifest exists
APPLY=1 npx tsx prisma/scripts/seed-demo-data.ts
git checkout -- prisma/scripts/demo-data-manifest.json
SESSION_SECRET=$(openssl rand -hex 32) npx next dev -p 3100
```

**Setup blockers found on the way (not UI, but they stop anyone from doing this review):**

1. `prisma migrate deploy` fails on a fresh database:
   `20260821110000_employee_notes/migration.sql:8` runs
   `ALTER TABLE "Employee" DROP COLUMN "historyRemarks"`, but no earlier migration
   creates that column. Production presumably got it via `db push`. Use
   `DROP COLUMN IF EXISTS`, or add the missing `ADD COLUMN` migration.
2. `prisma/seed.ts` creates no `MAIN` branch, but `seed-demo-data.ts:76` requires one.
3. `prisma/scripts/demo-data-manifest.json` is committed, so the demo seeder refuses to
   run on any fresh clone. Move it to `.gitignore`.
