"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import { format, isValid, parse } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/cn";

/** What the user types and reads. UAE convention, and unambiguous next to a passport. */
const DISPLAY = "dd/MM/yyyy";
/** What the server gets, identical to what `type="date"` submitted before. */
const ISO = "yyyy-MM-dd";

function toDate(iso: string | undefined | null): Date | undefined {
  if (!iso) return undefined;
  const d = parse(iso, ISO, new Date());
  return isValid(d) ? d : undefined;
}

/**
 * Date field: a typeable dd/MM/yyyy box plus a calendar for browsing.
 *
 * Typing is deliberately kept first-class — most dates here are copied off a
 * document and sit years out, where a calendar means a dozen clicks. The
 * calendar is for the cases where the user is choosing rather than
 * transcribing.
 *
 * A hidden input carries the ISO value under `name`, so every server action
 * that already reads `formData.get(name)` as "YYYY-MM-DD" keeps working
 * unchanged. Free text that isn't a valid date submits nothing and marks the
 * field invalid rather than guessing.
 */
export function DatePicker({
  name,
  defaultValue,
  value,
  onChange,
  disabled,
  required,
  fromYear,
  toYear,
  className,
  ariaLabel,
  placeholder = DISPLAY.toLowerCase(),
}: {
  name?: string;
  /** ISO "YYYY-MM-DD". */
  defaultValue?: string | null;
  /** ISO "YYYY-MM-DD" — pass with onChange for a controlled field. */
  value?: string | null;
  onChange?: (iso: string) => void;
  disabled?: boolean;
  required?: boolean;
  fromYear?: number;
  toYear?: number;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const controlled = value !== undefined;
  const [iso, setIso] = useState<string>(defaultValue ?? "");
  const currentIso = controlled ? (value ?? "") : iso;

  // Kept separate from the ISO value so a half-typed date isn't reformatted
  // out from under the user on every keystroke.
  const [text, setText] = useState<string>(() => {
    const d = toDate(defaultValue ?? value);
    return d ? format(d, DISPLAY) : "";
  });
  const [open, setOpen] = useState(false);

  const selected = toDate(currentIso);
  const invalid = text.trim() !== "" && !selected;

  function commit(next: Date | undefined) {
    const nextIso = next ? format(next, ISO) : "";
    if (!controlled) setIso(nextIso);
    onChange?.(nextIso);
  }

  function onText(raw: string) {
    setText(raw);
    if (raw.trim() === "") return commit(undefined);
    const parsed = parse(raw, DISPLAY, new Date());
    commit(isValid(parsed) ? parsed : undefined);
  }

  const year = new Date().getFullYear();

  return (
    <div className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={currentIso} />}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={(e) => onText(e.target.value)}
        onBlur={() => selected && setText(format(selected, DISPLAY))}
        disabled={disabled}
        required={required && !currentIso}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className="input w-full pr-9"
      />
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Open calendar"
            className={cn(
              "absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-control text-subtle transition",
              "hover:text-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-40"
            )}
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={4}
            className="rx-popover z-50 rounded-card border border-default bg-surface p-3 shadow-lg"
          >
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={selected}
              onSelect={(d) => {
                commit(d);
                setText(d ? format(d, DISPLAY) : "");
                setOpen(false);
              }}
              captionLayout="dropdown"
              startMonth={new Date(fromYear ?? year - 80, 0)}
              endMonth={new Date(toYear ?? year + 20, 11)}
              weekStartsOn={1}
              showOutsideDays
              classNames={DAY_PICKER_CLASSES}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

/** Mapped onto design-system tokens rather than importing react-day-picker's stylesheet. */
const DAY_PICKER_CLASSES = {
  root: "text-sm",
  months: "relative",
  month_caption: "flex items-center justify-center pb-2",
  // react-day-picker renders this label on top of the (normally transparent)
  // month/year selects. We style those selects as real inputs instead, so the
  // label would read as a duplicate caption — keep it for screen readers only.
  caption_label: "sr-only",
  dropdowns: "flex items-center gap-1.5",
  dropdown: "input h-8 py-0 text-xs",
  nav: "absolute inset-x-0 top-0 flex items-center justify-between",
  button_previous:
    "flex h-7 w-7 items-center justify-center rounded-control text-muted transition hover:bg-surface-hover hover:text-primary",
  button_next:
    "flex h-7 w-7 items-center justify-center rounded-control text-muted transition hover:bg-surface-hover hover:text-primary",
  month_grid: "w-full border-collapse",
  weekdays: "flex",
  weekday: "w-8 pb-1 text-[11px] font-medium text-subtle",
  week: "flex",
  day: "p-0",
  day_button:
    "flex h-8 w-8 items-center justify-center rounded-control text-sm text-secondary transition hover:bg-surface-hover hover:text-primary",
  selected:
    "[&>button]:bg-[var(--brand-primary)] [&>button]:font-semibold [&>button]:text-white [&>button]:hover:bg-[var(--brand-primary)] [&>button]:hover:text-white",
  today: "[&>button]:font-semibold [&>button]:text-[var(--brand-primary)]",
  outside: "[&>button]:text-subtle [&>button]:opacity-50",
  disabled: "[&>button]:cursor-not-allowed [&>button]:opacity-40",
} as const;
