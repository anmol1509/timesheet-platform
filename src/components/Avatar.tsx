"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

// Soft tinted pairs rather than one loud gradient — a roster of 20 initials
// avatars should read as a calm, varied list, not a wall of purple.
const PALETTE = [
  "bg-[#ede9fe] text-[#5b21b6]",
  "bg-[#dbeafe] text-[#1d4ed8]",
  "bg-[#d1fae5] text-[#047857]",
  "bg-[#fef3c7] text-[#b45309]",
  "bg-[#fce7f3] text-[#be185d]",
  "bg-[#e0f2fe] text-[#0369a1]",
  "bg-[#ffedd5] text-[#c2410c]",
  "bg-[#e0e7ff] text-[#4338ca]",
  "bg-[#ccfbf1] text-[#0f766e]",
] as const;

function paletteFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export const AVATAR_SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-16 w-16 text-lg",
  "2xl": "h-20 w-20 text-xl",
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

/**
 * Round photo, falling back to tinted initials. Also falls back if the image
 * fails to load, so a stale or deleted photo never shows as a broken icon.
 */
export function Avatar({
  name,
  url,
  size,
  className,
}: {
  name: string;
  url: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const sizeClass = size ? AVATAR_SIZES[size] : undefined;

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, served by our own route
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn(
          "shrink-0 rounded-full bg-surface-sunken object-cover ring-2 ring-[var(--surface)]",
          sizeClass,
          className
        )}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight ring-2 ring-[var(--surface)]",
        paletteFor(name),
        sizeClass,
        className
      )}
    >
      {initials(name)}
    </span>
  );
}

/** An employee's avatar: their uploaded photo when they have one. */
export function EmployeeAvatar({
  employeeId,
  name,
  hasPhoto,
  size = "md",
  className,
}: {
  employeeId: string;
  name: string;
  /** Pass `!!employee.photoMimeType` — it is only ever set alongside the photo bytes. */
  hasPhoto: boolean;
  size?: AvatarSize;
  className?: string;
}) {
  return (
    <Avatar
      name={name}
      url={hasPhoto ? `/api/employees/${employeeId}/photo` : null}
      size={size}
      className={className}
    />
  );
}
