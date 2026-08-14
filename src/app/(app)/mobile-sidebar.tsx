"use client";

import { useState } from "react";
import Link from "next/link";
import * as RadixDialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { NavLinks } from "./nav-links";

export function MobileSidebar({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Trigger asChild>
        <button
          type="button"
          aria-label="Open navigation"
          className="shrink-0 rounded-md p-2 text-muted transition hover:bg-surface-hover hover:text-primary lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="rx-overlay fixed inset-0 z-40 bg-[#101828]/40 backdrop-blur-[2px] lg:hidden" />
        <RadixDialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-default bg-surface outline-none lg:hidden">
          <RadixDialog.Title className="sr-only">Navigation</RadixDialog.Title>
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-default pr-2 pl-3">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex min-w-0 items-center gap-2.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-[var(--brand-navy)] text-[11px] font-bold text-white">
                BA
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-primary">
                  Burj Al Aweer
                </span>
                <span className="block truncate text-[11px] text-subtle">
                  Manpower ERP
                </span>
              </span>
            </Link>
            <RadixDialog.Close
              aria-label="Close navigation"
              className="shrink-0 rounded-md p-1.5 text-subtle transition hover:bg-surface-hover hover:text-secondary"
            >
              <X className="h-4 w-4" />
            </RadixDialog.Close>
          </div>
          {/* Only actual navigation (an <a> click) closes the drawer — group-expand toggles are buttons and must not. */}
          <div
            className="flex-1 overflow-y-auto px-3 py-3"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">
              Navigation
            </p>
            <NavLinks isAdmin={isAdmin} />
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
