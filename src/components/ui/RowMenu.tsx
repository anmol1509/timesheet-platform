"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

export type RowMenuItem = { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean };

/** The ⋯ menu at the end of a table row: the occasional actions, so the row keeps one obvious button. */
export function RowMenu({ items, label = "More actions" }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={label} className="rounded-md p-1.5 text-subtle hover:bg-surface-hover hover:text-secondary"><MoreHorizontal className="h-4 w-4" aria-hidden /></button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} className="z-50 min-w-40 rounded-xl border border-default bg-surface p-1 shadow-modal outline-none">
          {items.map((it) => (
            <button key={it.label} type="button" disabled={it.disabled} onClick={() => { setOpen(false); it.onSelect(); }} className={cn("block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-surface-hover disabled:opacity-50", it.danger ? "text-[var(--error)]" : "text-primary")}>{it.label}</button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
