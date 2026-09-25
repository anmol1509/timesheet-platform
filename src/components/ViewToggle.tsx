import Link from "next/link";
import { KanbanSquare, List } from "lucide-react";
import { cn } from "@/lib/cn";

/** List | Board switch driven by `?view=board`, so both stay deep-linkable. */
export function ViewToggle({ base, view }: { base: string; view: "list" | "board" }) {
  const item = (v: "list" | "board", label: string, Icon: typeof List) => (
    <Link
      href={v === "board" ? `${base}?view=board` : base}
      aria-current={view === v ? "page" : undefined}
      className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition", view === v ? "bg-surface font-medium text-primary shadow-sm" : "text-muted hover:text-primary")}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Link>
  );
  return <div className="inline-flex rounded-lg bg-surface-sunken p-0.5">{item("list", "List", List)}{item("board", "Board", KanbanSquare)}</div>;
}
