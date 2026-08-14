import Link from "next/link";
import { cn } from "@/lib/cn";

const VARIANTS = {
  primary:
    "bg-[var(--brand-primary)] text-white shadow-xs hover:bg-[var(--brand-primary-hover)] active:bg-[var(--brand-primary-active)] disabled:opacity-50",
  secondary:
    "border border-strong bg-surface text-secondary shadow-xs hover:bg-surface-hover hover:text-primary disabled:opacity-50",
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

  const classes = cn(
    "inline-flex shrink-0 items-center justify-center rounded-control font-medium whitespace-nowrap transition disabled:pointer-events-none disabled:cursor-not-allowed",
    VARIANTS[variant],
    iconOnly ? ICON_SIZES[size] : SIZES[size],
    className
  );

  if ("href" in props && props.href) {
    if (props.disabled) {
      return (
        <span aria-disabled className={cn(classes, "pointer-events-none opacity-50")}>
          {children}
        </span>
      );
    }
    return (
      <Link href={props.href} className={classes}>
        {children}
      </Link>
    );
  }

  const {
    variant: _variant,
    size: _size,
    iconOnly: _iconOnly,
    className: _className,
    children: _children,
    href: _href,
    ...rest
  } = props as ButtonAsButton;

  return (
    <button type={rest.type ?? "button"} {...rest} className={classes}>
      {children}
    </button>
  );
}
