import { Badge, type BadgeColor } from "@/components/Badge";
import type { ChecklistItem } from "@/lib/documentTypes";

const STATE: Record<ChecklistItem["state"], { label: string; color: BadgeColor }> = {
  valid: { label: "Valid", color: "green" },
  uploaded: { label: "On file", color: "blue" },
  expiring: { label: "Expiring", color: "amber" },
  expired: { label: "Expired", color: "red" },
  missing: { label: "Missing", color: "slate" },
};

/** One row per document type: its status, the expiry of the file that stands for it, and a link to open it. */
export function DocumentChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-default bg-surface">
      {items.map((r) => {
        const missingRequired = r.state === "missing" && r.required;
        const state = STATE[r.state];
        return (
          <li key={r.type.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="font-medium text-primary">{r.type.label}</span>
              {r.required && <span className="ml-2 text-xs text-muted">Required</span>}
            </span>
            {r.current && (
              <a href={`/api/attachments/${r.current.id}`} target="_blank" rel="noreferrer" className="max-w-[16rem] truncate text-xs text-[var(--brand-primary)] hover:underline">
                {r.current.filename}
              </a>
            )}
            {r.current?.expiryDate && r.type.hasExpiry && (
              <span className="tabular text-xs text-muted">
                {r.daysLeft !== null && r.daysLeft < 0 ? `expired ${-r.daysLeft}d ago` : `${new Date(r.current.expiryDate).toLocaleDateString()} · ${r.daysLeft}d left`}
              </span>
            )}
            {r.count > 1 && <span className="text-xs text-muted">{r.count} files</span>}
            <Badge color={missingRequired ? "red" : state.color}>{missingRequired ? "Missing — required" : state.label}</Badge>
          </li>
        );
      })}
    </ul>
  );
}
