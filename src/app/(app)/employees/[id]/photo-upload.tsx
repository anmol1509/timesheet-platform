"use client";

import { useRef, useState, useTransition } from "react";
import { uploadPhotoAction } from "./actions";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";

export function PhotoUpload({
  employeeId,
  hasPhoto,
  name,
}: {
  employeeId: string;
  hasPhoto: boolean;
  name: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function handleFile(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`Photo is too large — max ${MAX_UPLOAD_LABEL}.`);
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("photo", file);
    startTransition(() => {
      uploadPhotoAction(formData);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100"
        title="Click to upload photo"
      >
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/employees/${employeeId}/photo?ts=${Date.now()}`}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-500">
            {initials || "?"}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
          {pending ? "…" : "Change"}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </button>
      {error && <p className="max-w-[8rem] text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
