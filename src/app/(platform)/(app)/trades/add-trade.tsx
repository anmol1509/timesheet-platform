"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { createSkillAction } from "./actions";

import { Button } from "@/components/ui/Button";
/** The add-a-trade form, opened from the banner so the list keeps the page. */
export function AddTrade({ triggerClassName }: { triggerClassName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={triggerClassName}><Plus className="h-4 w-4" aria-hidden /> Add trade</button>
      </DialogTrigger>
      <DialogContent title="Add a trade" description="A trade you add is yours; the standard catalogue stays as it is." className="max-w-md">
        <form
          className="mt-4 space-y-3"
          action={(fd) => start(async () => { await createSkillAction(fd); setOpen(false); })}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Trade name *</span>
            <input name="name" required autoFocus placeholder="e.g. Welding" className="input w-full" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Category</span>
            <input name="category" placeholder="e.g. Technical" className="input w-full" />
          </label>
          <Checkbox name="trending" value="on" label="Trending" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <Button size="btn" type="submit" disabled={pending} loading={pending}>Add trade</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
