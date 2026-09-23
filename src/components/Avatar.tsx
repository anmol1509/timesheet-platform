import { cn } from "@/lib/cn";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

/** Round user photo, falling back to gradient initials. */
export function Avatar({
  name,
  url,
  className,
}: {
  name: string;
  url: string | null;
  className?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, served by our own route
      <img
        src={url}
        alt=""
        className={cn("shrink-0 rounded-full bg-surface-sunken object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-[var(--brand-navy)] font-semibold text-white",
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
