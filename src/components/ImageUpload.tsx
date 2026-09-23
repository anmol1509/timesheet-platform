"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

type ActionResult = { error?: string | null } | void;

/** Resizes to fit `max`px on the longest side in the browser, so uploads stay
 * tiny (server actions cap the request body) and PNG transparency survives. */
async function shrink(file: File, max: number, type: "image/png" | "image/jpeg"): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  if (type === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.88));
  if (!blob) throw new Error("Could not process that image.");
  return new File([blob], type === "image/png" ? "image.png" : "image.jpg", { type });
}

export function ImageUpload({
  currentUrl,
  fallback,
  label,
  hint,
  shape = "circle",
  format = "image/jpeg",
  maxPx = 512,
  uploadAction,
  removeAction,
  extraFields,
}: {
  currentUrl: string | null;
  /** Shown when there's no image (initials tile). */
  fallback: React.ReactNode;
  label: string;
  hint?: string;
  shape?: "circle" | "square";
  format?: "image/png" | "image/jpeg";
  maxPx?: number;
  uploadAction: (fd: FormData) => Promise<ActionResult>;
  removeAction?: (fd: FormData) => Promise<ActionResult>;
  extraFields?: Record<string, string>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function fields() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(extraFields ?? {})) fd.set(k, v);
    return fd;
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    start(async () => {
      try {
        const small = await shrink(file, maxPx, format);
        setPreview(URL.createObjectURL(small));
        const fd = fields();
        fd.set("image", small);
        const res = await uploadAction(fd);
        if (res && res.error) {
          setError(res.error);
          setPreview(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
        setPreview(null);
      }
    });
  }

  function onRemove() {
    if (!removeAction) return;
    setError(null);
    start(async () => {
      const res = await removeAction(fields());
      setPreview(null);
      if (res && res.error) setError(res.error);
    });
  }

  const shown = preview ?? currentUrl;
  const round = shape === "circle";

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-default bg-surface-sunken",
          round ? "rounded-full" : "rounded-lg"
        )}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview blob / our own image route
          <img src={shown} alt="" className={cn("h-full w-full", round ? "object-cover" : "object-contain")} />
        ) : (
          fallback
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-primary">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => inputRef.current?.click()}>
            <Camera className="h-4 w-4" aria-hidden />
            {pending ? "Saving…" : shown ? "Change" : "Upload"}
          </button>
          {removeAction && (currentUrl || preview) && (
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={onRemove}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove
            </button>
          )}
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-[var(--danger-text,#b42318)]">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={onPick} />
    </div>
  );
}
