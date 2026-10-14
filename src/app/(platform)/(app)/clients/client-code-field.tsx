"use client";

import { useRef, useState, useTransition } from "react";
import { Wand2 } from "lucide-react";
import { suggestClientCodeAction } from "./actions";

/** Supplier code input with an "Auto" button that fills in the name's acronym.
 * The name comes from the form's own `name` field unless `fixedName` is given
 * (the edit form has no name field). */
export function ClientCodeField({
  defaultValue = "",
  fixedName,
  clientId,
}: {
  defaultValue?: string;
  fixedName?: string;
  clientId?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [hint, setHint] = useState<string | null>(null);

  function auto() {
    const form = ref.current?.form;
    const name = fixedName ?? (form?.elements.namedItem("name") as HTMLInputElement | null)?.value ?? "";
    if (!name.trim()) {
      setHint("Type the client name first.");
      return;
    }
    setHint(null);
    start(async () => {
      const code = await suggestClientCodeAction(name, clientId);
      if (ref.current) {
        ref.current.value = code;
        // Let the form's unsaved-changes guard see the change.
        ref.current.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          ref={ref}
          name="code"
          defaultValue={defaultValue}
          maxLength={12}
          placeholder="e.g. CEMA"
          className="input w-full uppercase"
        />
        <button type="button" onClick={auto} disabled={pending} className="btn btn-secondary btn-sm shrink-0">
          <Wand2 className="h-4 w-4" aria-hidden />
          {pending ? "…" : "Auto"}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        {hint ?? "C + initials of the name (Emaar Properties → CEP). Leave blank to generate on save, or edit it."}
      </p>
    </div>
  );
}
