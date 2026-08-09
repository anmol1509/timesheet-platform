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
          className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="rx-overlay fixed inset-0 z-40 bg-slate-950/40 lg:hidden" />
        <RadixDialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-100 bg-white outline-none lg:hidden">
          <RadixDialog.Title className="sr-only">Navigation</RadixDialog.Title>
          <div className="flex items-center justify-between px-5 py-5">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-[var(--brand-navy)] text-sm font-bold text-white shadow-sm">
                TS
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">ERP System</p>
                <p className="text-xs text-slate-400">Labor Management</p>
              </div>
            </Link>
            <RadixDialog.Close
              aria-label="Close navigation"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </RadixDialog.Close>
          </div>
          {/* Only actual navigation (an <a> click) closes the drawer — group-expand toggles are buttons and must not. */}
          <div
            className="flex-1 overflow-y-auto px-3 pb-4"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            <p className="px-3 pt-2 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              Navigation
            </p>
            <NavLinks isAdmin={isAdmin} />
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
