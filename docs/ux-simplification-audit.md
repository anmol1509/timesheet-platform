# UX Simplification & Usability Audit

_13 Oct 2026 · code read at `353a40d` · follows on from [`redesign-audit.md`](./redesign-audit.md) (23 Sept) and its six phase changelogs_

## How this was done, and what it isn't

- **Read from the code, not clicked through.** This container has no login credentials and no
  `node_modules`, so nothing here was rendered or submitted. Every finding cites the file and
  line it comes from. Where a finding is about behaviour, such as "this button silently does
  nothing", the code path is traced in the text so you can check it yourself.
- **Scope:** the authenticated app shell (`src/app/(app)/layout.tsx`, `app-shell.tsx`,
  `nav-links.tsx`), global search (`CommandPalette.tsx`, `api/search/route.ts`), the shared
  form, table and feedback primitives, and the highest-traffic flows: employee registration,
  raise demand, add project/client, manual and grid timesheet entry, list pages, detail pages
  and approvals.
- **Builds on the September audit rather than repeating it.** Phases 1–6 already shipped a lot:
  the ⌘K palette, a single active sidebar row, `loading.tsx` on every route, a top progress bar,
  a save bar that only appears once something changed, sticky timesheet headers, dark mode and
  draft persistence (`DraftBar`). Items that audit raised but that are **still open in the code
  today** are re-raised here with current line numbers. Everything else is new.

### Measured across `src/app/(app)` (117 pages)

| Signal | Count | What it means |
|---|---|---|
| Pages using `PageHeader` | 83 / 117 | Good progress. The other 34 hand-roll their title. |
| Pages passing `breadcrumbs` | **9** | Most pages have no "where am I" trail. 25 use a bare `← Back` link instead. |
| Local copies of a `Field` label helper | **11** | `components/form/Field.tsx` (which has `error` and `help` slots) is used by **1** file. |
| Hand-rolled `<table>` vs `DataTable` users | **71** vs 12 | Each hand-rolled table re-implements search, sort and empty state, or skips them. |
| `useToast` callers | **4** | Most mutations report through inline text, or not at all. |
| `window.confirm` / `confirm()` still in use | **7** | These sit beside 10 users of the styled `ConfirmDialog`. |
| Filter forms with a "Go" submit button | **4** | `QuerySelect`, which applies on change, already exists and is used on dashboards. |
| Links that pre-fill a create form from context (`/demand/new?…`, `/projects/new?…`) | **0** | Every create form starts blank, even when opened from the parent record. |
| Real keyboard shortcuts | ⌘K, `?`, Esc, plus an undocumented `j`/`k` on Approvals | |

---

## 1. UX Simplification Strategy

The app is no longer short on features or visual polish. The September pass fixed most of the
visual problems. What still costs time is **friction between steps**: forms that start blank when
the app already knows the answer, filters you have to submit, state lost on Back, and failures
that say nothing. Five principles, in priority order:

1. **Nothing fails silently.** Fix trust breakers before adding features. Today *Raise Demand*
   can spin and then do nothing (§3.C1). Super-admins on "All branches" can fill an 8-step wizard
   that cannot save (§3.H). Required-field errors show as a native browser bubble that disappears
   on the next click (§3.D1). Each of these teaches people not to trust the button.

2. **The record you came from fills in the form you open.** The app already knows the context:
   a project knows its client, an employee knows their trade, supplier and rate, and a picked
   company can generate an ID. Use that to cut fields, not just to validate them. Concretely:
   - "Raise demand" from a project page arrives with client and project already set.
   - Picking an employee in manual timesheet entry fills name, trade, rate and supplier.
   - A demand asks for **project** only, because the client follows from the project.

3. **One way to do each thing.** The primitives exist (`form/Field`, `FormSaveBar`,
   `ConfirmDialog`, `EmptyState`, `DataTable`, `QuerySelect`, `PageHeader`) but adoption is
   uneven: 11 private `Field` copies, 71 private tables, 3 different confirm styles. Every
   divergent copy is a place where required markers, inline errors or empty states are
   missing. Converge on the primitives and the gaps close as a side effect.

4. **State survives navigation.** Filters, search text, sort, page, the active tab and column
   choices belong in the URL or in per-viewer storage. They should not live in component state
   that resets on Back. Unsaved edits should be guarded on in-app navigation too, not only on
   tab close.

5. **Repetitive work is keyboard-first.** Daily attendance, the client timesheet grid and the
   approvals queue are done many times a day. They should be operable without the mouse, and
   every shortcut that exists should be discoverable from `?`.

---

## 2. Immediate Usability Wins

Small, self-contained changes. Most touch one file and none change a server action's
contract.

| # | Win | Where | Effort |
|---|---|---|---|
| 1 | **Raise Demand: say why it's disabled, and stop the silent no-op.** Mark Client/Project required, list what's missing under the button, and have the action return `{ error }` instead of a bare `return` when no trade row is complete. | `demand/new/demand-request-form.tsx:177-184`, `demand/actions.ts:45,72` | S |
| 2 | **Replace the four "Go" buttons with `QuerySelect`** so filters apply on change. | `invoices/client-timesheet/page.tsx:156-183`, `invoices/page.tsx:127-136`, `companies/page.tsx:60,96-104`, `companies/employees/page.tsx:35-38` | S |
| 3 | **Parallelise the shell's two trailing awaits.** `countPendingApprovals` and `supplierTicket.count` run one after the other, *after* the `Promise.allSettled`. Each sequential round-trip adds to every page's TTFB. | `(app)/layout.tsx:64,69` | XS |
| 4 | **⌘K: show Records first while searching, and stop promising invoices.** The trigger says "Search employees, projects, documents, invoices…", but invoices aren't searched. Records also render *after* ~45 Page rows. | `CommandPalette.tsx:217-276, 376` | XS |
| 5 | **⌘K "Recent" should record every visit**, not only those made through the palette. `pushRecent` is only called from `go()`, so a record opened from a list never appears. | `CommandPalette.tsx:148-153` | S |
| 6 | **Document the `j`/`k` keys** Approvals already supports in the `?` sheet. | `ShortcutsSheet.tsx:7-23`, `approvals/approvals-board.tsx:125` | XS |
| 7 | **`autoFocus` the first field** on Add Project, Add Client, Raise Demand and the wizard's Identity step. None of the primary create forms do this today. | `projects/new/new-project-form.tsx:51`, `clients/new/page.tsx:43`, `employees/new/wizard.tsx:1137` | XS |
| 8 | **Auto-generate the Employee ID** when a company is picked and the ID is still blank, instead of requiring a click on *Generate*. | `employees/new/wizard.tsx:481, 1098-1118` | S |
| 9 | **Add Project: don't silently pick the first client.** `defaultValue={clients[0]?.id}` files the project under whichever client sorts first. Read `?clientId=` and otherwise leave the field empty and required. | `projects/new/new-project-form.tsx:69`, `projects/new/page.tsx` | XS |
| 10 | **"All branches" banners → an inline branch picker.** Ten pages say "pick a branch from the switcher (top right)", but the switcher is `hidden sm:block`, so it doesn't exist on phones. `/employees/new` also renders the full wizard under the banner. | `employees/new/page.tsx:36-56`, `layout.tsx:97-101`, and the 9 others in §3.H | S |
| 11 | **`ConfirmDialog` stays open while the action runs** and shows its error. Today it closes *before* `onConfirm` resolves, so a failed delete looks like a successful one. | `components/ui/ConfirmDialog.tsx:38-41` | S |
| 12 | **Swap the last 7 `window.confirm` calls** for `ConfirmDialog`. | `letter-templates/[id]/template-editor.tsx:127-128`, `payroll/loans/loans-board.tsx:224`, `approvals/approvals-board.tsx:250`, `settings/developers/developers-manager.tsx:212`, `settings/developers/webhooks-manager.tsx:160-161`, `suppliers/contacts/contacts-board.tsx:45` | S |
| 13 | **Project status reads "active"/"on hold" in lowercase.** Use the same label map the edit form uses. | `projects/[id]/page.tsx:80-82` | XS |
| 14 | **Sticky ID column is `bg-white`** in manual timesheet entry, so it shows a white strip in dark mode. Use `bg-surface`. | `invoices/client-timesheet/new/manual-entry-form.tsx:184` | XS |

