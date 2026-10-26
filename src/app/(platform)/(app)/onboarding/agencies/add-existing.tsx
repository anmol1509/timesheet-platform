"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { addExistingAsAgencyAction } from "./actions";

/** Picks a supplier that is already on file and marks it as a recruitment agency. */
export function AddExistingAgency({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [state, action, pending] = useActionState(
    async (_p: { error: string | null; ok?: boolean }, fd: FormData) => {
      const res = await addExistingAsAgencyAction(_p, fd);
      if (res.ok) { setSupplierId(""); router.refresh(); }
      return res;
    },
    { error: null } as { error: string | null; ok?: boolean },
  );
  if (suppliers.length === 0) return null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="supplierId" value={supplierId} />
      <div className="w-64"><Select value={supplierId} onChange={setSupplierId} searchable placeholder="Add an existing supplier…" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} /></div>
      <button type="submit" className="btn btn-secondary btn-sm" disabled={pending || !supplierId}>{pending ? "Adding…" : "Mark as agency"}</button>
      {state.error && <p role="alert" className="w-full text-sm text-[var(--error)]">{state.error}</p>}
    </form>
  );
}
