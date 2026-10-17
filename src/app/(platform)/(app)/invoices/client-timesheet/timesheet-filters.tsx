"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";

type Option = { value: string; label: string };

/** Month / client / project / site: the sheet reloads as soon as one changes, no Go button. */
export function TimesheetFilters({ month, clientId, project, site, months, clients, projects, sites }: {
  month: string;
  clientId: string;
  project: string;
  site: string;
  months: Option[];
  clients: Option[];
  projects: Option[];
  sites: Option[];
}) {
  const router = useRouter();
  function go(next: Partial<{ month: string; clientId: string; project: string; site: string }>) {
    // Changing the month or client invalidates the project / site picked under the old one.
    const reset = "month" in next || "clientId" in next ? { project: "", site: "" } : {};
    const all = { month, clientId, project, site, ...reset, ...next };
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(all)) if (v) q.set(k, v);
    router.push(`/invoices/client-timesheet?${q.toString()}`);
  }
  const label = "mb-1 block text-xs font-medium text-muted";
  return (
    <div className="card flex flex-wrap items-end gap-3 p-4 [&_label]:min-w-0">
      <label className="block min-w-0 max-w-full">
        <span className={label}>Month</span>
        <Select value={month} onChange={(v) => go({ month: v })} options={months} />
      </label>
      <label className="block min-w-0 max-w-full">
        <span className={label}>Client</span>
        <Select value={clientId} onChange={(v) => go({ clientId: v })} options={clients} />
      </label>
      {/* Always shown, even with nothing to offer: a control that says why it is empty beats one that vanishes. */}
      <label className="block min-w-0 max-w-full">
        <span className={label}>Project</span>
        <Select value={project} onChange={(v) => go({ project: v })} disabled={projects.length <= 1} options={projects} />
      </label>
      <label className="block min-w-0 max-w-full">
        <span className={label}>Site</span>
        <Select value={site} onChange={(v) => go({ site: v })} disabled={sites.length <= 1} options={sites} />
      </label>
    </div>
  );
}
