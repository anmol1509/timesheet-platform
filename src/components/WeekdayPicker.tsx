const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Tick the days of the week that are off (0 = Sunday). Posts one `name` value per ticked day. */
export function WeekdayPicker({ name, defaultValue }: { name: string; defaultValue: number[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-sm text-secondary">
      {DAYS.map((d, i) => (
        <label key={d} className="flex items-center gap-1">
          <input type="checkbox" name={name} value={i} defaultChecked={defaultValue.includes(i)} /> {d}
        </label>
      ))}
    </div>
  );
}

export const parseWeekdays = (values: FormDataEntryValue[]) =>
  [...new Set(values.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
