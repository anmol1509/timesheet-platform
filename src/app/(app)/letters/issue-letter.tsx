"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { EmployeeLetterPaper } from "@/components/LetterPreview";
import { issueLetterAction, previewLetterAction } from "./actions";

export type TemplateOption = { id: string; name: string; asks: string[]; usesSalary: boolean };
export type EmployeeOption = { id: string; name: string; idNo: string; trade: string | null };

export function IssueLetter({ employees, templates, companyName, today, canIssue }: { employees: EmployeeOption[]; templates: TemplateOption[]; companyName: string; today: string; canIssue: boolean }) {
  const [employeeId, setEmployeeId] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ html?: string; title?: string; missing?: string[]; error?: string } | null>(null);
  const [loading, startPreview] = useTransition();
  const [issuing, startIssue] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const template = templates.find((t) => t.id === templateId);
  const key = useMemo(() => JSON.stringify(inputs), [inputs]);

  // Debounced live preview with the person's real details.
  useEffect(() => {
    if (!employeeId || !templateId) return;
    const t = setTimeout(() => startPreview(async () => setPreview(await previewLetterAction(employeeId, templateId, inputs))), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, templateId, key]);

  const ready = !!employeeId && !!template && preview?.html && !(preview.missing?.length);
  const shown = employeeId && template ? preview : null;

  function issue() {
    setError(null);
    startIssue(async () => {
      const res = await issueLetterAction(employeeId, templateId, inputs);
      if (res.error) setError(res.error);
      else if (res.id) window.open(`/api/letters/${res.id}/pdf`, "_blank");
    });
  }

  if (templates.length === 0) {
    return <div className="card p-8 text-center text-sm text-muted">No employee letter templates yet. Add the ready-made ones under Administration → Letter Templates.</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="card space-y-4 self-start p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Employee</span>
          <Select value={employeeId} onChange={(v) => { setEmployeeId(v); setPreview(null); }} placeholder="Choose an employee…" searchPlaceholder="Search name or ID…" options={employees.map((e) => ({ value: e.id, label: `${e.name} · ${e.idNo}` }))} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Letter</span>
          <select value={templateId} onChange={(e) => { setTemplateId(e.target.value); setInputs({}); setPreview(null); }} className="input w-full">
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        {template?.asks.map((label) => (
          <label key={label} className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
            <input value={inputs[label] ?? ""} onChange={(e) => setInputs((prev) => ({ ...prev, [label]: e.target.value }))} className="input w-full" />
          </label>
        ))}
        {template?.usesSalary && <p className="text-xs text-muted">This letter states the employee&apos;s salary from their Payroll &amp; WPS tab.</p>}
        {canIssue ? (
          <button type="button" className="btn btn-primary w-full" disabled={!ready || issuing} onClick={issue}>
            <FileDown className="h-4 w-4" aria-hidden /> {issuing ? "Issuing…" : "Issue letter & open PDF"}
          </button>
        ) : (
          <p className="text-xs text-muted">You can preview letters but not issue them.</p>
        )}
        {shown?.missing && shown.missing.length > 0 && <p className="text-xs text-muted">Fill in: {shown.missing.join(", ")}</p>}
        {(error || shown?.error) && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{error ?? shown?.error}</p>}
        <p className="text-xs text-muted">Issuing numbers the letter, stores its exact wording, and records who issued it.</p>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">Preview {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}</div>
        <div className="rounded-lg bg-surface-sunken p-4">
          {shown?.html ? (
            <EmployeeLetterPaper companyName={companyName} refNo="LTR-••••••" date={today} title={shown.title ?? ""} html={shown.html} />
          ) : (
            <p className="py-16 text-center text-sm text-muted">{employeeId ? (shown?.error ?? "Preparing…") : "Choose an employee to see the letter with their details filled in."}</p>
          )}
        </div>
      </div>
    </div>
  );
}
