"use client";

import { useTransition } from "react";
import { cancelMyLeaveAction } from "./actions";

export function CancelLeaveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs text-[var(--brand-primary)] hover:underline disabled:opacity-50"
      onClick={() => start(async () => { const fd = new FormData(); fd.set("id", id); await cancelMyLeaveAction(fd); })}
    >
      {pending ? "Cancelling…" : "Cancel request"}
    </button>
  );
}
