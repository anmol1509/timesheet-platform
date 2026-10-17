"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Select } from "@/components/ui/Select";

/** The month picker changes the page as soon as you choose; there is no Go button. */
export function MonthPicker({ value, months }: { value: string; months: { value: string; label: string }[] }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <CalendarDays className="h-4 w-4" aria-hidden />
      <span className="sr-only">Month</span>
      <Select value={value} onChange={(m) => router.push(`/invoices?month=${m}`)} searchable={false} options={months} triggerClassName="w-44" />
    </label>
  );
}