---

## 3. Workflow-by-Workflow Recommendations

### A. Global Search & Command Palette

**A1. Records are buried under Pages, and search covers less than the box claims**

- **Friction point**
  - The palette renders Recent → Actions → Pages → Records. Typing "ahmed" fuzzy-matches
    several Page labels first, so the employee you wanted sits below a scroll.
  - The header trigger promises *invoices*, but `/api/search` only queries employees, projects,
    clients, suppliers and document filenames.
  - Employees are only matched on name, ID and trade. A passport number, Emirates ID or phone
    number (the things people actually have in hand when a worker turns up) returns nothing.
  - Nothing finds demand **#123**, an invoice number, or a camp.
  - Each type is capped at 5 results with no "see all".
- **Simplified UX proposal**
  - While a query is ≥ 2 characters, show **Records first**, then Actions/Pages that match.
  - Widen the API to the identifiers people paste: passport, Emirates ID, mobile number,
    invoice number, `#requestNo` and camp name. Gate each type on the module permission
    already used for its page.
  - Add a "See all n employees matching '…'" row that opens `/employees?q=…`. This depends on
    E2, which puts table search in the URL.
  - Make the hint text match what is actually searched.
- **File paths**
  - `src/components/CommandPalette.tsx`
  - `src/app/api/search/route.ts`
  - `src/lib/permissions.ts` (module keys `demand`, `billing`, `facilities` already exist)
- **Code example**

*Before:* `CommandPalette.tsx:217-276`. Records always come last.
```tsx
<Command.Group heading="Actions">…</Command.Group>
<Command.Group heading="Pages">{pages.map(…)}</Command.Group>
{hasRecords ? <Command.Group heading="Records">…</Command.Group> : …}
```

*After:* while searching, records lead and navigation follows.
```tsx
const searching = query.trim().length >= 2;

{searching && hasRecords && <RecordsGroup results={results} onGo={go} />}
{!searching && recent.length > 0 && <RecentGroup recent={recent} onGo={go} />}
<ActionsGroup actions={allowedActions} onGo={go} />
<PagesGroup pages={pages} onGo={go} />
```

*Before:* `api/search/route.ts:33-44`. Employees match on name, ID and trade only.
```ts
OR: [
  { name: { contains: q, mode: "insensitive" } },
  { employeeIdNo: { contains: q, mode: "insensitive" } },
  { trade: { contains: q, mode: "insensitive" } },
],
```

*After:* match the identifiers people have in hand, and add demands and invoices.
```ts
const digits = q.replace(/\D/g, "");
OR: [
  { name: { contains: q, mode: "insensitive" } },
  { employeeIdNo: { contains: q, mode: "insensitive" } },
  { trade: { contains: q, mode: "insensitive" } },
  { passportNumber: { contains: q, mode: "insensitive" } },
  ...(digits.length >= 4
    ? [{ emiratesId: { contains: digits } }, { mobileNumber: { contains: digits } }]
    : []),
],

// "#123" or "123" → demand request number
const requestNo = /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : null;
canDemand && requestNo
  ? prisma.demandRequest.findMany({ where: { ...scope, requestNo }, take: 1, select: { id: true, requestNo: true, client: { select: { name: true } } } })
  : Promise.resolve([]),
canBilling
  ? prisma.clientInvoice.findMany({ where: { invoiceNumber: { contains: q, mode: "insensitive" }, client: scope }, take: RESULT_LIMIT, select: { id: true, invoiceNumber: true, client: { select: { name: true } } } })
  : Promise.resolve([]),
```

**A2. "Recent" only remembers palette navigations**

- **Friction point:** `pushRecent` runs only inside `go()` (`CommandPalette.tsx:148`). The
  usual path is list → row → record, and it never lands in Recent. So "get back to the worker I
  had open ten minutes ago" means searching again.
- **Simplified UX proposal:** record each route commit once, from the shell, using the page's
  `<h1>` as the label. Records have no `metadata` title, while 37 pages do.
- **File paths:** `src/app/(app)/app-shell.tsx`, `src/components/CommandPalette.tsx` (export
  `pushRecent`).
- **Code example**
```tsx
// app-shell.tsx: one listener for the whole app
const pathname = usePathname();
useEffect(() => {
  // Wait a frame so the new page's <h1> is in the DOM.
  const id = requestAnimationFrame(() => {
    const label = document.querySelector("main h1")?.textContent?.trim();
    if (label) pushRecent({ href: pathname, label, group: groupForPath(pathname) });
  });
  return () => cancelAnimationFrame(id);
}, [pathname]);
```

**A3. Actions are navigation in disguise**

- **Friction point:** every Action uses the same `UserPlus` icon (`CommandPalette.tsx:225`).
  "Generate an invoice" opens the invoices list, not a generator. There are no context
  actions such as "Raise demand for *this* project" or "Check in *this* employee".
- **Simplified UX proposal**
  - Give each action its module icon.
  - Add **contextual actions** registered by the current page, so on `/projects/[id]` the
    palette offers "Raise demand for Al Reem Tower".
  - Add app actions that need no page: switch branch, toggle theme, and "Copy link to this
    page".
- **Code example:** a tiny registry the page fills and the palette reads.
```tsx
// components/PageActions.tsx (client)
const PageActionsContext = createContext<(a: PaletteAction[]) => void>(() => {});
export function usePageActions(actions: PaletteAction[]) {
  const set = useContext(PageActionsContext);
  useEffect(() => { set(actions); return () => set([]); }, [set, actions]);
}

// projects/[id]/page.tsx renders <ProjectPaletteActions projectId=… name=… clientId=… />, which calls
usePageActions([
  { label: `Raise demand for ${name}`, href: `/demand/new?projectId=${projectId}`, icon: FilePlus2 },
  { label: `Add employee to ${name}`, href: `/employees/new?projectId=${projectId}`, icon: UserPlus },
]);
```

---

### B. Navigation & Wayfinding

**B1. Create actions live in the sidebar as if they were places**

- **Friction point**
  - The sidebar is long: 13 top-level entries covering about 45 destinations, plus a 9-item
    Administration group for admins (`nav-links.tsx:77-307`).
  - Several rows are verbs, not places: *Create Demand*, *Create Check-In* and *Add Candidate*.
    They take sidebar space, and the same verbs are missing everywhere else (no global "New"
    button, no prefill from context).
  - The dashboard header has three equal-weight buttons (Import, Generate, Add employee), while
    every other page has none.
- **Simplified UX proposal**
  - Move creation verbs out of the sidebar into **one header "+ New" menu**. Its items are the
    same list as the palette's `ACTIONS`, so they can't drift.
  - The sidebar becomes nouns only. *Demand* keeps "View Demands" and "Deployments", and its
    list page carries a primary "Raise demand" button.
  - This removes 3 rows outright and gives every page the same place to create from.
- **File paths:** `src/app/(app)/nav-links.tsx`, `src/app/(app)/layout.tsx` (header),
  `src/components/CommandPalette.tsx` (export `ACTIONS`).
- **Code example**

*Before:* `nav-links.tsx:129, 159, 240`. Verbs mixed into the noun list.
```ts
{ href: "/demand/new", label: "Create Demand", icon: FilePlus2 },
{ href: "/demand", label: "View Demands", icon: ListChecks, exact: true },
…
{ href: "/accommodation/checkin", label: "Create Check-In", icon: FilePlus2 },
```

