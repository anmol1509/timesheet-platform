import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "error" | "warning" | "success" | "info";

const TONE: Record<Tone, { icon: typeof AlertCircle; text: string; box: string; chip: string; inline: string }> = {
  error: { icon: AlertCircle, text: "text-[var(--error)]", box: "border-[var(--error-border)] bg-[var(--error-soft)]", chip: "bg-[color-mix(in_srgb,var(--error)_14%,transparent)]", inline: "text-[var(--error)]" },
  warning: { icon: AlertTriangle, text: "text-[var(--warning)]", box: "border-[var(--warning-border)] bg-[var(--warning-soft)]", chip: "bg-[color-mix(in_srgb,var(--warning)_16%,transparent)]", inline: "text-[var(--warning)]" },
  success: { icon: CheckCircle2, text: "text-[var(--success)]", box: "border-[var(--success-border)] bg-[var(--success-soft)]", chip: "bg-[color-mix(in_srgb,var(--success)_14%,transparent)]", inline: "text-[var(--success)]" },
  info: { icon: Info, text: "text-[var(--info)]", box: "border-[var(--info-border)] bg-[var(--info-soft)]", chip: "bg-[color-mix(in_srgb,var(--info)_14%,transparent)]", inline: "text-[var(--info)]" },
};

/**
 * The one way to say that something went wrong (or needs a look) next to what the person is doing: an icon badge and the message in
 * a soft card that eases in. `inline` is the quiet form for a note under a single field: the icon and text, no card.
 */
export function Alert({ tone = "error", title, inline, className, children }: { tone?: Tone; title?: string; inline?: boolean; className?: string; children: React.ReactNode }) {
  const t = TONE[tone];
  const Icon = t.icon;
  if (inline) {
    return (
      <p role="alert" className={cn("alert-in flex items-start gap-1.5 text-xs leading-snug", t.inline, className)}>
        <Icon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0">{children}</span>
      </p>
    );
  }
  return (
    <div role="alert" className={cn("alert-in flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm leading-snug", t.box, className)}>
      <span className={cn("mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full", t.chip, t.text)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 text-primary">
        {title && <p className={cn("font-semibold", t.text)}>{title}</p>}
        <div className={cn(title ? "mt-0.5 text-secondary" : "font-medium", "break-words")}>{children}</div>
      </div>
    </div>
  );
}
