import { cn } from "@/lib/cn";

/**
 * Text input. Styling lives in the `.input` component class so the hundreds of
 * plain `<input className="input">` elements across the app stay in sync with
 * anything rendered through this component.
 */
export function Input({
  className,
  invalid,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cn("input w-full", className)}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cn("input w-full resize-y", className)}
    />
  );
}

/** Input with a leading icon — search boxes, currency fields, etc. */
export function InputWithIcon({
  icon,
  className,
  wrapperClassName,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ReactNode;
  wrapperClassName?: string;
}) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle">
        {icon}
      </span>
      <input {...props} className={cn("input w-full pl-9", className)} />
    </div>
  );
}