*After:* one "+ New" menu in the header, fed by the shared action list.
```tsx
// layout.tsx header, beside NotificationsMenu
<QuickCreateMenu actions={CREATE_ACTIONS} allowedModules={allowedModules} />

// components/QuickCreateMenu.tsx (Radix Popover, already a dependency)
<Popover.Trigger className="btn btn-primary btn-sm gap-1.5"><Plus className="h-4 w-4" />New</Popover.Trigger>
<Popover.Content align="end" className="w-56 rounded-xl border border-default bg-surface p-1.5 shadow-modal">
  {visible.map((a) => (
    <Popover.Close asChild key={a.href}>
      <Link href={a.href} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-surface-hover">
        <a.icon className="h-4 w-4 text-subtle" />{a.label}
        {a.shortcut && <kbd className="ml-auto text-[10px] text-subtle">{a.shortcut}</kbd>}
      </Link>
    </Popover.Close>
  ))}
</Popover.Content>
```

**B2. Breadcrumbs exist but almost no page uses them**

- **Friction point**
  - `PageHeader` supports `breadcrumbs`, but only **9** pages pass them.
  - Detail and create pages instead use a lone `← Projects` / `← Clients` link (25 pages).
  - The employee detail page hand-builds its own breadcrumb (`employees/[id]/page.tsx:186-194`).
  - Create pages like `/projects/new` and `/clients/new` don't use `PageHeader` at all, so the
    title styling differs from the list page they came from.
- **Simplified UX proposal**
  - Every detail and create page renders `PageHeader` with `breadcrumbs`, built from the same
    nav data the sidebar uses. The trail then always matches the sidebar, and the record name
    is the last crumb.
  - Destructive actions move off the title row (see F2).
- **File paths:** `src/components/PageHeader.tsx`, plus
  - `projects/[id]/page.tsx:71-93`
  - `clients/[id]/page.tsx:~40-60`
  - `suppliers/[id]/page.tsx:~70-115`
  - `demand/[id]/page.tsx:~50-70`
  - `inventory/[id]/page.tsx:~58-70`
  - `projects/new/new-project-form.tsx:20-28`
  - `clients/new/page.tsx:19-30`
- **Code example**

*Before:* `projects/[id]/page.tsx:71-93`. A back link, a raw `h1`, and Delete as the only action.
```tsx
<Link href="/projects" className="text-sm text-muted hover:underline">← Projects</Link>
<div className="mt-2 flex flex-wrap items-center justify-between gap-3">
  <h1 className="text-xl …">{project.name}</h1>
  <Badge …>{project.status.replace("_", " ").toLowerCase()}</Badge>
  <DeleteButton … className="rounded-lg border border-[var(--error-border)] … text-[var(--error)]" />
</div>
```

*After:* standard header, a real trail, and the actions people take on a project.
```tsx
<PageHeader
  title={project.name}
  breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: project.name }]}
  meta={<Badge color={STATUS_COLOR[project.status]}>{STATUS_LABEL[project.status]}</Badge>}
  description={<>{project.code} · <Link href={`/clients/${project.client.id}`}>{project.client.name}</Link> · {project.employees.length} assigned</>}
  actions={
    <>
      <Link href={`/employees/new?projectId=${project.id}`} className="btn btn-secondary btn-sm">Add employee</Link>
      <Link href={`/demand/new?projectId=${project.id}`} className="btn btn-primary btn-sm">Raise demand</Link>
      <RecordMenu>{/* ⋯ menu: Delete project (ConfirmDialog) */}</RecordMenu>
    </>
  }
/>
```

**B3. Ten tabs on a project; the active tab isn't in the URL anywhere**

- **Friction point**
  - Project detail has 10 tabs: Basic Detail, Documents, Approved Rates, LPO, Holiday Details,
    Location Details, Sites, Other Details, Related Users and Inventory Details
    (`projects/[id]/page.tsx:121-229`).
  - Employee detail keeps its tab in `useState("overview")` (`employees/[id]/edit-form.tsx:213`).
    A refresh, a shared link or Back always lands on Overview.
  - The hand-rolled tab buttons aren't ARIA tabs and have no arrow-key navigation.
- **Simplified UX proposal**
  - Group the project tabs into 5: **Overview** (basic, other, location), **Commercial**
    (rates, LPO), **Sites & calendar** (sites, holidays), **People** and **Documents &
    inventory**.
  - Put the active tab in `?tab=` on both pages.
  - Use the existing `AnimatedTabs` (Radix Tabs) primitive.
- **Code example**
```tsx
// employees/[id]/edit-form.tsx
const params = useSearchParams();
const router = useRouter();
const pathname = usePathname();
const tab = params.get("tab") ?? "overview";
const setTab = (id: string) => {
  const next = new URLSearchParams(params.toString());
  if (id === "overview") next.delete("tab"); else next.set("tab", id);
  router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
};
```

---

### C. Creation Forms

**C1. Raise Demand: two dependent selects, a silent failure, and no context**

- **Friction point**
  - **Silent no-op.** If every trade row is incomplete, `handleSubmit` still fires.
    `createDemandRequestAction` filters the rows to nothing, hits `if (trades.length === 0) return;`
    (`demand/actions.ts:72`), and the client ignores the void result. The button reads
    "Raising…" and then returns to "Raise Demand" with no message.
  - **Same in "All branches" mode.** `if (!clientId || !projectId || !branchId) return;`
    (`actions.ts:45`) means a super-admin there gets the same silence.
  - **Disabled with no reason.** The button is disabled until client *and* project are picked,
    but neither field is marked required and nothing says why it's disabled.
  - **Redundant field.** Project is disabled until Client is chosen, yet a project already
    belongs to exactly one client.
  - **No context.** Opening it from a project page doesn't pre-select anything.
- **Simplified UX proposal**
  - Ask for **Project only**, as a searchable combobox labelled `CODE — Name · Client`, and
    derive the client from it.
  - Read `?projectId=` to pre-fill.
  - Show "Still needed: project, one trade" under the button instead of a silent disabled state.
  - The action returns `{ error }`, and the form shows it.
- **File paths:** `src/app/(app)/demand/new/demand-request-form.tsx`,
  `src/app/(app)/demand/new/page.tsx`, `src/app/(app)/demand/actions.ts`
- **Code example**

*Before:* `demand-request-form.tsx:46-66, 177-184`
```tsx
function handleSubmit() {
  if (!clientId || !projectId) return;
  …
  startTransition(() => { createDemandRequestAction(formData); });
}
…
<button type="button" onClick={handleSubmit} disabled={pending || !clientId || !projectId} className="btn btn-primary">
  {pending ? "Raising…" : "Raise Demand"}
</button>
```

*After:* one picker, explicit gaps, a surfaced error.
```tsx
const [projectId, setProjectId] = useState(initialProjectId ?? "");
const project = projects.find((p) => p.id === projectId);
const filledTrades = trades.filter((t) => t.trade && Number(t.quantity) > 0);
const missing = [!project && "a project", filledTrades.length === 0 && "at least one trade"].filter(Boolean);
const [error, setError] = useState<string | null>(null);

function handleSubmit() {
  if (missing.length) return;
  const fd = new FormData();
  fd.append("clientId", project!.clientId);   // derived, not asked
  fd.append("projectId", project!.id);
  …
  startTransition(async () => {
    const res = await createDemandRequestAction(fd);   // redirects on success
    if (res?.error) setError(res.error);
  });
}

<Field label="Project" required help={project ? `Client: ${clientName(project.clientId)}` : undefined}>
  <Select value={projectId} onChange={setProjectId} placeholder="Search projects…"
    options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name} · ${clientName(p.clientId)}` }))} />
</Field>
…
<div className="flex items-center gap-3">
  <button type="button" onClick={handleSubmit} disabled={pending || missing.length > 0} className="btn btn-primary">
    {pending ? "Raising…" : "Raise demand"}
  </button>
  {missing.length > 0 && <span className="text-sm text-muted">Still needed: {missing.join(" and ")}.</span>}
  {error && <span role="alert" className="text-sm text-[var(--error)]">{error}</span>}
