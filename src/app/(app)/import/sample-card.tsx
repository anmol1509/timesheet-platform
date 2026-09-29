"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function SampleCard({ loaded }: { loaded: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: "POST" | "DELETE") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/import/sample", { method });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(body.error ?? "Something went wrong.");
    else router.refresh();
  }

  return (
    <section className="card flex flex-wrap items-center gap-4 p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-secondary">
        <FlaskConical className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-[240px] flex-1">
        <p className="text-sm font-semibold text-primary">{loaded ? "Sample company is loaded" : "Just want to look around first?"}</p>
        <p className="mt-0.5 text-xs text-muted">
          {loaded
            ? "Suppliers, clients, 24 workers and a month of hours and attendance, all marked (Sample). Remove them whenever you like; your own data isn't touched."
            : "Load a small sample company — suppliers, clients, 24 workers and a month of hours and attendance — and remove it in one click when you're ready to bring in your own."}
        </p>
        {error && <p className="mt-1 text-xs text-[var(--error)]">{error}</p>}
      </div>
      {loaded ? (
        <ConfirmDialog
          title="Remove the sample company?"
          description="Everything marked (Sample) is removed. Anything of your own stays exactly as it is."
          confirmLabel="Yes, remove it"
          onConfirm={() => call("DELETE")}
          trigger={(open) => (
            <button type="button" onClick={open} disabled={busy} className="btn btn-secondary">{busy ? "Removing…" : "Remove sample data"}</button>
          )}
        />
      ) : (
        <button type="button" onClick={() => call("POST")} disabled={busy} className="btn btn-secondary">{busy ? "Loading…" : "Load sample data"}</button>
      )}
    </section>
  );
}
