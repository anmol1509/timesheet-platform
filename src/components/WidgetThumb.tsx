import { cn } from "@/lib/cn";

/**
 * Miniature wireframes of the dashboard widgets, shown in the Customize
 * dialog so people pick sections by what they look like rather than by a
 * long label. Pure markup — no data, no charts — so it stays cheap to render
 * ten at a time.
 */

const B = "rounded-[2px] bg-[var(--border-strong)]";
const BRAND = "rounded-[2px] bg-[var(--brand-primary)]";
const SOFT = "rounded-[2px] bg-[var(--brand-primary)]/30";
const LINE = "h-[3px] rounded-full bg-[var(--border-strong)]";

function Card({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[4px] border border-default bg-surface p-1.5", className)}>
      {children}
    </div>
  );
}

function Kpis({ n = 4 }: { n?: number }) {
  return (
    <div className="flex h-full items-stretch divide-x divide-[var(--border)] rounded-[4px] border border-default bg-surface">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex flex-1 flex-col justify-center gap-1 px-1.5">
          <div className={cn(LINE, "w-1/2")} />
          <div className={cn("h-2 w-2/3", i === 1 ? BRAND : B)} />
        </div>
      ))}
    </div>
  );
}

function Segmented({ parts }: { parts: number[] }) {
  return (
    <div className="flex h-1.5 gap-px overflow-hidden rounded-full">
      {parts.map((p, i) => (
        <span
          key={i}
          style={{ width: `${p}%` }}
          className={i % 2 === 0 ? "bg-[var(--brand-primary)]" : "bg-[var(--border-strong)]"}
        />
      ))}
    </div>
  );
}

function Bars({ heights }: { heights: number[] }) {
  return (
    <div className="flex h-full items-end gap-[3px]">
      {heights.map((h, i) => (
        <span key={i} style={{ height: `${h}%` }} className={cn("flex-1", i === 4 ? BRAND : SOFT)} />
      ))}
    </div>
  );
}

function List({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-[2px] bg-[var(--warning)]/50" />
          <div className={cn(LINE, "flex-1")} />
          <div className={cn(LINE, "w-3")} />
        </div>
      ))}
    </div>
  );
}

function Ring() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-9 w-9 rounded-full border-[5px] border-[var(--border-strong)] border-t-[var(--brand-primary)] border-r-[var(--brand-primary)]" />
    </div>
  );
}

const THUMBS: Record<string, () => React.ReactNode> = {
  kpi: () => <Kpis />,
  "trend-attention": () => (
    <div className="grid h-full grid-cols-3 gap-1">
      <Card className="col-span-2">
        <Bars heights={[30, 45, 40, 60, 80, 50, 35]} />
      </Card>
      <Card>
        <List />
      </Card>
    </div>
  ),
  "timesheet-pipeline": () => (
    <div className="grid h-full grid-cols-3 gap-1">
      <Card className="col-span-2 flex flex-col justify-center gap-2">
        <div className={cn("h-2.5 w-6", B)} />
        <Segmented parts={[10, 20, 25, 30, 15]} />
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn(LINE, "flex-1")} />
          ))}
        </div>
      </Card>
      <Card>
        <Bars heights={[8, 8, 8, 8, 90, 8, 8]} />
      </Card>
    </div>
  ),
  "compliance-runway": () => (
    <Card className="flex h-full flex-col justify-center gap-2">
      <Segmented parts={[8, 22, 30, 40]} />
      <div className="space-y-1.5">
        <div className={cn(LINE, "w-3/4")} />
        <div className={cn(LINE, "w-1/2")} />
        <div className={cn(LINE, "w-1/3")} />
      </div>
    </Card>
  ),
  "document-expiry": () => <Kpis />,
  composition: () => (
    <div className="grid h-full grid-cols-3 gap-1">
      <Card className="col-span-2 space-y-2">
        <div className={cn(LINE, "w-full")} />
        <div className={cn("h-[3px] w-2/3 rounded-full bg-[var(--brand-primary)]")} />
        <div className={cn(LINE, "w-1/4")} />
      </Card>
      <Card>
        <Ring />
      </Card>
    </div>
  ),
  "staff-partners-facilities": () => (
    <div className="grid h-full grid-cols-3 gap-1">
      <Card>
        <List rows={3} />
      </Card>
      <Card className="space-y-2">
        <div className={cn(LINE, "w-full")} />
        <div className={cn(LINE, "w-full")} />
        <div className={cn(LINE, "w-full")} />
      </Card>
      <Card>
        <Ring />
      </Card>
    </div>
  ),
  "quick-actions": () => (
    <div className="grid h-full grid-cols-4 gap-1">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="flex items-center gap-1">
          <span className={cn("h-3 w-3", B)} />
          <div className={cn(LINE, "flex-1")} />
        </Card>
      ))}
    </div>
  ),
  "months-with-data": () => (
    <Card className="flex h-full flex-wrap content-center gap-1">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="h-2.5 w-8 rounded-[3px] border border-default bg-[var(--surface-sunken)]" />
      ))}
    </Card>
  ),
};

/** 16:8 preview tile. Unknown ids fall back to a plain card so new widgets never break the dialog. */
export function WidgetThumb({ id, muted }: { id: string; muted?: boolean }) {
  const render = THUMBS[id];
  return (
    <div
      className={cn(
        "h-16 w-32 shrink-0 overflow-hidden rounded-control border border-default bg-[var(--surface-sunken)] p-1.5 transition",
        muted && "opacity-40 grayscale"
      )}
      aria-hidden
    >
      {render ? render() : <Card className="h-full" />}
    </div>
  );
}