</div>
```
```ts
// demand/actions.ts: return the reason instead of a bare `return`
if (!branchId) return { error: "Pick a branch first. A demand belongs to one branch." };
if (trades.length === 0) return { error: "Add at least one trade with a quantity." };
```

**C2. Add Project / Add Client: wrong default, no focus, duplicated field markup**

- **Friction point**
  - Add Project pre-selects `clients[0]` (`new-project-form.tsx:69`), so a hurried save files
    the project under whichever client sorts first alphabetically.
  - Neither form takes context from where it was opened, such as "Add project" on a client
    page.
  - Both define their own private `Field` (`new-project-form.tsx:109`, `clients/new/page.tsx:121`)
    without the shared `help`/`error` slots, so server errors can only show as a banner above
    the form.
  - The submit button sits at the bottom, left-aligned, after optional fields.
- **Simplified UX proposal**
  - Required fields first.
  - Optional ones (description, manager, timeline; contact, billing, contract) go behind an
    **"Add more details"** disclosure. That is progressive disclosure: the 2-field fast path
    is the default.
  - Pre-fill from `?clientId=`, autofocus the name field, and use `components/form/Field`.
- **File paths:**
  - `src/app/(app)/projects/new/new-project-form.tsx`
  - `src/app/(app)/projects/new/page.tsx`
  - `src/app/(app)/clients/new/page.tsx`
  - `src/components/form/Field.tsx`
- **Code example**

*Before:*
```tsx
<Field required label="Client">
  <Select name="clientId" required defaultValue={clients[0]?.id} options={…} />
</Field>
<PersonField name="manager" label="Project manager" />
<Field label="Status">…</Field>
<Field label="Timeline start"><DatePicker name="timelineStart" /></Field>
<Field label="Timeline end"><DatePicker name="timelineEnd" /></Field>
```

*After:*
```tsx
// page.tsx
export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const { clientId } = await searchParams;
  …
  return <NewProjectForm clients={…} initialClientId={clients.some((c) => c.id === clientId) ? clientId : undefined} />;
}

// new-project-form.tsx
import { Field } from "@/components/form/Field";

<Field label="Project name" required error={state.fieldErrors?.name}>
  <input name="name" required autoFocus className="input w-full" />
</Field>
<Field label="Client" required error={state.fieldErrors?.clientId}>
  <Select name="clientId" required defaultValue={initialClientId} placeholder="Choose a client" options={…} />
</Field>

<details className="group rounded-lg border border-default">
  <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-secondary">Add more details (optional)</summary>
  <div className="grid gap-4 p-4 sm:grid-cols-2">
    <Field label="Description" wide><textarea name="description" rows={2} className="input w-full" /></Field>
    <PersonField name="manager" label="Project manager" />
    <Field label="Status"><Select name="status" defaultValue="PLANNING" … /></Field>
    <Field label="Timeline start"><DatePicker name="timelineStart" className="w-full" /></Field>
    <Field label="Timeline end"><DatePicker name="timelineEnd" className="w-full" /></Field>
  </div>
</details>

<div className="flex justify-end gap-2 border-t border-default pt-4">
  <Link href="/projects" className="btn btn-secondary">Cancel</Link>
  <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Add project"}</button>
</div>
```

**C3. Employee wizard: 8 steps for 2 required fields**

- **Friction point**
  - Only **Employee ID** and **Full name** are required (`wizard.tsx:583-587`), yet registering
    walks through 8 steps: Documents, Company, Identity, Numbers & expiry, Trades & notes,
    Deployment, Notes and Review.
  - "Trades & notes" and "Notes" are still separate steps, as flagged in September.
  - The ID needs a manual *Generate* click even after the company is chosen on the previous
    step (`wizard.tsx:1104-1118`).
  - Errors render as a banner at the top of the form (`wizard.tsx:880-884`), away from the field.
  - The Previous/Next footer isn't sticky (`wizard.tsx:1715`), so on the long Documents and
    Review steps you scroll to advance.
- **Simplified UX proposal**
  - **Merge to 5 steps:** Documents → Company & identity → Numbers & expiry → Deployment &
    trades (notes folded in) → Review.
  - **Auto-fill the ID** as soon as a company is picked and the field is blank.
  - **"Register now" from any step** once the two required fields are valid. Everything else
    stays editable on the profile, which matches how the readiness card already nudges for
    gaps.
  - Sticky footer, and the step error shown inline on the offending field.
- **File paths:** `src/app/(app)/employees/new/wizard.tsx`
- **Code example**

*Before:* `wizard.tsx:1715-1745`. A non-sticky footer, and Register only on the last step.
```tsx
<div className="flex items-center justify-between border-t border-default pt-4">
  <button type="button" onClick={() => goTo(step - 1)} disabled={step === 0} className="btn btn-secondary">Previous</button>
  {isLast ? <button type="submit" …>Register employee</button> : <button type="button" onClick={() => goTo(step + 1)} …>Next</button>}
</div>
```

*After:* sticky, with an early exit once the minimum is satisfied.
```tsx
const canRegister = !validate(STEPS.findIndex((s) => s.key === "identity")) && !idTaken.taken;

<div className="sticky bottom-0 z-10 -mx-6 flex items-center gap-3 border-t border-default bg-surface/95 px-6 py-3 backdrop-blur">
  {step > 0 && <button type="button" onClick={() => goTo(step - 1)} className="btn btn-secondary">Back</button>}
  <span className="text-xs text-muted">Step {step + 1} of {STEPS.length}</span>
  <div className="ml-auto flex gap-2">
    {!isLast && canRegister && (
      <button type="submit" disabled={pending} className="btn btn-secondary">Register now, finish later</button>
    )}
    {isLast
      ? <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Registering…" : "Register employee"}</button>
      : <button type="button" onClick={() => goTo(step + 1)} disabled={reading} className="btn btn-primary">Next</button>}
  </div>
</div>
```
```tsx
// Auto-generate the ID once a company is chosen. Never overwrite a typed one.
useEffect(() => {
  if (fields.supplierId && !fields.employeeIdNo.trim()) void generateId();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run on company change only
}, [fields.supplierId]);
```
> The React Compiler lint rules in this repo flag synchronous `setState` in effects (see the
> phase-1/2 changelogs). `generateId` is async and sets state after an `await`, which is
> allowed. Alternatively, call it from the company `Select`'s `onChange`, which avoids the
> effect entirely and is the pattern the earlier phases preferred.

**C4. Manual timesheet entry: every worker typed in by hand**

- **Friction point:** each row is six free-text inputs (ID No, Name, Trade, Rate, Supplier,
  Client) plus the days (`manual-entry-form.tsx:184-238`).
  - The employee roster, their trade, supplier and pay rate are all in the database. The
    person entering the sheet re-types them from paper.
  - Client is asked **per row**, even though the project chosen at the top already determines
    it.
- **Simplified UX proposal**
  - One **employee picker** per row (search by name, ID or passport) fills name, trade,
    supplier and default rate, all still editable.
  - Client comes from the header project.
  - Add "Add everyone on this project" to seed rows from the project's assigned workers, so a
    30-row sheet starts at 30 rows instead of 0.
- **File paths:** `src/app/(app)/invoices/client-timesheet/new/manual-entry-form.tsx`, its
  `page.tsx` (pass `employees`)
- **Code example**

*Before:*
```tsx
<td className="sticky left-0 z-10 bg-white px-3 py-2">
  <input value={row.employeeIdNo} onChange={(e) => updateRow(row.id, { employeeIdNo: e.target.value })} placeholder="ID No" className="input w-24 px-2 py-1.5" />
