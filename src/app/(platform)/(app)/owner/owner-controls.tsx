"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { syncAllAction } from "./actions";

export function SyncAllButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      {error && <p role="alert" className="text-xs text-[var(--error)]">{error}</p>}
      <button type="button" className="btn btn-secondary btn-sm inline-flex items-center gap-1.5" disabled={pending} onClick={() => { setError(null); start(async () => { const r = await syncAllAction(); if (r.error) setError(r.error); router.refresh(); }); }}>
        <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} aria-hidden />{pending ? "Reading usage…" : "Refresh usage"}
      </button>
    </div>
  );
}
