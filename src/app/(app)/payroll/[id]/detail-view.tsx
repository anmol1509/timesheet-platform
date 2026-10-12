"use client";

import { useState } from "react";

/**
 * Wraps the pay table. Simple by default: name, earnings, deductions, net.
 * "Show every column" reveals the working (base, overtime, absences...). Cells
 * marked data-detail are hidden until it is on.
 */
export function DetailView({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  return (
    <div className="group" data-detail={on ? "on" : "off"}>
      <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 text-xs text-secondary">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-3.5 w-3.5" />
        Show every column (base, overtime, absences…)
      </label>
      {children}
    </div>
  );
}
