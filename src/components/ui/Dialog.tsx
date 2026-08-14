"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;

export function DialogContent({
  children,
  className,
  title,
  description,
  hideTitle,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  description?: string;
  /** Set true when the visible content already includes a heading, to avoid a duplicate title while keeping one for screen readers. */
  hideTitle?: boolean;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="rx-overlay fixed inset-0 z-40 bg-[#101828]/40 backdrop-blur-[2px]" />
      <RadixDialog.Content
        className={cn(
          "rx-content fixed top-1/2 left-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-default bg-surface p-5 shadow-modal outline-none",
          className
        )}
      >
        {hideTitle ? (
          <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
        ) : (
          <RadixDialog.Title className="pr-8 text-base font-semibold tracking-tight text-primary">
            {title}
          </RadixDialog.Title>
        )}
        {description && (
          <RadixDialog.Description className="mt-1 pr-8 text-sm text-muted">
            {description}
          </RadixDialog.Description>
        )}
        <RadixDialog.Close
          aria-label="Close"
          className="absolute top-4 right-4 rounded-md p-1 text-subtle transition hover:bg-surface-hover hover:text-secondary"
        >
          <X className="h-4 w-4" />
        </RadixDialog.Close>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export const DialogClose = RadixDialog.Close;

export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mt-6 flex items-center justify-end gap-3", className)}>
      {children}
    </div>
  );
}
