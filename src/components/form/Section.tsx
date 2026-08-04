import { cn } from "@/lib/cn";

// Codifies the "rounded-3xl border bg-white p-6" card wrapper repeated
// around every grouped block of fields in edit-form.tsx files.
export function Section({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl border border-slate-200 bg-white p-6", className)}>
      {title && (
        <h2 className="mb-4 text-sm font-semibold text-slate-900">{title}</h2>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}
