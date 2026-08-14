import { cn } from "@/lib/cn";

// Codifies the label/input markup repeated in every edit-form.tsx across
// suppliers/clients/employees. No validation engine — stays on native
// FormData + useTransition submission, matching the existing convention.
export function Field({
  label,
  children,
  /** Marks the field required and adds the visual indicator. */
  required,
  /** Guidance shown under the field, before the user makes a mistake. */
  help,
  /** Validation message. Replaces `help` when present. */
  error,
  /** Span both columns of a two-column Section grid. */
  wide,
  className,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  help?: React.ReactNode;
  error?: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("block", wide && "sm:col-span-2", className)}>
      <span className="field-label">
        {label}
        {required && (
          <span className="ml-0.5 text-[var(--error)]" aria-hidden>
            *
          </span>
        )}
      </span>
      {children}
      {error ? (
        <span className="field-error block">{error}</span>
      ) : help ? (
        <span className="field-help block">{help}</span>
      ) : null}
    </label>
  );
}
