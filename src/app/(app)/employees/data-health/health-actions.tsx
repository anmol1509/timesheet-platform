"use client";

import Link from "next/link";
import { useState } from "react";
import { Send } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { requestProfileCompletionAction, type RequestOutcome } from "./actions";

export function HealthActions({ missing, incomplete }: { missing: string | null; incomplete: number }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<RequestOutcome | null>(null);
  const [copied, setCopied] = useState(false);

  async function send() {
    setBusy(true);
    setOut(await requestProfileCompletionAction(missing));
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/import/new/workers" className="btn btn-secondary">Fill from a spreadsheet</Link>
      <ConfirmDialog
        title="Ask workers to complete their details?"
        danger={false}
        confirmLabel="Send"
        description={`Workers with a mobile number get a message with a link to their portal, where they can add what's missing. Anyone asked in the last 7 days is skipped. ${missing ? "Only workers missing this detail are asked." : `${incomplete} workers have gaps.`}`}
        onConfirm={send}
        trigger={(open) => (
          <button type="button" onClick={open} disabled={busy || incomplete === 0} className="btn btn-primary inline-flex items-center gap-1.5">
            <Send className="h-4 w-4" aria-hidden /> {busy ? "Sending…" : "Ask workers to complete"}
          </button>
        )}
      />
      {out && (
        <div className="basis-full rounded-lg border border-default bg-surface-subtle p-3 text-sm">
          {out.sent > 0 && <p className="text-[var(--success)]">Sent to {out.sent} worker{out.sent === 1 ? "" : "s"}.</p>}
          {out.failed > 0 && <p className="text-[var(--error)]">{out.failed} messages failed to send.</p>}
          {out.skippedRecent > 0 && <p className="text-muted">{out.skippedRecent} asked in the last 7 days — skipped.</p>}
          {out.noMobile > 0 && <p className="text-muted">{out.noMobile} have no mobile number — add one first.</p>}
          {out.notConfigured && (
            <div className="mt-1 space-y-2">
              <p className="text-[var(--warning)]">Messaging (WhatsApp / SMS) isn&rsquo;t set up for this system yet, so nothing was sent. Copy the message and send it yourself to these {out.numbers.length} numbers:</p>
              <textarea readOnly className="input w-full text-xs" rows={3} value={out.message} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { await navigator.clipboard.writeText(`${out.message}\n\n${out.numbers.join("\n")}`); setCopied(true); }}>
                {copied ? "Copied" : "Copy message and numbers"}
              </button>
            </div>
          )}
          {out.sent === 0 && !out.notConfigured && out.failed === 0 && out.skippedRecent === 0 && out.noMobile === 0 && <p className="text-muted">Nobody to ask right now.</p>}
        </div>
      )}
    </div>
  );
}
