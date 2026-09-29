"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function UndoImportButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <ConfirmDialog
        title="Undo this import?"
        description="Everything it created is removed and everything it changed goes back as it was. Records other data now depends on are kept and reported."
        confirmLabel="Yes, undo it"
        onConfirm={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/import/${batchId}/undo`, { method: "POST" });
          const body = await res.json().catch(() => ({}));
          setBusy(false);
          if (!res.ok) setError(body.error ?? "Could not undo.");
          else router.refresh();
        }}
        trigger={(open) => (
          <button type="button" onClick={open} disabled={busy} className="text-xs font-medium text-[var(--brand-primary)] hover:underline disabled:opacity-50">
            {busy ? "Undoing…" : "Undo"}
          </button>
        )}
      />
      {error && <span className="ml-2 text-xs text-[var(--error)]">{error}</span>}
    </>
  );
}