</td>
<td><input value={row.employeeName} … placeholder="Name" /></td>
<td><input value={row.trade} … placeholder="Trade" /></td>
<td><input value={row.rate} … placeholder="Rate" /></td>
<td><Combobox value={row.supplierName} … /></td>
<td><Combobox value={row.clientName} … /></td>
```

*After:*
```tsx
<td className="sticky left-0 z-10 bg-surface px-3 py-2">
  <Combobox
    value={row.employeeIdNo}
    placeholder="Search name, ID or passport"
    options={employees.map((e) => ({ value: e.employeeIdNo, label: `${e.name} · ${e.employeeIdNo}` }))}
    onChange={(id) => {
      const e = employeesById.get(id);
      updateRow(row.id, e
        ? { employeeIdNo: e.employeeIdNo, employeeName: e.name, trade: e.trade ?? "", supplierName: e.supplierName ?? "", rate: e.defaultRate?.toString() ?? row.rate }
        : { employeeIdNo: id });
    }}
  />
</td>
<td className="px-3 py-2 text-sm text-secondary">{row.trade || "—"}</td>
<td className="px-3 py-2"><input value={row.rate} … aria-label={`${row.employeeName} rate`} /></td>
{/* Client column removed; it comes from the project picked above. */}

<button type="button" className="btn btn-secondary btn-sm" disabled={!projectId}
  onClick={() => setRows(projectEmployees(projectId).map(rowFromEmployee))}>
  Add everyone on this project
</button>
```

---

### D. Validation, Feedback & Confirmation

**D1. Required-field errors vanish on the next click**

- **Friction point:** the app-wide guard `FormValidation` (mounted once in `src/app/layout.tsx:63`)
  calls `form.reportValidity()` on submit (`FormValidation.tsx:51-55`).
  - That's the browser's native bubble: one field at a time, styled differently in every
    browser, and gone as soon as you click anything.
  - On a long form you fix one field, resubmit, and discover the next.
  - Server-side errors arrive as a single banner at the top (e.g.
    `new-project-form.tsx:34-38`), often above the fold.
- **Simplified UX proposal:** keep the guard, but make it **mark every invalid field inline**
  and show a persistent summary.
  - Set `aria-invalid` and a `data-error` message on each invalid control. A CSS rule shows it
    under the `.field-label` wrapper.
  - Scroll to and focus the first invalid field.
  - Clear each field's error as it becomes valid.
  - No per-form work is needed: it applies to all 166 `required` controls at once.
- **File paths:** `src/components/FormValidation.tsx`, `src/app/globals.css`
- **Code example**

*Before:*
```ts
if (!form.checkValidity()) {
  e.preventDefault();
  e.stopImmediatePropagation();
  form.reportValidity();
  return;
}
```

*After:*
```ts
if (!form.checkValidity()) {
  e.preventDefault();
  e.stopImmediatePropagation();
  const invalid = [...form.querySelectorAll<HTMLInputElement>(":invalid")].filter((el) => el.type !== "hidden" || el.name);
  for (const el of invalid) markInvalid(el);           // aria-invalid + inline message
  notify(`${invalid.length} field${invalid.length === 1 ? " needs" : "s need"} attention.`);
  focusField(form, invalid[0].name);                    // existing helper: handles hidden carriers
  return;
}

function markInvalid(el: HTMLInputElement) {
  const host = el.closest("label") ?? el.parentElement;
  el.setAttribute("aria-invalid", "true");
  let msg = host?.querySelector<HTMLElement>(":scope > .field-error[data-auto]");
  if (!msg && host) { msg = document.createElement("span"); msg.className = "field-error block"; msg.dataset.auto = ""; host.appendChild(msg); }
  if (msg) msg.textContent = el.validity.valueMissing ? "Required." : el.validationMessage;
  el.addEventListener("input", () => { el.removeAttribute("aria-invalid"); msg?.remove(); }, { once: true });
}
```
> Hidden carriers (`Select`, `DatePicker` and `PhoneField` render a hidden `<input name>` beside
> the visible control) still need `focusField`'s existing hidden-input redirect. `markInvalid`
> should anchor on the *visible* control's wrapper in the same way.

**D2. Confirm dialogs close before the work is done**

- **Friction point**
  - `ConfirmDialog` calls `setOpen(false)` *then* `await onConfirm()`
    (`ConfirmDialog.tsx:38-41`), so the dialog is gone before the delete runs.
  - If the server refuses ("clients with projects can't be deleted"), the user has already
    moved on. `DeleteButton` submits a hidden form whose result is never shown.
  - The default title is the generic "Are you sure?", and the danger button uses raw
    `bg-red-600` rather than a token.
- **Simplified UX proposal**
  - Keep the dialog open with a spinner while `onConfirm` runs, and show the returned error
    inside it.
  - Close only on success, with a toast ("Project deleted").
  - Name the action in the button ("Delete project", never "Confirm").
- **File paths:** `src/components/ui/ConfirmDialog.tsx`, `src/components/DeleteButton.tsx`
- **Code example**

*Before:*
```tsx
onClick={async () => { setOpen(false); await onConfirm(); }}
```

*After:*
```tsx
const [busy, setBusy] = useState(false);
const [error, setError] = useState<string | null>(null);
const toast = useToast();

async function confirm() {
  setBusy(true); setError(null);
  try {
    const res = await onConfirm();
    if (res && typeof res === "object" && "error" in res && res.error) { setError(String(res.error)); return; }
    setOpen(false);
    if (successMessage) toast({ title: successMessage });
  } finally { setBusy(false); }
}
…
{error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
<DialogFooter>
  <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn btn-secondary">Cancel</button>
  <button type="button" onClick={confirm} disabled={busy} className={danger ? "btn btn-danger" : "btn btn-primary"}>
    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}{confirmLabel}
  </button>
</DialogFooter>
```

**D3. Success is mostly silent**

- **Friction point:** only 4 files call `useToast`.
  - Most saves either redirect (fine) or flip a small "Saved." label beside the button.
  - Bulk status changes in the client timesheet write "Updated 3 of 5 selected rows." into an
    inline paragraph that can sit off-screen.
- **Simplified UX proposal:** a convention, not a component. Every mutation that **stays on the
  page** ends in a toast. Partial success uses the `warning` tone and names what failed. Inline
  text is reserved for field-level errors.
- **File paths:**
  - `src/components/ui/Toast.tsx` (already complete)
  - `invoices/client-timesheet/client-timesheet-grid.tsx:110-128`
  - `approvals/approvals-board.tsx:105-120`
  - `employees/[id]/edit-form.tsx:280-298`
- **Code example**
```tsx
// client-timesheet-grid.tsx: runTransition
const res = await action(formData);
toast(res.updated === res.requested
  ? { title: `${res.updated} row${res.updated === 1 ? "" : "s"} updated` }
  : { tone: "warning", title: `${res.updated} of ${res.requested} updated`, description: "Locked or already-approved rows were skipped." });
```

**D4. Leaving a page throws away edits without warning**

- **Friction point:** `useUnsavedGuard` and the wizard only listen for `beforeunload`
  (`FormSaveBar.tsx:17-22`, `wizard.tsx:270`). That fires when the tab closes, **not** on an
  in-app `<Link>` click.
  - Clicking a sidebar item with a half-edited employee record (about 100 fields) or a dirty
    timesheet row discards the edits silently.
  - The timesheet grid has no guard at all.
- **Simplified UX proposal:** one capture-phase click listener, the same technique
  `motion/ProgressBar.tsx:50-66` uses to detect internal links. While any form is marked
  dirty, it intercepts the click and asks before leaving.
- **File paths:** `src/components/FormSaveBar.tsx` (extend `useUnsavedGuard`),
  `invoices/client-timesheet/client-timesheet-grid.tsx`
- **Code example**
```ts
export function useUnsavedGuard() {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.button !== 0) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href === location.pathname + location.search) return;
      if (!window.confirm("You have unsaved changes. Leave without saving?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("beforeunload", onUnload); document.removeEventListener("click", onClick, true); };
  }, [dirty]);
  return { dirty, onInput: () => setDirty(true), markSaved: () => setDirty(false) };
}
```
> `window.confirm` is deliberate here: a navigation guard has to block synchronously, and
> `beforeunload` can't use a custom dialog either. This is the one place a native confirm is
> the right tool.

---

### E. Tables, Filters & List Search

**E1. Filters you have to submit**

- **Friction point:** Client Timesheet, Invoices, Generate Sheets and Timesheets-by-employee
  wrap their selects in a `<form>` with a **Go** button.
  - Change the month, forget Go, and the grid still shows last month under a header that now
    says this month.
  - `QuerySelect` (`components/dashboard/PeriodSelect.tsx:6-35`) already solves this. It
    writes one param to the URL on change and keeps the rest, and the dashboards use it.
- **Simplified UX proposal:** replace each `<Select name=…>` + Go with `QuerySelect`.
  - Changing Client clears the Project and Site params, because they depend on it.
  - Delete the Go buttons and `NativeSubmit`.
- **File paths:**
  - `invoices/client-timesheet/page.tsx:156-183`
  - `invoices/page.tsx:64,127-136`
  - `companies/page.tsx:60,96-104`
  - `companies/employees/page.tsx:35-38`
- **Code example**

*Before:*
```tsx
<form className="card flex flex-wrap items-end gap-3 p-4">
  <label>… <Select name="month" defaultValue={selectedMonth} options={…} /></label>
  <label>… <Select name="clientId" defaultValue={selectedClientId} options={…} /></label>
  <label>… <Select name="project" … /></label>
  <label>… <Select name="site" … /></label>
  <button type="submit" className="btn btn-primary">Go</button>
