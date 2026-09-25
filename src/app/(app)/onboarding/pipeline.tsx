import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { STAGES, statusKind, type OnboardingStatuses } from "@/lib/onboarding";

/** The whole pipeline at a glance — "Candidate received" through "Joined",
 * each node coloured by its current status. A wide table of accordions
 * tells you the detail; this tells you the shape of where they are in one
 * look, the way the flowchart this module was built from reads. */
export function Pipeline({ row, joined }: { row: OnboardingStatuses; joined: boolean }) {
  const nodes = [
    { label: "Received", kind: "done" as const },
    ...STAGES.map((stage) => ({ label: stage.short, kind: statusKind(stage, row[stage.field]) })),
    { label: "Joined", kind: joined ? ("done" as const) : ("pending" as const) },
  ];

  return (
    <div className="card overflow-x-auto p-4">
      <ol className="flex min-w-max items-center gap-1">
        {nodes.map((node, i) => (
          <li key={node.label} className="flex items-center gap-1">
            {i > 0 && (
              <span
                className={cn(
                  "h-0.5 w-4 shrink-0 sm:w-6",
                  nodes[i - 1].kind === "done" && node.kind !== "pending" ? "bg-[var(--success)]" : "bg-[var(--border)]"
                )}
                aria-hidden
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  node.kind === "done" && "bg-[var(--success)] text-white",
                  node.kind === "progress" && "bg-[var(--warning-soft,#fef3c7)] text-[var(--warning-text,#92400e)]",
                  node.kind === "pending" && "bg-surface-subtle text-subtle",
                  node.kind === "issue" && "bg-[var(--error-soft,#fee4e2)] text-[var(--error)]"
                )}
              >
                {node.kind === "done" ? <Check className="h-3.5 w-3.5" /> : node.kind === "issue" ? <X className="h-3.5 w-3.5" /> : i}
              </span>
              <span className="max-w-[4.5rem] truncate text-[10px] text-muted" title={node.label}>
                {node.label}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
