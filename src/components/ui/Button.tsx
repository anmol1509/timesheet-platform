import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const VARIANTS = {
  primary:
    "bg-[var(--brand-primary)] bg-gradient-to-b from-white/12 to-white/0 text-white shadow-[var(--shadow-brand),inset_0_1px_0_rgb(255_255_255/0.14)] hover:bg-[var(--brand-primary-hover)] active:bg-[var(--brand-primary-active)] disabled:opacity-50",
  secondary:
    "border border-strong bg-surface text-secondary shadow-xs hover:border-[#c3c8d4] hover:bg-surface-hover hover:text-primary disabled:opacity-50",
  ghost: "text-secondary hover:bg-surface-hover hover:text-primary disabled:opacity-50",
  danger:
    "bg-[var(--error)] text-white shadow-xs hover:brightness-110 disabled:opacity-50",
  /** Destructive but low-emphasis — row-level deletes, not page-level ones. */
  dangerGhost:
    "text-[var(--error)] hover:bg-[var(--error-soft)] disabled:opacity-50",
} as const;

const SIZES = {
  xs: "h-7 gap-1 px-2 text-xs",
  sm: "h-8 gap-1.5 px-2.5 text-xs",
  md: "h-9 gap-1.5 px-3.5 text-sm",
  lg: "h-10 gap-2 px-4 text-sm",
} as const;

const ICON_SIZES = {
  xs: "h-7 w-7",
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square icon-only button. Requires an aria-label on the caller. */
  iconOnly?: boolean;
  /** Shows a spinner and disables the button, keeping its width so the layout doesn't jump. */
  loading?: boolean;
  /** Shows a tick for a moment after the action worked. The caller sets it and clears it. */
  success?: boolean;
  /** Label while working and after success. Main buttons (primary, danger) keep their own label while working. */
  loadingLabel?: string;
  successLabel?: string;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = BaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = BaseProps & {
  href: string;
  disabled?: boolean;
};

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const {
    variant = "primary",
    size = "md",
    iconOnly = false,
    className,
    children,
  } = props;
  const loading = "loading" in props ? !!props.loading : false;
  const success = "success" in props ? !!props.success : false;

  const classes = cn(
    "btn-fx inline-flex shrink-0 items-center justify-center rounded-control font-medium whitespace-nowrap transition disabled:pointer-events-none disabled:cursor-not-allowed",
    VARIANTS[variant],
    iconOnly ? ICON_SIZES[size] : SIZES[size],
    className
  );

  if ("href" in props && props.href) {
    if (props.disabled) {
      return (
        <span aria-disabled data-variant={variant} className={cn(classes, "pointer-events-none opacity-50")}>
          {children}
        </span>
      );
    }
    return (
      <Link href={props.href} data-variant={variant} className={classes}>
        {children}
      </Link>
    );
  }

  const {
    variant: _variant,
    size: _size,
    iconOnly: _iconOnly,
    loading: _loading,
    success: _success,
    loadingLabel,
    successLabel,
    className: _className,
    children: _children,
    href: _href,
    ...rest
  } = props as ButtonAsButton;

  // Main buttons fill left to right while they work, then turn green with a tick.
  // Secondary and quiet buttons swap their label for a spinner, then for a tick.
  const fills = variant === "primary" || variant === "danger";
  const state = success ? "success" : loading ? "loading" : "idle";
  const tick = <Check className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden />;
  const spinner = <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />;

  let body: React.ReactNode = children;
  if (iconOnly) {
    body = success ? tick : loading ? spinner : children;
  } else if (fills) {
    body = (
      <>
        <i className="ab-fill" aria-hidden />
        {success ? <span className="inline-flex items-center gap-1.5">{tick}{successLabel ?? "Done"}</span> : children}
      </>
    );
  } else {
    body = (
      <span className="ab-swap">
        <span data-on={state === "idle" || undefined}>{children}</span>
        <span data-on={state === "loading" || undefined} aria-hidden={state !== "loading"}>{spinner}{loadingLabel ?? children}</span>
        <span data-on={state === "success" || undefined} aria-hidden={state !== "success"}>{tick}{successLabel ?? "Done"}</span>
      </span>
    );
  }

  return (
    <button
      type={rest.type ?? "button"}
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-state={state}
      className={classes}
    >
      {body}
    </button>
  );
}
