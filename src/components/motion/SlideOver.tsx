"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/cn";
import { DURATION, DURATION_SLOW, EASE } from "@/lib/motion";

/**
 * Right-anchored panel for record detail / multi-field editing without
 * leaving the list (e.g. the Daily Attendance day editor). Controlled, with
 * `forceMount` + `AnimatePresence` so the slide-out plays instead of the
 * panel just disappearing — Radix unmounts immediately otherwise.
 */
export function SlideOver({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  width = "26rem",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  width?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild forceMount>
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION, ease: EASE }}
                className="fixed inset-0 z-40 bg-[#101828]/40 backdrop-blur-[2px]"
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild forceMount>
              <m.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: DURATION_SLOW, ease: [0.16, 1, 0.3, 1] }}
                style={{ width }}
                className={cn(
                  "fixed inset-y-0 right-0 z-50 flex max-w-[calc(100vw-2rem)] flex-col overflow-y-auto border-l border-default bg-surface p-5 shadow-modal outline-none",
                  className
                )}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <RadixDialog.Title className="text-base font-semibold tracking-tight text-primary">
                      {title}
                    </RadixDialog.Title>
                    {description && (
                      <RadixDialog.Description className="mt-1 text-sm text-muted">
                        {description}
                      </RadixDialog.Description>
                    )}
                  </div>
                  <RadixDialog.Close
                    aria-label="Close"
                    className="shrink-0 rounded-md p-1.5 text-subtle transition hover:bg-surface-hover hover:text-secondary"
                  >
                    <X className="h-4 w-4" />
                  </RadixDialog.Close>
                </div>
                {children}
              </m.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}
