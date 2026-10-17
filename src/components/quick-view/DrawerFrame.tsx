"use client";

import Link from "next/link";
import * as RadixDialog from "@radix-ui/react-dialog";
import { ArrowRight, Check, ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type FrameTab = { id: string; label: string; count?: number };

/**
 * The shell every quick-view panel shares: a right-hand slide-over with the purple header (previous / next, link
 * to the full page, avatar, title, status), tabs, a scrolling body, an Undo bar and a footer button that moves to
 * the next record. The panel supplies the tabs and what goes in them.
 */
export function DrawerFrame({
  index,
  total,
  onStep,
  fullHref,
  fullLabel = "Open full profile",
  avatar,
  title,
  subtitle,
  badge,
  tabs,
  tab,
  onTab,
  undo,
  footerHint,
  nextLabel,
  onNext,
  nextDisabled,
  onClose,
  children,
}: {
  /** Position in the list this was opened from, when known. */
  index: number;
  total: number;
  onStep: (delta: number) => void;
  fullHref: string;
  fullLabel?: string;
  avatar?: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  tabs: FrameTab[];
  tab: string;
  onTab: (id: string) => void;
  undo?: { label: string; onUndo: () => void } | null;
  footerHint?: string;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <RadixDialog.Root open onOpenChange={(o) => !o && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="rx-overlay fixed inset-0 z-40 bg-[#101828]/30" />
        <RadixDialog.Content
          aria-describedby={undefined}
          // Esc cancels a field being edited before it closes the panel.
          onEscapeKeyDown={(e) => { if (document.querySelector("[data-editing]")) e.preventDefault(); }}
          onKeyDown={(e) => {
            const t = e.target as HTMLElement;
            if (t.closest("input,textarea,select,[role=combobox],[contenteditable=true]")) return;
            if (e.key === "j") onStep(1);
            if (e.key === "k") onStep(-1);
          }}
          className="rx-drawer fixed top-3 right-3 bottom-3 z-50 flex w-[440px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-[22px] border border-default bg-surface shadow-modal outline-none"
        >
          <header className="bg-[linear-gradient(135deg,#43359f_0%,#5b49d8_55%,#7a4fe3_100%)] px-5 pt-3.5 text-white">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <button type="button" onClick={() => onStep(-1)} disabled={total < 2} aria-label="Previous" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
                <button type="button" onClick={() => onStep(1)} disabled={total < 2} aria-label="Next" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-40"><ChevronRight className="h-4 w-4" aria-hidden /></button>
                {index >= 0 && <span className="ml-1 text-white/75">{index + 1} of {total}</span>}
              </span>
              <span className="flex items-center gap-2.5">
                <Link href={fullHref} className="flex items-center gap-1 font-medium text-white/90 hover:text-white">{fullLabel}<ExternalLink className="h-3 w-3" aria-hidden /></Link>
                <RadixDialog.Close aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25"><X className="h-4 w-4" aria-hidden /></RadixDialog.Close>
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              {avatar}
              <div className="min-w-0 flex-1">
                <RadixDialog.Title className="truncate text-lg font-semibold tracking-tight">{title}</RadixDialog.Title>
                {subtitle && <p className="truncate text-xs text-white/80">{subtitle}</p>}
              </div>
              {badge && <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-[10.5px] font-semibold">{badge}</span>}
            </div>
            <div role="tablist" aria-label="Sections" className="mt-3 flex gap-0.5">
              {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)}
                  className={cn("flex items-center gap-1.5 rounded-t-[10px] px-3 py-2 text-sm font-medium", tab === t.id ? "bg-surface text-[var(--brand-primary)]" : "text-white/75 hover:text-white")}>
                  {t.label}
                  {!!t.count && <span className="rounded-full bg-[#fde68a] px-1.5 text-[10px] font-bold text-[#78350f]">{t.count}</span>}
                </button>
              ))}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4" role="tabpanel">{children}</div>

          {undo && (
            <div role="status" className="mx-5 mb-2 flex items-center justify-between rounded-xl bg-[#1e1b3a] px-3.5 py-2.5 text-sm font-medium text-white">
              <span className="flex items-center gap-2"><Check className="h-4 w-4" aria-hidden />Saved · {undo.label} updated</span>
              <button type="button" onClick={undo.onUndo} className="font-semibold text-[#c4b8ff] hover:underline">Undo</button>
            </div>
          )}

          <footer className="flex items-center justify-between gap-3 border-t border-default px-5 py-3">
            <span className="text-xs text-muted">{footerHint ?? "Esc to close · J / K to move"}</span>
            <button type="button" className="btn btn-primary gap-1.5" onClick={onNext} disabled={nextDisabled}>{nextLabel}<ArrowRight className="h-4 w-4" aria-hidden /></button>
          </footer>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
