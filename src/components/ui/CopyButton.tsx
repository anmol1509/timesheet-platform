"use client";

import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "./Button";

/** Copies text, then shows a tick and "Copied" for a moment. If the browser blocks the clipboard the text stays selectable on screen. */
export function CopyButton({ text, label = "Copy", copiedLabel = "Copied", className }: { text: string; label?: string; copiedLabel?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <Button
      variant="secondary"
      size="btn-sm"
      className={className}
      success={done}
      successLabel={copiedLabel}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          timer.current = setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard blocked: the text is selectable on screen */
        }
      }}
    >
      <Copy className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Button>
  );
}
