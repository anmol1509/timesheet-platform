"use client";

import { useState } from "react";

export function ProjectTabs({
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
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              active === t.id
                ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                : "border-transparent text-muted hover:text-primary"
            }`}
          >
            {t.label}
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
