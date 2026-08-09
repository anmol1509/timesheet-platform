import Link from "next/link";
import { cn } from "@/lib/cn";

const VARIANTS = {
  primary:
    "bg-[var(--brand-primary)] text-white shadow-sm hover:bg-[var(--brand-primary-hover)] disabled:opacity-60",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60",
  ghost: "text-slate-600 hover:bg-slate-100 disabled:opacity-60",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:opacity-60",
} as const;

const SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
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
  const { variant = "primary", size = "md", className, children } = props;
  const classes = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    className
  );

  if ("href" in props && props.href) {
    if (props.disabled) {
      return (
        <span aria-disabled className={classes}>
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

  const { variant: _variant, size: _size, className: _className, children: _children, href: _href, ...rest } =
    props as ButtonAsButton;

  return (
    <button type={rest.type ?? "button"} {...rest} className={classes}>
      {children}
    </button>
  );
}
