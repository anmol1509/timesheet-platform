/**
 * Module × action permission model.
 *
 * Pure (no DB, no Next imports) so the sidebar, the ⌘K palette and the server
 * gate can all share it. A permission is the string `"<module>:<action>"`.
 *
 * Who it applies to: only STAFF users who have an AccessRole assigned. Admins
 * (SUPER_ADMIN / BRANCH_ADMIN) always have everything, and a STAFF user with no
 * AccessRole keeps the legacy behaviour (every operational module, nothing
 * administrative), so nobody's access changes until an admin opts them in.
 *
 * Administration (Settings, Lookups, Letter Templates, Audit Log, Data Reset)
 * is deliberately not a grantable module — it stays admin-only.
 */

export const ACTIONS = ["view", "create", "edit", "delete", "approve", "export"] as const;
export type PermissionAction = (typeof ACTIONS)[number];

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
  export: "Export",
};

/** A menu page inside a module. Its permission key is "<module>.<page>:<action>". */
export type PermissionPage = {
  key: string;
  label: string;
  /** Page and API path prefixes this page owns; the longest match wins. */
  paths: string[];
};

export type PermissionModule = {
  key: string;
  label: string;
  description: string;
  /** Page and API path prefixes this module owns; the longest match wins. */
  paths: string[];
  /** The module's menu pages. A module-wide grant ("<module>:<action>") covers all of them. */
  pages: PermissionPage[];
  actions: readonly PermissionAction[];
};

const CORE: readonly PermissionAction[] = ["view", "create", "edit", "delete", "export"];
const WITH_APPROVE: readonly PermissionAction[] = ["view", "create", "edit", "delete", "approve", "export"];

type ModuleDef = Omit<PermissionModule, "paths" | "pages"> & { paths?: string[]; pages: PermissionPage[] };

