import type { LucideIcon } from "lucide-react";

export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        tone === "warning"
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {label}
        </span>
        {Icon && (
          <Icon
            className={`h-4 w-4 ${tone === "warning" ? "text-amber-500" : "text-slate-400"}`}
          />
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
