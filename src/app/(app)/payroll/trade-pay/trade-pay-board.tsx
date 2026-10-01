"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { PAY_STRUCTURE_LABELS } from "@/lib/payroll";
import { TRADES } from "@/lib/trades";
import { deleteTradePayAction, saveTradePayAction } from "./actions";

type State = { error: string | null; ok?: boolean };
export type TradePayRow = {
  id: string; supplierId: string; trade: string; payStructure: string;
  basicSalary: number | null; housingAllowance: number | null; foodAllowance: number | null; transportAllowance: number | null; otherAllowance: number | null;
  flatMonthlyRate: number | null; hourlyRate: number | null; dailyHours: number; paysOvertime: boolean; otMultiplier: number; restOtMultiplier: number;
};
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function headline(r: TradePayRow) {
  if (r.payStructure === "HOURLY") return `AED ${aed(r.hourlyRate ?? 0)} / hour`;
  if (r.payStructure === "FLAT") return `AED ${aed(r.flatMonthlyRate ?? 0)} / month flat`;
  const allow = (r.housingAllowance ?? 0) + (r.foodAllowance ?? 0) + (r.transportAllowance ?? 0) + (r.otherAllowance ?? 0);
  return `Basic ${aed(r.basicSalary ?? 0)}${allow > 0 ? ` + allowances ${aed(allow)}` : ""}`;
}

function TradeForm({ supplierId, row, onDone }: { supplierId: string; row: TradePayRow | null; onDone: () => void }) {
  const [structure, setStructure] = useState(row?.payStructure ?? "ITEMISED");
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => {
      const res = await saveTradePayAction(prev, fd);
      if (res.ok) onDone();
      return res;
    },
    { error: null } as State
  );
  const L = ({ t, children }: { t: string; children: React.ReactNode }) => (
    <label className="block"><span className="mb-1 block text-xs font-medium text-muted">{t}</span>{children}</label>
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="supplierId" value={supplierId} />
      <L t="Trade *">
        <Select name="trade" defaultValue={row?.trade ?? ""} placeholder="Choose a trade…" options={TRADES.map((t) => ({ value: t, label: t }))} />
      </L>
      <L t="Pay structure">
        <Select name="payStructure" value={structure} onChange={setStructure} searchable={false} options={(["ITEMISED", "FLAT", "HOURLY"] as const).map((v) => ({ value: v, label: PAY_STRUCTURE_LABELS[v] }))} />
      </L>
      <div className="grid grid-cols-2 gap-3">
        {structure === "ITEMISED" && (
          <>
            <L t="Basic salary (AED) *"><NumberInput name="basicSalary" defaultValue={row?.basicSalary ?? ""} min={0} step={0.01} className="w-full" /></L>
            <L t="Housing allowance"><NumberInput name="housingAllowance" defaultValue={row?.housingAllowance ?? ""} min={0} step={0.01} className="w-full" /></L>
            <L t="Food allowance"><NumberInput name="foodAllowance" defaultValue={row?.foodAllowance ?? ""} min={0} step={0.01} className="w-full" /></L>
            <L t="Transport allowance"><NumberInput name="transportAllowance" defaultValue={row?.transportAllowance ?? ""} min={0} step={0.01} className="w-full" /></L>
            <L t="Other allowance"><NumberInput name="otherAllowance" defaultValue={row?.otherAllowance ?? ""} min={0} step={0.01} className="w-full" /></L>
          </>
        )}
        {structure === "FLAT" && <L t="Monthly rate (AED) *"><NumberInput name="flatMonthlyRate" defaultValue={row?.flatMonthlyRate ?? ""} min={0} step={0.01} className="w-full" /></L>}
        {structure === "HOURLY" && <L t="Hourly rate (AED) *"><NumberInput name="hourlyRate" defaultValue={row?.hourlyRate ?? ""} min={0} step={0.01} className="w-full" /></L>}
        <L t="Standard hours per day"><NumberInput name="dailyHours" defaultValue={row?.dailyHours ?? 8} min={1} max={16} step={0.25} className="w-full" /></L>
        <L t="Overtime multiplier"><NumberInput name="otMultiplier" defaultValue={row?.otMultiplier ?? 1.25} min={1} max={3} step={0.01} className="w-full" /></L>
        <L t="Rest-day / holiday multiplier"><NumberInput name="restOtMultiplier" defaultValue={row?.restOtMultiplier ?? 1.5} min={1} max={3} step={0.01} className="w-full" /></L>
      </div>
      <label className="flex items-center gap-2 text-sm text-secondary">
        <input type="checkbox" name="paysOvertime" defaultChecked={row?.paysOvertime ?? true} /> Paid for overtime
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      </div>
    </form>
  );
}

export function TradePayBoard({ companies, rows, canEdit }: { companies: { id: string; name: string }[]; rows: TradePayRow[]; canEdit: boolean }) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [editing, setEditing] = useState<TradePayRow | "new" | null>(null);
  const [, start] = useTransition();
  const mine = rows.filter((r) => r.supplierId === companyId);

  if (companies.length === 0) {
    return <div className="empty-state"><p className="text-sm text-muted">Mark one of your suppliers as &ldquo;our own company&rdquo; first. Trade pay is set per company.</p></div>;
  }
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block w-72">
          <span className="mb-1 block text-xs font-medium text-muted">Company</span>
          <Select value={companyId} onChange={setCompanyId} searchable={companies.length > 6} options={companies.map((c) => ({ value: c.id, label: c.name }))} />
        </label>
        {canEdit && (
          <button type="button" className="btn btn-primary gap-1.5" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden /> Add trade
          </button>
        )}
      </div>
      {mine.length === 0 ? (
        <div className="empty-state"><p className="text-sm text-muted">No default pay set for this company yet. Add a trade to pre-fill the pay of workers in it.</p></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Trade</th><th className="px-4 py-3">Pay</th><th className="px-4 py-3">Day</th><th className="px-4 py-3">Overtime</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {mine.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-primary">{r.trade}</td>
                  <td className="px-4 py-3 text-secondary">{headline(r)}</td>
                  <td className="px-4 py-3 text-secondary">{r.dailyHours} h</td>
                  <td className="px-4 py-3 text-secondary">{r.paysOvertime ? `×${r.otMultiplier} / ×${r.restOtMultiplier} rest day` : "Not paid"}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <span className="flex justify-end gap-3">
                        <button type="button" className="text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setEditing(r)}>Edit</button>
                        <button type="button" className="text-xs font-medium text-[var(--error)] hover:underline" onClick={() => { if (!confirm(`Remove the pay for ${r.trade}? Workers with their own pay are not affected.`)) return; const fd = new FormData(); fd.set("id", r.id); start(async () => { await deleteTradePayAction(fd); }); }}>Remove</button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={editing === "new" || editing === null ? "Add trade pay" : `Pay for ${editing.trade}`} description="Starting figures for workers of this company in this trade. Each worker can then be set to their own pay.">
          {editing !== null && <TradeForm key={editing === "new" ? "new" : editing.id} supplierId={companyId} row={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