</form>
```

*After:*
```tsx
<div className="card flex flex-wrap items-end gap-3 p-4">
  <FilterField label="Month"><QuerySelect param="month" value={selectedMonth} options={monthOptions} /></FilterField>
  <FilterField label="Client"><QuerySelect param="clientId" value={selectedClientId} options={clientOptions} resets={["project", "site"]} /></FilterField>
  <FilterField label="Project"><QuerySelect param="project" value={selectedProject ?? ""} options={projectOptions} /></FilterField>
  <FilterField label="Site"><QuerySelect param="site" value={selectedSite ?? ""} options={siteOptions} /></FilterField>
</div>
```
```tsx
// PeriodSelect.tsx: QuerySelect gains an optional `resets` list
onChange={(v) => {
  const next = new URLSearchParams(search.toString());
  next.set(param, v);
  for (const r of resets ?? []) next.delete(r);
  router.replace(`${pathname}?${next.toString()}`, { scroll: false });
}}
```

**E2. Table search, sort, page and columns reset on Back**

- **Friction point:** `DataTable` holds `query`, `sort` and the current page in `useState`
  (`DataTable.tsx:131-132`), and column choices aren't persisted (no storage reads in the file).
  - Filter employees to "electrician", open one, press Back: the search is empty, the sort is
    gone, and the columns you enabled are hidden again.
  - `ScrollRestore` brings back the scroll position, but into an unfiltered list.
- **Simplified UX proposal**
  - Mirror `q`, `sort` and `page` into the URL with `router.replace`, which keeps them
    shareable and survives Back.
  - Persist column visibility per table in `localStorage`, keyed by `csvFilename` or a new
    `tableId` prop. It's a per-viewer convenience, wrapped in try/catch like `nav-links.tsx:377-391`.
- **File paths:** `src/components/data-table/DataTable.tsx`
- **Code example**
```tsx
const params = useSearchParams();
const pathname = usePathname();
const [query, setQueryState] = useState(() => params.get("q") ?? "");
const setQuery = (q: string) => {
  setQueryState(q);
  const next = new URLSearchParams(params.toString());
  q ? next.set("q", q) : next.delete("q");
  router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
};

const COLS_KEY = `table.cols.${tableId}`;
const [hidden, setHidden] = useState<Set<string>>(() => {
  try { const v = localStorage.getItem(COLS_KEY); if (v) return new Set(JSON.parse(v)); } catch {}
  return new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key));
});
```
> Read `localStorage` through `useSyncExternalStore`, as `nav-links.tsx:392-394` does, if the
> lazy initialiser causes a hydration mismatch on the server render.

**E3. Two segmented controls that look like one; 71 tables outside the primitive**

- **Friction point**
  - The Employees toolbar renders two adjacent `SegmentedControl`s, All/On work/Bench and
    All/Supplier/Our employees (`employee-list.tsx:532-555`), plus a separate clearable chip
    for dashboard-linked filters. Three filter UIs on one toolbar.
  - Outside `DataTable`, 71 files hand-roll a `<table>`, each with its own (or no) search,
    sort, empty state and mobile behaviour.
- **Simplified UX proposal**
  - One row of **filter chips with counts**: On work 142 · Bench 38 · Supplier 96 · Ours 84 ·
    Incomplete 12. Chips are additive across groups and exclusive within a group, and stored
    in the URL as today.
  - Continue the `DataTable` migration module by module, as Phase 4 recommended. Start with the
    lists people filter most: Clients, Suppliers, Invoices and Demand.
- **File paths:** `src/app/(app)/employees/employee-list.tsx`, `src/components/data-table/DataTable.tsx` (`toolbarExtra`)
- **Code example**
```tsx
<div role="group" aria-label="Filter employees" className="flex flex-wrap gap-1.5">
  {CHIPS.map((c) => (
    <button key={c.value} type="button" aria-pressed={filter === c.value}
      onClick={() => router.replace(filter === c.value ? "/employees" : `/employees?filter=${c.value}`, { scroll: false })}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
        filter === c.value ? "border-[var(--brand-primary-border)] bg-brand-soft text-[var(--brand-primary)]" : "border-default text-secondary hover:bg-surface-hover")}>
      {c.label}<span className="tabular text-subtle">{counts[c.value]}</span>
    </button>
  ))}
</div>
```

**E4. Empty states are mostly bare sentences**

- **Friction point:** 31 places render an ad-hoc `<p>No … yet.</p>`, for example
  - `letter-templates/page.tsx:78`
  - `companies/employees/page.tsx:44`
  - `trades/trade-table.tsx:205`
  - `projects/[id]/project-lpo.tsx:72`
  - six sections of the employee profile

  Some name an action in prose ("Use 'New template'…") without a button; others give no way
  forward at all. `EmptyState` has the what → why → action structure but only 19 users.
- **Simplified UX proposal:** every empty list renders `EmptyState` with **one primary CTA**
  that does the obvious next thing, pre-filled from context where the empty list belongs to a
  record.
- **Code example**

*Before:* `projects/[id]/project-lpo.tsx:72`
```tsx
<p className="text-sm text-muted">No LPOs recorded for this project yet.</p>
```

*After:*
```tsx
<EmptyState size="compact" icon={FileText}
  title="No LPOs yet"
  description="Record the client's purchase order so hours can be invoiced against it."
  action={<button type="button" onClick={() => setAdding(true)} className="btn btn-primary btn-sm">Add LPO</button>} />
```

---

### F. Detail Pages & Editing

**F1. The employee record is one ~100-field form with an always-on Save**

- **Friction point**
  - The employee detail *is* the edit form, across 6 tabs.
  - Its sticky footer renders "Save changes" whenever any tab but Notes is open
    (`edit-form.tsx:794-830`), even on a visit where nothing changed.
  - `FormSaveBar` was built in Phase 5 to fix exactly this, but the employee form never adopted
    it; only clients and suppliers did.
  - A server error ("Emirates ID format…") shows in the footer, while the offending field may
    be on another tab with nothing marking it.
- **Simplified UX proposal**
  - Switch to `FormSaveBar` (dirty-only, with a Discard button).
  - Mark tabs that contain dirty or invalid fields with a dot, and jump to the first one on
    error.
  - Longer term, as the September audit proposed: read-first sections with a per-section
    **Edit** toggle, so viewing is the default and editing is a choice.
- **File paths:** `src/app/(app)/employees/[id]/edit-form.tsx`, `src/components/FormSaveBar.tsx`
- **Code example**
```tsx
// Track which tab each change came from
const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set());
<form onInput={(e) => {
  const tabId = (e.target as HTMLElement).closest<HTMLElement>("[data-tab]")?.dataset.tab;
  if (tabId && !dirtyTabs.has(tabId)) setDirtyTabs((s) => new Set(s).add(tabId));
}} …>

