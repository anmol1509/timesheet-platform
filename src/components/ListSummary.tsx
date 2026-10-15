"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { useViewerPref } from "@/lib/useViewerPref";
import { cn } from "@/lib/cn";

/**
 * A closed-by-default disclosure for the charts that belong with a list but
 * aren't what people open it for. Sits above the table; remembered per browser.
 */
export function Insights({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const [pref, setPref] = useViewerPref(`ui.insights.${id}`);
  const open = pref === "1";
  const panelId = useId();

  return (
    <section className="card">
      <h2>
        <button
          type="button"
          onClick={() => setPref(open ? "0" : "1")}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center gap-3 rounded-card px-5 py-3 text-left"
        >
          <span className="text-sm font-semibold text-primary">{title}</span>
          {hint && <span className="min-w-0 flex-1 truncate text-sm font-normal text-muted">{hint}</span>}
          <ChevronDown
            className={cn("ml-auto h-4 w-4 shrink-0 text-subtle transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </h2>
      <div id={panelId} hidden={!open}>
        {open && <div className="border-t border-default p-5">{children}</div>}
      </div>
    </section>
  );
}
