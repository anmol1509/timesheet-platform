"use client";

import { Keyboard } from "lucide-react";
import { AskAiCard } from "@/components/BrandMark";
import { SupportTicketCard } from "@/components/SupportTicketCard";

/**
 * The sidebar footer: the assistant, reporting an issue and the shortcut list on one slim row,
 * instead of two stacked "Need help?" cards.
 */
export function SidebarHelp({ onAssistant }: { onAssistant?: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="min-w-0 flex-1" onClick={onAssistant}>
        <AskAiCard compact />
      </div>
      {/* No close-on-click for the report dialog: it opens inside the mobile drawer's tree, which closing would unmount. */}
      <SupportTicketCard compact />
      <button
        type="button"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        onClick={() => window.dispatchEvent(new Event("open-shortcuts"))}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-default bg-surface text-muted transition hover:bg-surface-hover hover:text-primary"
      >
        <Keyboard className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