// Tab label
{t.label}
{dirtyTabs.has(t.id) && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--warning)]" aria-label="unsaved changes" />}

// Footer: replaces the hand-rolled sticky div
<FormSaveBar pending={pending} saved={saved} dirty={dirtyTabs.size > 0} error={error} />
```

**F2. Delete is the loudest action on every detail page**

- **Friction point:** on Project, Client, Supplier, Demand and Inventory detail, `DeleteButton`
  sits beside the title.
  - On Project it is the **only** header action (`projects/[id]/page.tsx:84-93`).
  - The things people actually do from a project are add an employee, raise a demand or open
    its timesheet, and none of them are offered there.
- **Simplified UX proposal**
  - Primary and secondary *forward* actions in the header (see the B2 example).
  - Delete moves into a `⋯` overflow menu, still guarded by `ConfirmDialog`.
  - Contextual links pass the record's id (`?projectId=`, `?clientId=`, `?employeeId=`) so the
    next form starts filled in (C1, C2).
- **File paths:**
  - `projects/[id]/page.tsx`
  - `clients/[id]/page.tsx`
  - `suppliers/[id]/page.tsx`
  - `demand/[id]/page.tsx`
  - `inventory/[id]/page.tsx`
  - `components/DeleteButton.tsx`

**F3. The employee header has no actions**

- **Friction point:** the employee header (`employees/[id]/page.tsx:196-259`) shows identity
  and status but offers no action.
  - The common next steps are check-in to a camp, issue a letter, mobilise and upload a renewal.
    Each lives on a different module page where you have to find the person again.
  - "Salary certificate" floats alone in a right-aligned row below the card (`:261-265`).
- **Simplified UX proposal:** a header action row on the record.
  - **Upload document** (primary when something is expired).
  - **Check in** (shown only when the employee has no bed).
  - **Issue letter ▾** (salary certificate, NOC and others).
  - **Mobilise** (shown only when on bench).

  Each link pre-selects this employee.
- **Code example**
```tsx
<div className="flex flex-wrap gap-2">
  {needsRenewal && <Link href={`#documents`} className="btn btn-primary btn-sm">Upload renewal</Link>}
  {!employee.bed && <Link href={`/accommodation/checkin?employee=${employee.id}`} className="btn btn-secondary btn-sm">Check in</Link>}
  <IssueLetterMenu employeeId={employee.id} canSalary={canViewPay && !!employee.supplier?.isOwnCompany} />
</div>
```

---

### G. High-Volume Entry: the Client Timesheet Grid

- **Friction point:** this is the app's densest daily task and still:
  - **Saves per row.** A *Save* button appears on each edited row (`client-timesheet-grid.tsx:247-256`),
    so a 30-worker correction pass is 30 clicks.
  - **Has no keyboard movement.** No arrow keys, Enter-down, fill-down or paste of an Excel row.
  - **Shows stale totals.** The row total is `e.totalHours` from the server (`:234`), so it
    doesn't change as you type. There are no per-day column totals either.
  - **Has no leave guard.** Dirty cells are lost on navigation (D4).
- **Simplified UX proposal** (deferred in Phase 5 because it touches the save path; it can be
  done without changing the server action):
  1. One **"Save n changes"** bar that loops over the existing per-row `updateDailyHoursAction`.
     The server contract is unchanged, and ⌘S triggers it.
  2. **Live totals:** compute the row total from `cellValue` and add a footer row of day totals.
  3. **Grid keys:** ←/→/↑/↓ move between cells, Enter moves down, and ⌘D fills down from the
     cell above. Pasting tab-separated text spreads across the row.
- **File paths:** `src/app/(app)/invoices/client-timesheet/client-timesheet-grid.tsx`,
  `src/app/(app)/invoices/client-timesheet/actions.ts` (read only; no change)
- **Code example**

*Before:*
```tsx
<td className="px-2 py-1.5 font-medium text-primary">{e.totalHours}</td>
…
{hasEdits && <button type="button" onClick={() => saveRow(e.id)} …>Save</button>}
```

*After:*
```tsx
const dirtyIds = Object.keys(edited);
const rowTotal = (id: string) => dayIndices.reduce((s, i) => s + (Number(cellValue(id, i)) || 0), 0);

function saveAll() {
  startTransition(async () => {
    const failed: string[] = [];
    for (const id of dirtyIds) {
      const fd = new FormData(); fd.append("entryId", id); fd.append("days", JSON.stringify(edited[id]));
      try { await updateDailyHoursAction(fd); } catch { failed.push(id); }
    }
    setEdited((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => failed.includes(id))));
    toast(failed.length ? { tone: "warning", title: `${dirtyIds.length - failed.length} saved, ${failed.length} failed` } : { title: `${dirtyIds.length} rows saved` });
  });
}

// cell: move like a spreadsheet
function onCellKey(e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
  const go = (r: number, c: number) => document.querySelector<HTMLInputElement>(`[data-cell="${r}:${c}"]`)?.focus();
  if (e.key === "ArrowRight" && e.currentTarget.selectionStart === e.currentTarget.value.length) go(row, col + 1);
  else if (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0) go(row, col - 1);
  else if (e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); go(row + 1, col); }
  else if (e.key === "ArrowUp") { e.preventDefault(); go(row - 1, col); }
  else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") { e.preventDefault(); editCell(rows[row].id, col, cellValue(rows[row - 1]?.id, col) ?? ""); }
}

<td className="tabular px-2 py-1.5 font-medium text-primary">{rowTotal(e.id)}</td>
<input data-cell={`${r}:${i}`} onKeyDown={(ev) => onCellKey(ev, r, i)} … />

