"use client";

import { useTransition } from "react";
import { voidVoucherAction } from "./actions";

/** Voids a manual voucher (the automatic ones follow their source). The reason is kept on the entry. */
export function VoidButton({ id, number }: { id: string; number: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const reason = prompt(`Void ${number}? Say why:`);
        if (reason?.trim()) start(async () => { const r = await voidVoucherAction(id, reason); if (r.error) alert(r.error); });
      }}
      className="text-xs font-medium text-muted hover:text-error"
    >
      Void
    </button>
  );
}
