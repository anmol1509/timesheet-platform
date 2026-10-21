"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { StatTile } from "@/components/StatTile";
import { filterDocuments } from "./type-status-bars";

type Key = "all" | "valid" | "expiring" | "expired";

/** The four counts above the list. Each one filters the list below, marks itself selected and scrolls to the table. */
export function DocStatTiles({ total, valid, expiring, expired }: { total: number; valid: number; expiring: number; expired: number }) {
  const [active, setActive] = useState<Key>("all");
  // The chart can change the status too, so follow it.
  useEffect(() => {
    const on = (e: Event) => {
      const tab = (e as CustomEvent<{ tab: string }>).detail.tab;
      setActive(tab === "valid" || tab === "expiring" || tab === "expired" ? tab : "all");
    };
    window.addEventListener("documents:filter", on);
    return () => window.removeEventListener("documents:filter", on);
  }, []);
  const pick = (key: Key) => filterDocuments({ type: "", tab: active === key ? "all" : key });
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile onClick={() => pick("all")} active={active === "all"} label="All Documents" value={total} icon={FileText} />
      <StatTile onClick={() => pick("valid")} active={active === "valid"} label="Valid" value={valid} icon={CheckCircle2} />
      <StatTile onClick={() => pick("expiring")} active={active === "expiring"} label="Expiring Soon" value={expiring} icon={AlertTriangle} tone={expiring > 0 ? "warning" : "default"} />
      <StatTile onClick={() => pick("expired")} active={active === "expired"} label="Expired" value={expired} icon={AlertTriangle} tone={expired > 0 ? "warning" : "default"} />
    </div>
  );
}
