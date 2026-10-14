import s from "./calculator.module.css";

/** AED amount with thousands separators and two decimals. */
export function aed(n: number): string {
  return `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={s.field}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function NumberInput({ id, value, onChange, step = "any", placeholder }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  placeholder?: string;
}) {
  return (
    <input
      id={id}
      className={s.input}
      type="number"
      inputMode="decimal"
      min="0"
      step={step}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
