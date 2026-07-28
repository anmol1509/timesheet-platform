const COLORS = {
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-blue-100 text-blue-700",
  navy: "bg-[#0B1642]/10 text-[#0B1642]",
} as const;

export type BadgeColor = keyof typeof COLORS;

export function Badge({
  children,
  color = "slate",
}: {
  children: React.ReactNode;
  color?: BadgeColor;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${COLORS[color]}`}
    >
      {children}
    </span>
  );
}
