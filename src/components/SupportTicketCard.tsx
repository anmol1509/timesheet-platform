"use client";

import { useActionState, useState } from "react";
import { usePathname } from "next/navigation";
import { LifeBuoy, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { submitSupportTicketAction, type SupportTicketState } from "@/app/(app)/support/actions";

function SupportTicketForm({ onSent }: { onSent: () => void }) {
  const pathname = usePathname();
  const [state, action, pending] = useActionState<SupportTicketState, FormData>(
    async (prev, fd) => {
      const res = await submitSupportTicketAction(prev, fd);
      if (res.ok) onSent();
      return res;
    },
    { error: undefined, ok: false }
  );

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="page" value={pathname} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Subject</span>
        <input name="subject" required placeholder="e.g. Can't upload a timesheet" className="input w-full" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">What&apos;s going wrong?</span>
        <textarea name="message" required rows={4} placeholder="What you were doing, what happened, and what you expected instead." className="input w-full" />
      </label>
      <p className="text-xs text-subtle">Sent to info@manpowersync.com with your name and the page you&apos;re on.</p>
      {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Sending…" : "Send to support"}
        </button>
      </div>
    </form>
  );
}

/** Sidebar footer shortcut to email support directly — for a platform bug or question, not the AI assistant (see AskAiCard). */
export function SupportTicketCard() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSent(false);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center gap-3 rounded-xl border border-default bg-surface px-3 py-2.5 text-left transition hover:bg-surface-hover"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-secondary">
            <LifeBuoy className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-muted">Need help?</span>
            <span className="block truncate text-[13px] font-semibold text-secondary">Report an issue</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent title="Report an issue" description="Tell us what's not working — this goes straight to our support team.">
        {sent ? (
          <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-[var(--success)]" aria-hidden />
            <p className="text-sm font-medium text-primary">Sent — thanks for flagging it.</p>
            <p className="text-xs text-muted">Our team will follow up by email if we need more detail.</p>
          </div>
        ) : (
          <SupportTicketForm onSent={() => setSent(true)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
