"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { syncAllAction } from "./actions";

import { Button } from "@/components/ui/Button";
export function SyncAllButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      {error && <p role="alert" className="text-xs text-[var(--error)]">{error}</p>}
      <Button variant="secondary" size="btn-sm" className="inline-flex items-center gap-1.5" type="button" disabled={pending} onClick={() => { setError(null); start(async () => { const r = await syncAllAction(); if (r.error) setError(r.error); router.refresh(); }); }} loading={pending}>
        <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} aria-hidden />Refresh usage
      </Button>
    </div>
  );
}
