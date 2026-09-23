"use client";

import { useEffect, useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

const GROUPS: { title: string; rows: { keys: string[]; label: string }[] }[] = [
  {
    title: "Navigate",
    rows: [
      { keys: ["⌘", "K"], label: "Open the command palette" },
      { keys: ["?"], label: "Show this shortcuts sheet" },
      { keys: ["Esc"], label: "Close a dialog, panel or the palette" },
    ],
  },
  {
    title: "Command palette",
    rows: [
      { keys: ["↑", "↓"], label: "Move between results" },
      { keys: ["↵"], label: "Open the highlighted result" },
    ],
  },
];

/**
 * Press `?` anywhere outside a text field to see this. Mounted once in the
 * shell. Deliberately small — three real shortcuts today (⌘K, ?, Esc) rather
 * than padding it out with things that aren't shortcuts yet.
 */
export function ShortcutsSheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable || tag === "SELECT";
      if (typing) return;
      e.preventDefault();
      setOpen((v) => !v);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="rx-overlay fixed inset-0 z-40 bg-[#101828]/40 backdrop-blur-[2px]" />
        <RadixDialog.Content className="rx-content fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-default bg-surface p-5 shadow-modal outline-none">
          <RadixDialog.Title className="pr-8 text-base font-semibold tracking-tight text-primary">
            Keyboard shortcuts
          </RadixDialog.Title>
          <RadixDialog.Close
            aria-label="Close"
            className="absolute top-4 right-4 rounded-md p-1 text-subtle transition hover:bg-surface-hover hover:text-secondary"
          >
            <X className="h-4 w-4" />
          </RadixDialog.Close>
          <div className="mt-4 space-y-4">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                  {g.title}
                </p>
                <div className="space-y-1.5">
                  {g.rows.map((r) => (
                    <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-secondary">{r.label}</span>
                      <span className="flex shrink-0 gap-1">
                        {r.keys.map((k) => (
                          <kbd
                            key={k}
                            className="rounded border border-default bg-surface-subtle px-1.5 py-0.5 font-sans text-[11px] font-medium text-secondary"
                          >
                            {k}
                          </kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
