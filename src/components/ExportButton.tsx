"use client";

import { useState } from "react";
import { ExportMenu } from "@/components/ExportMenu";
import { fetchDownload } from "@/lib/fetchDownload";

/** An Export button for a file the server builds: Excel as is, CSV by adding `format=csv` to the address. Says why when it fails. */
export function ExportButton({ url, label }: { url: string; label?: string }) {
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <>
      <ExportMenu
        label={label}
        onError={setProblem}
        onExport={(format) => {
          setProblem(null);
          return fetchDownload(format === "csv" ? `${url}${url.includes("?") ? "&" : "?"}format=csv` : url);
        }}
      />
      {problem && <span role="alert" className="basis-full text-sm text-[var(--warning)]">{problem}</span>}
    </>
  );
}
