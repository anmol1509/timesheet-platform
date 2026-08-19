"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AttendanceDay } from "@/lib/attendanceMonth";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATE_STYLE = {
  submitted: "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]",
  draft: "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]",
  empty: "border-[var(--error-border)] bg-[var(--error-soft)] text-[var(--error)]",
} as const;

const STATE_LABEL = {
  submitted: "Submitted",
  draft: "Draft — not submitted",
  empty: "Nothing marked",
} as const;

function shiftMonth(month: string, by: number) {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * The month at a glance: which days are done, which were started and left, and
 * which haven't been touched.
 *
 * Attendance is only useful if every day is accounted for, and the day people
 * miss is the one nobody remembers skipping — so the empty days are shown as
 * loudly as the finished ones rather than being absent from the view.
 */
export function AttendanceCalendar({
  month,
  days,
  selectedDate,
}: {
  month: string;
  days: AttendanceDay[];
  selectedDate: string | null;
}) {
  const [year, m] = month.split("-").map(Number);
  const monthLabel = new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  // Monday-first grid, so the leading blanks line the 1st up under its weekday.
  const firstWeekday = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;

  const counts = days.reduce(
    (acc, d) => ({ ...acc, [d.state]: acc[d.state] + 1 }),
    { submitted: 0, draft: 0, empty: 0 }
  );

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/attendance?month=${shiftMonth(month, -1)}`}
            aria-label="Previous month"
            className="rounded-control border border-default p-1.5 text-subtle transition hover:bg-surface-hover hover:text-secondary"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h2 className="text-base font-semibold text-primary">{monthLabel}</h2>
          <Link
            href={`/attendance?month=${shiftMonth(month, 1)}`}
            aria-label="Next month"
            className="rounded-control border border-default p-1.5 text-subtle transition hover:bg-surface-hover hover:text-secondary"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {(["submitted", "draft", "empty"] as const).map((state) => (
            <span key={state} className="flex items-center gap-1.5">
              <span
                className={cn("h-2.5 w-2.5 rounded-sm border", STATE_STYLE[state])}
                aria-hidden
              />
              <span className="text-muted">
                {STATE_LABEL[state]}{" "}
                <span className="tabular font-medium text-secondary">{counts[state]}</span>
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-xs font-medium text-muted">
            {w}
          </div>
        ))}

        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}

        {days.map((day) => {
          const dayNumber = Number(day.date.slice(8, 10));
          const isSelected = day.date === selectedDate;
          return (
            <Link
              key={day.date}
              href={`/attendance?month=${month}&date=${day.date}`}
              aria-label={`${day.date} — ${STATE_LABEL[day.state]}`}
              aria-current={isSelected ? "date" : undefined}
              className={cn(
                "flex min-h-[62px] flex-col rounded-control border p-2 transition hover:brightness-95",
                STATE_STYLE[day.state],
                isSelected && "ring-2 ring-[var(--brand-primary)] ring-offset-1"
              )}
            >
              <span className="tabular text-sm font-semibold">{dayNumber}</span>
              {day.marked > 0 && (
                <span className="mt-auto text-[10px] font-medium">
                  {day.marked} marked
                  {day.state === "draft" && day.locked > 0 && ` · ${day.locked} locked`}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
