"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "warning" | "info";

type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
};

type ToastInput = Omit<Toast, "id" | "tone"> & { tone?: ToastTone };

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

/**
 * Lightweight toast host. Built on plain state rather than a new dependency —
 * the app had no success/failure feedback channel at all, and server actions
 * here return plain `{ error }` / `{ ok }` objects that callers can forward
 * straight into `toast(...)`.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, tone: "success", ...input }]);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        // Polite: announced after the user's current utterance, not barged in.
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TONES: Record<
  ToastTone,
  { icon: typeof CheckCircle2; className: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    className: "border-[var(--success-border)] bg-[var(--success-soft)]",
    iconClass: "text-[var(--success)]",
  },
  error: {
    icon: XCircle,
    className: "border-[var(--error-border)] bg-[var(--error-soft)]",
    iconClass: "text-[var(--error)]",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-[var(--warning-border)] bg-[var(--warning-soft)]",
    iconClass: "text-[var(--warning)]",
  },
  info: {
    icon: Info,
    className: "border-[var(--info-border)] bg-[var(--info-soft)]",
    iconClass: "text-[var(--info)]",
  },
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { icon: Icon, className, iconClass } = TONES[toast.tone];

  useEffect(() => {
    // Errors stay until dismissed; everything else clears itself.
    if (toast.tone === "error") return;
    const timer = setTimeout(onDismiss, 4500);
    return () => clearTimeout(timer);
  }, [toast.tone, onDismiss]);

  return (
    <div
      className={cn(
        "toast-enter pointer-events-auto flex items-start gap-2.5 rounded-card border p-3 shadow-md",
        className
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClass)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-secondary">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="-m-1 rounded-sm p-1 text-subtle transition hover:text-secondary"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Returns `toast({ title, description?, tone? })`. Defaults to the success tone. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/** Convenience helpers so call sites read as `toast.success(...)`. */
export function useToastActions() {
  const toast = useToast();
  return useMemo(
    () => ({
      success: (title: string, description?: string) =>
        toast({ tone: "success", title, description }),
      error: (title: string, description?: string) =>
        toast({ tone: "error", title, description }),
      warning: (title: string, description?: string) =>
        toast({ tone: "warning", title, description }),
      info: (title: string, description?: string) =>
        toast({ tone: "info", title, description }),
    }),
    [toast]
  );
}
