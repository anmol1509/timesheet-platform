"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getWorkmenCompOverviewAction } from "../actions";
import { WorkmenCompSection, type WcPolicy } from "./workmen-comp-section";

/** The workmen compensation section for places that are not the company's own page (the side panel): it loads its own policies and reloads after each change. */
export function WorkmenCompPanel({ supplierId, canEdit }: { supplierId: string; canEdit: boolean }) {
  const [data, setData] = useState<{ policies: WcPolicy[]; workers: number } | null | undefined>(undefined);
  const load = useCallback(() => { getWorkmenCompOverviewAction(supplierId).then(setData).catch(() => setData(null)); }, [supplierId]);
  useEffect(() => { load(); }, [load]);
  if (data === undefined) return <p className="flex items-center gap-1.5 text-sm text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</p>;
  if (data === null) return <p className="text-sm text-muted">Workmen compensation isn&rsquo;t available for this company.</p>;
  return <WorkmenCompSection supplierId={supplierId} policies={data.policies} workers={data.workers} canEdit={canEdit} onChanged={load} />;
}
