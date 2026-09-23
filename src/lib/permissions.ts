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

export type PermissionModule = {
  key: string;
  label: string;
  description: string;
  /** Page and API path prefixes this module owns; the longest match wins. */
  paths: string[];
  actions: readonly PermissionAction[];
};

const CORE: readonly PermissionAction[] = ["view", "create", "edit", "delete", "export"];
const WITH_APPROVE: readonly PermissionAction[] = ["view", "create", "edit", "delete", "approve", "export"];

export const MODULES: PermissionModule[] = [
  {
    key: "workforce",
    label: "Workforce",
    description: "Employees, trades, documents, renewals",
    paths: ["/employees", "/trades", "/documents", "/api/employees", "/api/documents", "/dashboards/workforce"],
    actions: CORE,
  },
  {
    key: "projects",
    label: "Projects",
    description: "Projects, sites, NOCs",
    paths: ["/projects", "/sites", "/operations", "/api/nocs", "/api/project-documents", "/dashboards/projects"],
    actions: CORE,
  },
  {
    key: "demand",
    label: "Demand",
    description: "Demands, mobilisation, site arrival, demobilisation",
    paths: ["/demand", "/api/demand-requests", "/dashboards/demand"],
    actions: WITH_APPROVE,
  },
  {
    key: "leave",
    label: "Leave",
    description: "Leave requests, balances and leave types",
    paths: ["/leave"],
    actions: WITH_APPROVE,
  },
  {
    key: "facilities",
    label: "Facilities",
    description: "Accommodation, transport, inventory",
    paths: ["/accommodation", "/transport", "/inventory", "/api/checkins", "/dashboards/facilities"],
    actions: CORE,
  },
  {
    key: "timesheets",
    label: "Timesheets & attendance",
    description: "Attendance, client timesheets, uploads, generated sheets",
    paths: [
      "/attendance",
      "/invoices/client-timesheet",
      "/upload",
      "/companies",
      "/history",
      "/timesheets",
      "/api/upload",
      "/api/generate",
      "/dashboards/timesheets",
    ],
    actions: WITH_APPROVE,
  },
  {
    key: "partners",
    label: "Business partners",
    description: "Clients, suppliers, banks",
    paths: ["/clients", "/suppliers", "/banks", "/api/client-documents", "/dashboards/business-partners"],
    actions: WITH_APPROVE,
  },
  {
    key: "sales",
    label: "Sales",
    description: "Enquiries and quotations",
    paths: ["/sales", "/api/quotations", "/dashboards/sales"],
    actions: WITH_APPROVE,
  },
  {
    key: "billing",
    label: "Billing",
    description: "Client invoices and invoice history",
    paths: ["/invoices", "/api/invoices", "/dashboards/billing"],
    actions: CORE,
  },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);

const PATH_TABLE: { prefix: string; module: string }[] = MODULES.flatMap((m) =>
  m.paths.map((prefix) => ({ prefix, module: m.key }))
).sort((a, b) => b.prefix.length - a.prefix.length);

/** The module that owns a path, or null for shared/unrestricted pages
 * (dashboard home, profile, search, admin pages that gate themselves). */
export function moduleForPath(pathname: string): string | null {
  for (const { prefix, module } of PATH_TABLE) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return module;
  }
  return null;
}

export function permissionKey(module: string, action: PermissionAction) {
  return `${module}:${action}`;
}

/** Drops keys that no longer exist, so a renamed module can't grant phantom access. */
export function sanitizePermissions(keys: string[]): string[] {
  const valid = new Set(
    MODULES.flatMap((m) => m.actions.map((a) => permissionKey(m.key, a)))
  );
  return [...new Set(keys)].filter((k) => valid.has(k));
}

export type PermissionSubject = {
  role: "SUPER_ADMIN" | "BRANCH_ADMIN" | "STAFF" | string;
  /** Permission keys from the user's AccessRole, or null/undefined if none assigned. */
  permissions?: string[] | null;
};

export function can(subject: PermissionSubject, module: string, action: PermissionAction): boolean {
  if (subject.role === "SUPER_ADMIN" || subject.role === "BRANCH_ADMIN") return true;
  if (!subject.permissions) return true; // legacy STAFF: all operational modules
  return subject.permissions.includes(permissionKey(module, action));
}

/** Modules a subject may open at all — null means "no restriction". */
export function viewableModules(subject: PermissionSubject): string[] | null {
  if (subject.role !== "STAFF" || !subject.permissions) return null;
  return MODULE_KEYS.filter((k) => subject.permissions!.includes(permissionKey(k, "view")));
}

export const WRITE_ACTIONS: readonly PermissionAction[] = ["create", "edit", "delete", "approve"];

export function canWrite(subject: PermissionSubject, module: string): boolean {
  return WRITE_ACTIONS.some((a) => can(subject, module, a));
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
    name: "HR officer",
    description: "Full workforce, demand and facilities.",
    permissions: ["workforce", "demand", "facilities"].flatMap((m) =>
      MODULES.find((x) => x.key === m)!.actions.map((a) => permissionKey(m, a))
    ),
  },
];
