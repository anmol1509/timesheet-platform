"use client";

import { useEffect, useState } from "react";
import { pdfPageToImage } from "@/lib/pdfPageToImage";

/**
 * A URL that can be used as a CSS background for a letterhead. Images pass
 * straight through; a PDF letterhead has its first page drawn to an image in
 * the browser, so previews can show it behind the text.
 */
export function useLetterheadImage(url: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    setSrc(null);
    if (!url) return;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const blob = await res.blob();
        if (blob.type === "application/pdf") {
          const page = await pdfPageToImage(new File([blob], "letterhead.pdf", { type: "application/pdf" }), 1, { maxEdge: 1400, quality: 0.85 });
          if (page && !cancelled) { made = URL.createObjectURL(page); setSrc(made); }
        } else if (!cancelled) {
          made = URL.createObjectURL(blob);
          setSrc(made);
        }
      } catch {
        /* no preview image; the margins can still be set */
      }
    })();
    return () => { cancelled = true; if (made) URL.revokeObjectURL(made); };
  }, [url]);
  return src;
}
