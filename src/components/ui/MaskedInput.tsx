"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { formatMasked, hintFor, type MaskKind } from "@/lib/idFormats";
import { cn } from "@/lib/cn";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { kind: MaskKind };

/**
 * A normal text input that formats an identifier as it is typed (uppercase IBAN,
 * hyphenated Emirates ID, digits-only TRN) and shows a quiet validity hint underneath.
 * It is still a plain <input>, so refs, controlled state and FormData all work as before.
 */
export const MaskedInput = forwardRef<HTMLInputElement, Props>(function MaskedInput({ kind, onChange, className, defaultValue, value, ...rest }, ref) {
  const [hint, setHint] = useState(() => hintFor(kind, formatMasked(kind, String(value ?? defaultValue ?? ""))));
  const inner = useRef<HTMLInputElement | null>(null);
  // An incomplete or invalid value stops the form from saving; an empty one is left to `required`.
  useEffect(() => {
    inner.current?.setCustomValidity(hint && hint.tone === "warn" ? hint.text : "");
  }, [hint]);
  return (
    <div>
      <input
        ref={(el) => {
          inner.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        type="text"
        autoComplete="off"
        spellCheck={false}
        inputMode={kind === "eid" || kind === "trn" ? "numeric" : undefined}
        defaultValue={defaultValue}
        value={value}
        onChange={(e) => {
          const next = formatMasked(kind, e.target.value);
          if (next !== e.target.value) e.target.value = next;
          setHint(hintFor(kind, next));
          onChange?.(e);
        }}
        className={cn("input w-full tabular", className)}
        {...rest}
      />
      {hint && <p className={cn("mt-1 text-xs", hint.tone === "ok" ? "text-[var(--success)]" : "text-[var(--warning)]")}>{hint.text}</p>}
    </div>
  );
});
