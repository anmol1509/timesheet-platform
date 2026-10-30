"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { ACCOUNT_TYPES, TYPE_LABEL, type AccountType } from "@/lib/books/chart";
import { saveAccountAction, setAccountActiveAction } from "../actions";
import { Alert } from "@/components/Alert";

type Existing = { id: string; code: string; name: string; type: string; isSystem: boolean; isActive: boolean };

/** Add an account, or edit/hide one. Accounts the system posts to keep their type and can't be hidden. */
export function AccountDialog({ account, defaultType }: { account?: Existing; defaultType?: AccountType }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(account?.code ?? "");
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<string>(account?.type ?? defaultType ?? "EXPENSE");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>) => start(async () => { const r = await fn(); if (r.error) setError(r.error); else setOpen(false); });
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      <DialogTrigger asChild>
        {account ? <button type="button" aria-label={`Edit ${account.name}`} className="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-primary"><Pencil className="h-3.5 w-3.5" aria-hidden /></button> : <Button type="button" size="sm"><Plus className="h-4 w-4" aria-hidden />New account</Button>}
      </DialogTrigger>
      <DialogContent title={account ? "Edit account" : "New account"}>
        <div className="space-y-3">
          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <label className="text-sm font-medium text-primary">Code<Input className="mt-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder="5800" /></label>
            <label className="text-sm font-medium text-primary">Name<Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Staff training" /></label>
          </div>
          <label className="block text-sm font-medium text-primary">Type
            <div className="mt-1"><Select value={type} onChange={setType} disabled={account?.isSystem} options={ACCOUNT_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))} /></div>
          </label>
          {account?.isSystem && <p className="text-xs text-muted">The system posts to this account automatically, so its type is fixed and it cannot be hidden.</p>}
          {error && <Alert>{error}</Alert>}
        </div>
        <DialogFooter>
          {account && !account.isSystem && <Button type="button" variant="ghost" className="mr-auto" disabled={pending} onClick={() => run(() => setAccountActiveAction(account.id, !account.isActive))}>{account.isActive ? "Hide" : "Show again"}</Button>}
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={pending} onClick={() => run(() => saveAccountAction({ id: account?.id, code, name, type }))} loading={pending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
