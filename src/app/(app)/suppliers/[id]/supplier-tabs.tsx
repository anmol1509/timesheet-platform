"use client";

import { useState } from "react";
import { m } from "motion/react";
import { SPRING } from "@/lib/motion";

export function SupplierTabs({
  tabs,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-default">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`relative px-3 py-2 text-sm font-medium transition-colors ${
              active === t.id ? "text-[var(--brand-primary)]" : "text-muted hover:text-primary"
            }`}
          >
            {t.label}
            {active === t.id && (
              <m.span
                layoutId="supplier-tabs-underline"
                transition={SPRING}
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--brand-primary)]"
                aria-hidden
              />
            )}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} className={active === t.id ? "block" : "hidden"}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
