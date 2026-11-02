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
  icon,
  tone,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  description?: string;
  /** Set true when the visible content already includes a heading, to avoid a duplicate title while keeping one for screen readers. */
  hideTitle?: boolean;
  /** A small icon shown in a soft round tile beside the title. */
  icon?: React.ReactNode;
  /** "danger" tints the icon tile red, for confirmations that delete something. */
  tone?: "danger";
}) {
  // A width asked for by the caller replaces the default one. Without this the default cap won over any wider size
  // (the two classes tie and the smaller cap is defined later), so wide dialogs were stuck at the default width.
  const ownWidth = !!className && /(^|\s)(?:[a-z]+:)?max-w-/.test(className);
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="rx-overlay fixed inset-0 z-40 bg-[#101828]/40 backdrop-blur-[2px]" />
      <RadixDialog.Content
        className={cn(
          `rx-content rx-dialog fixed top-1/2 left-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] ${ownWidth ? "" : "max-w-xl"} -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-default bg-surface p-6 shadow-modal outline-none sm:p-7`,
          className
        )}
      >
        <div className={cn("mb-4 flex items-start gap-3.5", hideTitle && !icon && "contents")}>
          {icon && <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone === "danger" ? "bg-[var(--error-soft)] text-[var(--error)]" : "bg-surface-sunken text-secondary")} aria-hidden>{icon}</span>}
          <div className="min-w-0 flex-1">
            {hideTitle ? (
              <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
            ) : (
              <RadixDialog.Title className="pr-8 text-lg font-semibold tracking-tight text-primary">
                {title}
              </RadixDialog.Title>
            )}
            {description && (
              <RadixDialog.Description className="mt-0.5 pr-8 text-sm text-muted">
                {description}
              </RadixDialog.Description>
            )}
          </div>
        </div>
        <RadixDialog.Close
          aria-label="Close"
          className="absolute top-5 right-5 rounded-md p-1 text-subtle transition hover:bg-surface-hover hover:text-secondary"
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
    <div className={cn("-mx-6 mt-6 flex items-center justify-end gap-3 border-t border-default px-6 pt-5 sm:-mx-7 sm:px-7", className)}>
      {children}
    </div>
  );
}
