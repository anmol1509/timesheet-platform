"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/Badge";
import { EMPTY_PERSON, PersonPicker, type NewPerson, type PersonOption, type PickerChoice } from "@/components/PersonPicker";
import { SHARE_OPTIONS, equalSplit, ownershipProblem, ownershipSummary } from "@/lib/ownership";
import { saveOwnersAction } from "./party-actions";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
export type OwnerRow = { linkId: string; partyId: string; name: string; percent: number | null };
type Row = { rid: number; linkId?: string; choice: PickerChoice; person: NewPerson; name: string; percent: number | null; touched: boolean };

/**
 * A company's owners and their shares, edited together so the total can be checked: every owner needs a share and the
 * shares must add up to exactly 100. Nothing is saved until the total is right.
 */
export function OwnersEditor({ supplierId, owners, people, canEdit }: { supplierId: string; owners: OwnerRow[]; people: PersonOption[]; canEdit: boolean }) {
  const router = useRouter();
  const nextRid = useRef(owners.length + 1);
  const initial = useMemo<Row[]>(() => owners.map((o, i) => ({ rid: i + 1, linkId: o.linkId, choice: { kind: "existing", partyId: o.partyId }, person: EMPTY_PERSON, name: o.name, percent: o.percent, touched: o.percent !== null })), [owners]);
  const [rows, setRows] = useState<Row[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const summary = ownershipSummary(rows.map((r) => r.percent));
  const problem = ownershipProblem(summary);
  const snapshot = (rs: Row[]) => JSON.stringify(rs.map((r) => [r.linkId ?? null, r.choice, r.person, r.percent]));
  const dirty = snapshot(rows) !== snapshot(initial);
  const picked = rows.flatMap((r) => (r.choice.kind === "existing" ? [r.choice.partyId] : []));

  /** A split someone has chosen by hand needs two or more owners; one owner is simply 100. */
  const manual = (rs: Row[]) => rs.length >= 2 && rs.some((r) => r.touched);
  const evenly = (rs: Row[]): Row[] => { const split = equalSplit(rs.length); return rs.map((r, i) => ({ ...r, percent: split[i], touched: false })); };
  /** After a row goes: a lone owner is 100, and an even split stays even; a hand-chosen split is left for the person to fix. */
  const rebalance = (rs: Row[]): Row[] => (rs.length === 1 || !manual(rs) ? evenly(rs) : rs);
  const patch = (rid: number, p: Partial<Row>) => { setSaved(false); setRows((rs) => rs.map((r) => (r.rid === rid ? { ...r, ...p } : r))); };
  const add = () => {
    setSaved(false);
    setRows((rs) => {
      const row: Row = { rid: nextRid.current++, choice: { kind: "none" }, person: EMPTY_PERSON, name: "", percent: null, touched: false };
      const next = [...rs, row];
      if (!manual(rs)) return evenly(next); // one owner at 100 becomes 50/50, two at 50/50 become 34/33/33
      const left = 100 - rs.reduce((n, r) => n + (r.percent ?? 0), 0);
      return left > 0 ? next.map((r) => (r.rid === row.rid ? { ...r, percent: left } : r)) : next;
    });
  };
  const remove = (rid: number) => { setSaved(false); setRows((rs) => rebalance(rs.filter((r) => r.rid !== rid))); };

  function save() {
    setError(null);
    if (problem) return setError(problem);
    start(async () => {
      const res = await saveOwnersAction({
        supplierId,
        owners: rows.map((r) => ({
          linkId: r.linkId,
          partyId: !r.linkId && r.choice.kind === "existing" ? r.choice.partyId : undefined,
          person: !r.linkId && r.choice.kind === "new" ? r.person : undefined,
          percent: r.percent ?? 0,
        })),
      });
      if (res.error) return setError(res.error);
      setSaved(true);
      router.refresh();
    });
  }

  const totalBadge = rows.length === 0 ? null : summary.ok ? <Badge color="green">Total 100%</Badge> : <Badge color={summary.total > 100 ? "red" : "amber"}>{summary.unset > 0 ? "Choose every share" : `Total ${summary.total}% · ${summary.remaining > 0 ? `${summary.remaining}% left` : `${-summary.remaining}% over`}`}</Badge>;

  return (
    <div className="space-y-3 rounded-2xl border border-default p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-primary">Owners</h3>
          <p className="text-xs text-muted">Each owner&rsquo;s share of the company. They must add up to 100%.</p>
        </div>
        {totalBadge}
      </div>

      {rows.length === 0 && <p className="text-sm text-muted">No owners added yet.</p>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.rid} className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_9rem_auto]">
            {r.linkId ? (
              <p className="py-2 text-sm font-medium text-primary">{r.name}</p>
            ) : (
              <PersonPicker options={people} choice={r.choice} onChoice={(c) => patch(r.rid, { choice: c })} person={r.person} onPerson={(p) => patch(r.rid, { person: p })} hideIds={picked} disabled={!canEdit} />
            )}
            <Select
              value={r.percent === null ? "" : String(r.percent)}
              onChange={(v) => patch(r.rid, { percent: v ? Number(v) : null, touched: true })}
              placeholder="Share"
              disabled={!canEdit}
              options={SHARE_OPTIONS.map((n) => ({ value: String(n), label: `${n}%` }))}
            />
            {canEdit && <button type="button" aria-label="Remove this owner" className="py-2 text-muted hover:text-[var(--error)]" onClick={() => remove(r.rid)}><Trash2 className="h-4 w-4" /></button>}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-secondary gap-1.5" onClick={add}><Plus className="h-3.5 w-3.5" aria-hidden />Add owner</button>
          <Button size="btn" type="button" disabled={pending || !dirty || !!problem} onClick={save} loading={pending}>Save owners</Button>
          {saved && !dirty && <span role="status" className="text-sm text-[var(--success)]">Saved.</span>}
          {dirty && problem && <span className="text-xs text-[var(--warning)]">{problem}</span>}
        </div>
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