{dirtyIds.length > 0 && (
  <div className="sticky bottom-0 z-20 flex items-center gap-3 border-t border-default bg-surface/95 px-4 py-3 backdrop-blur">
    <span className="text-sm text-[var(--warning)]">{dirtyIds.length} row{dirtyIds.length === 1 ? "" : "s"} changed</span>
    <button type="button" onClick={() => setEdited({})} className="btn btn-secondary btn-sm">Discard</button>
    <button type="button" onClick={saveAll} disabled={pending} className="btn btn-primary btn-sm">Save {dirtyIds.length} <kbd className="ml-1 opacity-70">⌘S</kbd></button>
  </div>
)}
```

---

### H. Multi-Branch Context ("All branches")

- **Friction point**
  - Super-admins viewing All branches hit a dead end on at least ten pages. Each shows a
    warning to "pick a branch from the switcher (top right)":
    - `employees/new/page.tsx:36-56`
    - `letters/page.tsx:53`
    - `letter-templates/page.tsx:69`
    - `payroll/page.tsx:120`
    - `settings/page.tsx:37`
    - `settings/developers/page.tsx:53`
    - `import/page.tsx:58`
    - `import/new/[kind]/page.tsx:23`
    - `import/new/documents/page.tsx:19`
    - `settings/data-reset/page.tsx:47`
  - The switcher is `hidden sm:block` in the header (`layout.tsx:97-101`), so on a phone the
    instruction points at nothing.
  - On `/employees/new` the full wizard still renders below the warning and can be filled in
    completely before it fails.
  - Raise Demand doesn't warn at all; it silently no-ops (C1).
- **Simplified UX proposal:** a shared `<BranchRequired>` gate.
  - It renders an **inline branch picker** in place of the form. Picking a branch calls the
    existing `setActiveBranchAction` and the page re-renders with the form.
  - Nothing is shown that can't be saved.
  - The header switcher becomes visible at every width; it collapses to the branch code on
    small screens.
- **File paths:** `src/components/BranchSwitcher.tsx`, `src/app/(app)/branch-switcher-actions.ts`,
  `src/app/(app)/layout.tsx`, and the ten pages above
- **Code example**

*Before:* `employees/new/page.tsx`
```tsx
{!branchId && (<div className="… bg-[var(--warning-soft)]">… Pick a specific branch in the switcher above before adding an employee — otherwise this form can't be saved.</div>)}
<div className="card card-padded"><EmployeeWizard … /></div>
```

*After:*
```tsx
<BranchRequired branchId={branchId} branches={branches} purpose="add an employee">
  <div className="card card-padded"><EmployeeWizard … /></div>
</BranchRequired>

// components/BranchRequired.tsx (server component; the picker is a small client island)
export function BranchRequired({ branchId, branches, purpose, children }: { … }) {
  if (branchId) return <>{children}</>;
  return (
    <EmptyState icon={Building2} title={`Choose a branch to ${purpose}`}
      description="Records belong to one branch. You're currently viewing all branches."
      action={<InlineBranchPicker branches={branches} />} />
  );
}
```

---

## 4. Keyboard & Power-User Enhancements

Today: ⌘K (palette), `?` (sheet), Esc, and `j`/`k` on Approvals, which isn't documented.
The sheet's own comment says it's "deliberately small". The goal is to grow it only with
shortcuts that exist, and to make that structural: shortcuts are **registered** in one place,
and the sheet **renders the registry**, so the two can't drift apart.

### Proposed shortcut map

| Keys | Scope | Action | Notes |
|---|---|---|---|
| ⌘K / Ctrl K | Global | Command palette | Exists. Show **Ctrl K** on Windows/Linux; today ⌘K is hard-coded (`CommandPalette.tsx:189, 378`). |
| `?` | Global | Shortcuts sheet | Exists. |
| `/` | Any list with a `DataTable` | Focus the table's search box | Pairs with E2 (search in URL). |
| `c` | List pages | Create (the page's primary "New…") | Reads the same `CREATE_ACTIONS` map as the header "+ New" menu. |
| `g` then `d` / `e` / `m` / `t` / `a` / `i` | Global | Go to Dashboard / Employees / Demand / Client Timesheet / Approvals / Invoices | Two-key chord with a 1 s window; ignored while typing. |
| `j` / `k`, `Enter` | Approvals (and any keyboard-navigable list) | Next / previous item, open it | Exists on Approvals; generalise to `DataTable` rows. |
| `a` / `r` | Approvals, item focused | Approve / Reject (opens the note box) | Approve still respects `confirmApprove` items. |
| ⌘↵ / Ctrl ↵ | Any form | Submit | Removes the scroll-to-button trip on long forms. |
| ⌘S / Ctrl S | Timesheet grid, employee record | Save all changes | Prevents the browser's "Save page". |
| ←↑→↓, `Enter`, ⌘D | Timesheet grid | Move between cells, move down, fill down | See G. |
| `[` / `]` | Wizard | Previous / next step | Employee and supplier wizards. |
| Esc | Dialogs, palette, drawers | Close | Exists via Radix. |

### Auto-focus rules

- **Create pages:** the first required field gets `autoFocus`. For Add Project, Add Client and
  Raise Demand (the project picker), this is a one-attribute change each.
- **`Select` / `Combobox`:** neither forwards `autoFocus` to its trigger today
  (`components/ui/Select.tsx:17-31` has no such prop). Add an `autoFocus?: boolean` that
  focuses the trigger button on mount, so a form can start on its picker (Raise Demand).
- **Wizards:** on each step change, focus the step's first input. The panel is
  re-rendered, so focus otherwise falls back to `<body>`.
- **Dialogs:** Radix focuses the first focusable element. For quick-add dialogs such as
  `transport/add-vehicle-dialog.tsx`, put `autoFocus` on the first input so it's that and not
  the close button. Several already do this, e.g. `onboarding/agency-picker.tsx:72`.
- **After a list action** (approve, delete row), move focus to the next row rather than
  `<body>`, so `j`/`k` flows continue.

### Implementation sketch: one registry, one listener

```tsx
// src/lib/hotkeys.ts
export type Hotkey = { keys: string; label: string; group: "Navigate" | "This page" | "Editing"; run: () => void; when?: () => boolean };

const registry = new Map<string, Hotkey>();
const listeners = new Set<() => void>();
export const hotkeys = {
  add(h: Hotkey) { registry.set(h.keys, h); listeners.forEach((l) => l()); return () => { registry.delete(h.keys); listeners.forEach((l) => l()); }; },
  list: () => [...registry.values()],
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
};

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable);

// src/components/HotkeyHost.tsx: mounted once in (app)/layout.tsx next to ShortcutsSheet
export function HotkeyHost() {
  useEffect(() => {
    let chord: string | null = null;
    let chordTimer: number | undefined;
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) && !(e.metaKey || e.ctrlKey)) return;
      const mod = e.metaKey || e.ctrlKey ? "mod+" : "";
      const key = chord ? `${chord} ${e.key.toLowerCase()}` : `${mod}${e.key.toLowerCase()}`;
      const hit = registry.get(key);
      if (hit && (!hit.when || hit.when())) { e.preventDefault(); hit.run(); chord = null; return; }
      if (!mod && e.key === "g") { chord = "g"; clearTimeout(chordTimer); chordTimer = window.setTimeout(() => (chord = null), 1000); return; }
      chord = null;
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}

// Page-level registration: Approvals today hard-codes j/k in an onKeyDown prop
export function useHotkey(h: Hotkey) {
  useEffect(() => hotkeys.add(h), [h.keys]); // eslint-disable-line react-hooks/exhaustive-deps
}
```

```tsx
// ShortcutsSheet.tsx: render the registry instead of a static GROUPS array
const list = useSyncExternalStore(hotkeys.subscribe, hotkeys.list, () => []);
const groups = Object.groupBy(list, (h) => h.group);
```

```tsx
// Platform-aware modifier label, hydration-safe (same useSyncExternalStore pattern as nav-links.tsx)
export function useModKey() {
  return useSyncExternalStore(
    () => () => {},
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"),
    () => "⌘",
  );
}
```

### Other power-user affordances

- **Pinned pages** already exist in the sidebar (`nav-links.tsx:360-394`, up to 6). Surface
  them at the top of the palette's empty state too, so ⌘K + ↵ reaches a pinned page in two keys.
- **Saved views on lists.** Once E2 puts filters in the URL, the pin button can pin a
  *filtered* URL ("Bench electricians", "Expiring in 30 days"), with no new storage model.
- **Bulk keyboard selection** in `DataTable`: `x` toggles the focused row and `shift+j/k`
  extends the selection, so the existing animated bulk bar becomes keyboard-reachable.

---

## 5. Suggested order of work

1. **Trust fixes (1–2 days):** Immediate wins #1, #3, #10 and #11, plus D1. These remove every
   path in this report where the app silently does nothing or silently loses work.
2. **Fewer fields (2–3 days):** C1 (project-only demand), C2 (progressive disclosure +
   `?clientId`), C3 (ID auto-fill + "Register now"), C4 (employee picker), and the contextual
   `?projectId=` / `?clientId=` / `?employee=` links from F2/F3.
3. **Durable state (2 days):** E1 (no Go buttons), E2 (table state in the URL, columns
   remembered), B3 (tab in the URL), D4 (in-app leave guard).
4. **Speed for daily work (3–4 days):** G (grid save-all, live totals, keys), the hotkey
   registry with `/`, `c`, `g` chords and ⌘↵, and palette A1–A3.
5. **Convergence (ongoing, per module):** `form/Field` in place of the 11 local copies,
   `PageHeader` + breadcrumbs on the remaining 34 pages, `EmptyState` for the 31 bare
   messages, and the `DataTable` migration as Phase 4 proposed. Do it one module at a time,
   with someone clicking through each before the next.

Every item in steps 1–4 can be built against the existing server actions. The only
server-side changes proposed are the two `return { error }` lines in `demand/actions.ts`, the
widened search query in `api/search/route.ts`, and passing `employees` to the manual entry page.