const DEFS: ModuleDef[] = [
  {
    key: "workforce",
    label: "Workforce",
    description: "Employees, trades, documents, renewals",
    actions: CORE,
    paths: ["/api/employees"],
    pages: [
      { key: "employees", label: "Employees", paths: ["/employees", "/api/employees"] },
      { key: "instant-view", label: "Instant View", paths: ["/employees/instant-view"] },
      { key: "renewals", label: "Renewals", paths: ["/employees/renewals"] },
      { key: "documents", label: "Documents", paths: ["/documents", "/api/documents"] },
      { key: "letters", label: "Letters", paths: ["/letters", "/api/letters", "/letter-templates"] },
      { key: "trades", label: "Trades", paths: ["/trades"] },
      { key: "dashboard", label: "Dashboard", paths: ["/dashboards/workforce"] },
    ],
  },
  {
    key: "projects",
    label: "Projects",
    description: "Projects, sites, NOCs",
    actions: CORE,
    pages: [
      { key: "projects", label: "Projects", paths: ["/projects", "/api/project-documents"] },
      { key: "sites", label: "Sites", paths: ["/sites"] },
      { key: "nocs", label: "NOC", paths: ["/operations", "/api/nocs"] },
      { key: "dashboard", label: "Dashboard", paths: ["/dashboards/projects"] },
    ],
  },
  {
    key: "demand",
    label: "Demand",
    description: "Demands, mobilisation, site arrival, demobilisation",
    actions: WITH_APPROVE,
    pages: [
      { key: "create", label: "Create Demand", paths: ["/demand/new"] },
      { key: "list", label: "View Demands", paths: ["/demand", "/api/demand-requests"] },
      { key: "mobilisation", label: "Mobilisation", paths: ["/demand/mobilisation"] },
      { key: "documents", label: "Generate Doc", paths: ["/demand/documents"] },
      { key: "dashboard", label: "Dashboard", paths: ["/dashboards/demand"] },
    ],
  },
  {
    key: "payroll",
    label: "Payroll",
    description: "Pay structures, payroll runs, payslips, WPS files",
    actions: WITH_APPROVE,
    pages: [{ key: "payroll", label: "Payroll", paths: ["/payroll", "/api/payroll"] }],
  },
  {
    key: "finance",
    label: "Finance",
    description: "Expenses, supplier bills and payments",
    actions: WITH_APPROVE,
    pages: [
      { key: "overview", label: "Overview", paths: ["/finance", "/api/finance"] },
      { key: "bills", label: "Supplier Bills", paths: ["/finance/bills"] },
      { key: "expenses", label: "Expenses", paths: ["/finance/expenses"] },
    ],
  },
  {
    key: "facilities",
    label: "Facilities",
    description: "Accommodation, transport, inventory",
    actions: CORE,
    pages: [
      { key: "camps", label: "Camps", paths: ["/accommodation", "/api/accommodation"] },
      { key: "checkin", label: "Create Check-In", paths: ["/accommodation/checkin", "/api/checkins"] },
      { key: "bed-allocation", label: "Bed Allocation", paths: ["/accommodation/bed-allocation"] },
      { key: "transport", label: "Transport", paths: ["/transport", "/api/transport"] },
      { key: "inventory", label: "Inventory", paths: ["/inventory"] },
      { key: "dashboard", label: "Dashboard", paths: ["/dashboards/facilities"] },
    ],
  },
  {
    key: "timesheets",
    label: "Timesheets & attendance",
    description: "Attendance, client timesheets, uploads, generated sheets",
    actions: WITH_APPROVE,
    pages: [
      { key: "attendance", label: "Daily Attendance", paths: ["/attendance"] },
      { key: "client-timesheet", label: "Client Timesheet", paths: ["/invoices/client-timesheet"] },
      { key: "generate", label: "Generate", paths: ["/companies", "/upload", "/history", "/timesheet-templates", "/timesheets", "/api/upload", "/api/generate", "/api/timesheet-templates"] },
      { key: "dashboard", label: "Dashboard", paths: ["/dashboards/timesheets"] },
    ],
  },
  {
    key: "partners",
    label: "Business partners",
    description: "Clients, suppliers, banks",
    actions: WITH_APPROVE,
    pages: [
      { key: "clients", label: "Clients", paths: ["/clients", "/api/client-documents"] },
      { key: "suppliers", label: "Suppliers", paths: ["/suppliers"] },
      { key: "messages", label: "Supplier Messages", paths: ["/suppliers/tickets", "/suppliers/contacts"] },
      { key: "banks", label: "Banks", paths: ["/banks"] },
      { key: "dashboard", label: "Dashboard", paths: ["/dashboards/business-partners"] },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    description: "Enquiries and quotations",
    actions: WITH_APPROVE,
    pages: [
      { key: "enquiries", label: "Enquiries", paths: ["/sales", "/sales/enquiries"] },
      { key: "quotations", label: "Quotations", paths: ["/sales/quotations", "/api/quotations"] },
      { key: "dashboard", label: "Dashboard", paths: ["/dashboards/sales"] },
    ],
  },
  {
    key: "billing",
    label: "Billing",
    description: "Client invoices and invoice history",
    actions: CORE,
    pages: [
      { key: "invoices", label: "Invoices", paths: ["/invoices", "/api/invoices"] },
      { key: "dashboard", label: "Dashboard", paths: ["/dashboards/billing"] },
    ],
  },
  {
    key: "onboarding",
    label: "Candidate onboarding",
    description: "Candidates from agencies, offer through joining",
    actions: CORE,
    pages: [
      { key: "tracker", label: "Candidate Tracker", paths: ["/onboarding", "/api/onboarding"] },
      { key: "new", label: "Add Candidate", paths: ["/onboarding/new"] },
      { key: "dashboard", label: "Dashboard", paths: ["/dashboards/onboarding"] },
    ],
  },
];

export const MODULES: PermissionModule[] = DEFS.map((d) => ({
  ...d,
  pages: d.pages,
  paths: [...new Set([...(d.paths ?? []), ...d.pages.flatMap((p) => p.paths)])],
}));

/** "<module>.<page>" */
export const pageKey = (module: string, page: string) => `${module}.${page}`;
export const isPageKey = (target: string) => target.includes(".");
export const moduleOf = (target: string) => target.split(".")[0];

export const MODULE_KEYS = MODULES.map((m) => m.key);

const PAGE_TABLE: { prefix: string; target: string; module: string }[] = MODULES.flatMap((m) =>
  m.pages.flatMap((p) => p.paths.map((prefix) => ({ prefix, target: pageKey(m.key, p.key), module: m.key })))
).sort((a, b) => b.prefix.length - a.prefix.length);

const MODULE_TABLE: { prefix: string; module: string }[] = MODULES.flatMap((m) => m.paths.map((prefix) => ({ prefix, module: m.key }))).sort((a, b) => b.prefix.length - a.prefix.length);

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");

/** The permission target that owns a path: a page ("facilities.camps") when it belongs to one,
 * otherwise its module, or null for shared/unrestricted pages (dashboard home, profile, search,
 * admin pages that gate themselves). The longest matching prefix wins. */
export function moduleForPath(pathname: string): string | null {
  for (const { prefix, target } of PAGE_TABLE) if (under(pathname, prefix)) return target;
  for (const { prefix, module } of MODULE_TABLE) if (under(pathname, prefix)) return module;
  return null;
}

export function permissionKey(module: string, action: PermissionAction) {
  return `${module}:${action}`;
}

/** Drops keys that no longer exist, so a renamed module can't grant phantom access. */
export function sanitizePermissions(keys: string[]): string[] {
  const valid = new Set(
    MODULES.flatMap((m) => [
      ...m.actions.map((a) => permissionKey(m.key, a)),
      ...m.pages.flatMap((p) => m.actions.map((a) => permissionKey(pageKey(m.key, p.key), a))),
    ])
  );
  return [...new Set(keys)].filter((k) => valid.has(k));
}

export type PermissionSubject = {
  role: "SUPER_ADMIN" | "BRANCH_ADMIN" | "STAFF" | string;
  /** Permission keys from the user's AccessRole, or null/undefined if none assigned. */
  permissions?: string[] | null;
};

const pagesOf = (module: string) => MODULES.find((m) => m.key === module)?.pages ?? [];

/**
 * Whether the subject may do `action` on `target`, a module ("facilities") or one of its pages
 * ("facilities.camps").
 *  - A page is allowed by its own grant or by a module-wide grant.
 *  - A module asked about as a whole is allowed by a module-wide grant, or by a grant on any of
 *    its pages: that is the right answer for "does this person get anything here" (menus,
 *    buttons). Enforcement at a particular page asks about that page.
 */
export function can(subject: PermissionSubject, target: string, action: PermissionAction): boolean {
  if (subject.role === "SUPER_ADMIN" || subject.role === "BRANCH_ADMIN") return true;
  if (!subject.permissions) return true; // legacy STAFF: all operational modules
  const perms = subject.permissions;
  if (isPageKey(target)) return perms.includes(permissionKey(target, action)) || perms.includes(permissionKey(moduleOf(target), action));
  return perms.includes(permissionKey(target, action)) || pagesOf(target).some((p) => perms.includes(permissionKey(pageKey(target, p.key), action)));
}

/** Everything the subject may open, as targets: module keys with a module-wide view, and every
 * page they can view. null means "no restriction". */
export function viewableModules(subject: PermissionSubject): string[] | null {
  if (subject.role !== "STAFF" || !subject.permissions) return null;
  const out: string[] = [];
  for (const m of MODULES) {
    if (can(subject, m.key, "view")) out.push(m.key);
    for (const p of m.pages) if (can(subject, pageKey(m.key, p.key), "view")) out.push(pageKey(m.key, p.key));
  }
  return out;
}

/** Whether the subject may open the page that owns this path (paths outside every module are open). */
export function canViewPath(subject: PermissionSubject, pathname: string): boolean {
  const target = moduleForPath(pathname);
  return target === null || can(subject, target, "view");
}

export const WRITE_ACTIONS: readonly PermissionAction[] = ["create", "edit", "delete", "approve"];

export function canWrite(subject: PermissionSubject, target: string): boolean {
  return WRITE_ACTIONS.some((a) => can(subject, target, a));
}

export type AccessLine = { key: string; label: string; wholeModule: boolean; pages: { label: string; actions: PermissionAction[] }[]; actions: PermissionAction[] };

/** What a set of permission keys lets someone do, module by module: a module-wide grant, or the specific pages. */
export function describeAccess(perms: string[]): AccessLine[] {
  const has = (k: string) => perms.includes(k);
  const out: AccessLine[] = [];
  for (const m of MODULES) {
    const whole = has(permissionKey(m.key, "view"));
    if (whole) {
      out.push({ key: m.key, label: m.label, wholeModule: true, pages: [], actions: m.actions.filter((a) => has(permissionKey(m.key, a))) });
      continue;
    }
    const pages = m.pages
      .filter((p) => has(permissionKey(pageKey(m.key, p.key), "view")))
      .map((p) => ({ label: p.label, actions: m.actions.filter((a) => has(permissionKey(pageKey(m.key, p.key), a))) }));
    if (pages.length) out.push({ key: m.key, label: m.label, wholeModule: false, pages, actions: [] });
  }
  return out;
}

/** Every action on the given pages of a module, as permission keys (for building presets). */
export function pagePermissions(module: string, pages: string[]): string[] {
  const m = MODULES.find((x) => x.key === module)!;
  return pages.flatMap((p) => m.actions.map((a) => permissionKey(pageKey(module, p), a)));
}

/** Starter roles offered on the Roles page so an admin isn't staring at a blank grid. */
export const ROLE_PRESETS: { name: string; description: string; permissions: string[] }[] = [
  {
    name: "Viewer",
    description: "Read-only access to every module.",
    permissions: MODULES.map((m) => permissionKey(m.key, "view")),
  },
  {
    name: "Site supervisor",
    description: "Attendance and timesheets, plus read-only workforce and projects.",
    permissions: [
      "workforce:view",
      "projects:view",
      "demand:view",
      "timesheets:view",
      "timesheets:create",
      "timesheets:edit",
    ],
  },
  {
    name: "Accountant",
    description: "Billing and timesheets, with export; read-only partners.",
    permissions: [
      "billing:view",
      "billing:create",
      "billing:edit",
      "billing:export",
      "timesheets:view",
      "timesheets:export",
      "partners:view",
      "sales:view",
    ],
  },
  {
    name: "Camp manager",
    description: "Camps, Create Check-In and Bed Allocation, and nothing else.",
    permissions: pagePermissions("facilities", ["camps", "checkin", "bed-allocation"]),
  },
  {
    name: "Transport coordinator",
    description: "Transport only: vehicles, drivers and routes.",
    permissions: pagePermissions("facilities", ["transport"]),
  },
  {
    name: "HR officer",
    description: "Full workforce, demand and facilities.",
    permissions: ["workforce", "demand", "facilities"].flatMap((m) =>
      MODULES.find((x) => x.key === m)!.actions.map((a) => permissionKey(m, a))
    ),
  },
];
