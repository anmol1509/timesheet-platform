import { isOnWork } from "@/lib/employeeStage";

/**
 * The rules behind the Daily Attendance roster filters.
 *
 * Pulled out of the form because they are the part worth being sure about: the
 * filters cascade, and a combination that can only ever match nobody looks
 * exactly like a day with nobody on site.
 */

export type FilterableEmployee = {
  name: string;
  employeeIdNo: string;
  trade: string | null;
  status: string;
  supplierId: string | null;
  clientId: string | null;
  projectId: string | null;
  siteId: string | null;
};

export type StatusFilter = "all" | "working" | "IDLE";

/**
 * Selecting a supplier implies its subsidiaries: their workers are on the same
 * job, and marking them separately is how a day ends up half done.
 */
export function expandSuppliers(
  supplierIds: string[],
  suppliers: { id: string; parentId: string | null }[]
): Set<string> | null {
  if (supplierIds.length === 0) return null;
  const wanted = new Set(supplierIds);
  for (const s of suppliers) {
    if (s.parentId && wanted.has(s.parentId)) wanted.add(s.id);
  }
  return wanted;
}

/** Projects belonging to the chosen client, or all of them when none is chosen. */
export function projectsForClient<T extends { clientId: string }>(
  projects: T[],
  clientId: string
): T[] {
  return clientId ? projects.filter((p) => p.clientId === clientId) : projects;
}

/**
 * Sites under whatever has been narrowed to so far — a chosen project, else the
 * chosen client's projects, else everything.
 */
export function sitesForScope<S extends { projectId: string }>(
  sites: S[],
  projectsInScope: { id: string }[],
  clientId: string,
  projectId: string
): S[] {
  if (projectId) return sites.filter((x) => x.projectId === projectId);
  if (clientId) {
    const ids = new Set(projectsInScope.map((p) => p.id));
    return sites.filter((x) => ids.has(x.projectId));
  }
  return sites;
}

/**
 * Whether a worker survives the current filters.
 *
 * A worker has no client of their own; they reach one through their project,
 * which is why an unassigned worker drops out as soon as a client is chosen.
 */
export function matchesFilters(
  e: FilterableEmployee,
  f: {
    supplierIds: Set<string> | null;
    clientId: string;
    projectId: string;
    siteId: string;
    status: StatusFilter;
    query: string;
  }
): boolean {
  if (f.supplierIds && !(e.supplierId && f.supplierIds.has(e.supplierId))) return false;
  if (f.clientId && e.clientId !== f.clientId) return false;
  if (f.projectId && e.projectId !== f.projectId) return false;
  if (f.siteId && e.siteId !== f.siteId) return false;
  if (f.status === "working" && !isOnWork(e.status)) return false;
  if (f.status === "IDLE" && e.status !== "IDLE") return false;

  const q = f.query.trim().toLowerCase();
  if (q && !`${e.name} ${e.employeeIdNo} ${e.trade ?? ""}`.toLowerCase().includes(q)) {
    return false;
  }
  return true;
}
