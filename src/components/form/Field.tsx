// Codifies the label/input markup repeated in every edit-form.tsx across
// suppliers/clients/employees. No validation engine — stays on native
// FormData + useTransition submission, matching the existing convention.
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
