"use client";

import { useEffect, useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A panel that slides in from the right edge: for details and quick fixes that should not push the page down. The page
 * behind stays where it was, and closing returns to the same spot.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  // While it slides out the parent has already emptied its content, so keep showing what was there.
  const [last, setLast] = useState({ title, description, children });
  useEffect(() => {
    if (open) setLast({ title, description, children });
  }, [open, title, description, children]);
  const view = open ? { title, description, children } : last;

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="rx-overlay fixed inset-0 z-40 bg-[#101828]/30" />
        <RadixDialog.Content
          className={cn(
            "rx-sheet-right fixed top-0 right-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-default bg-surface shadow-modal outline-none",
            className
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-default px-5 py-4">
            <div className="min-w-0">
              <RadixDialog.Title className="text-base font-semibold tracking-tight text-primary">{view.title}</RadixDialog.Title>
              {view.description ? (
                <RadixDialog.Description className="mt-0.5 text-sm text-muted">{view.description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{view.title}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close aria-label="Close" className="rounded-md p-1 text-subtle transition hover:bg-surface-hover hover:text-secondary">
              <X className="h-4 w-4" />
            </RadixDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{view.children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
