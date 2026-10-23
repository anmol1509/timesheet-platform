"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { DocumentTypeForm } from "./document-type-form";
import { resetDocumentTypeAction } from "./actions";

export type TypeRowData = { appliesTo: string; key: string; label: string; hasExpiry: boolean; required: string; reminderDays: number[]; isActive: boolean; builtIn: boolean; changed: boolean };

const REQ: Record<string, string> = { NO: "Optional", YES: "Required", OWN_COMPANY: "Required for own company" };

export function TypeRow({ t }: { t: TypeRowData }) {
  const [editing, setEditing] = useState(false);
  const values = { appliesTo: t.appliesTo, key: t.key, label: t.label, hasExpiry: t.hasExpiry, required: t.required, reminderDays: t.reminderDays.join(", "), isActive: t.isActive };
  return (
    <li className="px-4 py-3 text-sm">
      {editing ? (
        <div className="space-y-2">
          <DocumentTypeForm initial={values} onDone={() => setEditing(false)} />
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted hover:underline">Cancel</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={`min-w-0 flex-1 font-medium ${t.isActive ? "text-primary" : "text-muted line-through"}`}>{t.label}</span>
          <span className="text-xs text-muted">{REQ[t.required]}</span>
          <span className="text-xs text-muted">{t.hasExpiry ? `Expires${t.reminderDays.length ? ` · remind ${t.reminderDays.join(", ")}d` : ""}` : "No expiry"}</span>
          {!t.builtIn && <Badge color="navy">Custom</Badge>}
          {!t.isActive && <Badge>Off</Badge>}
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Edit</button>
          {(t.changed || !t.builtIn) && (
            <DeleteButton
              action={resetDocumentTypeAction}
              hiddenFields={{ appliesTo: t.appliesTo, key: t.key }}
              confirmMessage={t.builtIn ? `Reset "${t.label}" to its defaults?` : `Delete "${t.label}"? Files already filed under it are kept.`}
            />
          )}
        </div>
      )}
    </li>
  );
}
