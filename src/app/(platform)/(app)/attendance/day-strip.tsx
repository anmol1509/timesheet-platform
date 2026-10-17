import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};
const href = (date: string) => `/attendance?date=${date}&month=${date.slice(0, 7)}`;

/** Five days around the one being marked, with today always one tap away. No calendar needed for the daily job. */
export function DayStrip({ date, today }: { date: string; today: string }) {
  const days = [-3, -2, -1, 0, 1].map((n) => shift(date, n));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={href(shift(date, -1))} aria-label="Previous day" className="btn btn-secondary btn-sm px-2"><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
      {days.map((d) => {
        const dt = new Date(`${d}T00:00:00Z`);
        const future = d > today;
        return (
          <Link
            key={d}
            href={href(d)}
            aria-current={d === date ? "date" : undefined}
            className={cn(
              "min-w-[4.5rem] rounded-control border px-3 py-2 text-center transition",
              d === date ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white" : "border-default bg-surface hover:bg-surface-hover",
              future && d !== date && "opacity-50"
            )}
          >
            <span className="block text-[10px] uppercase opacity-80">{dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</span>
            <span className="block text-base font-semibold">{dt.getUTCDate()}</span>
          </Link>
        );
      })}
      <Link href={href(shift(date, 1))} aria-label="Next day" className="btn btn-secondary btn-sm px-2"><ChevronRight className="h-4 w-4" aria-hidden /></Link>
      <span className="flex-1" />
      {date !== today && <Link href={href(today)} className="btn btn-secondary btn-sm">Today</Link>}
      <span className="text-sm font-medium text-primary">
        {new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
      </span>
    </div>
  );
}
