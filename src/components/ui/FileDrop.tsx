"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Drag-and-drop file zone with a click-to-browse fallback. Generalizes the
 * pattern already hand-rolled in `upload/upload-form.tsx` so other
 * document-upload surfaces (employee documents, workmen comp import, camp
 * documents) can share one drop target instead of a plain `.file-input`.
 */
export function FileDrop({
  onFiles,
  accept,
  multiple = false,
  label = "Drop file here",
  hint = "or click to browse",
  disabled = false,
  className,
}: {
  onFiles: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragging
          ? "border-[var(--brand-primary)] bg-brand-soft"
          : "border-[var(--border-strong)] bg-surface hover:bg-surface-hover",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <UploadCloud
        className={cn("h-6 w-6", dragging ? "text-[var(--brand-primary)]" : "text-subtle")}
        aria-hidden
      />
      <p className="text-sm font-medium text-secondary">{label}</p>
      <p className="text-xs text-subtle">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
