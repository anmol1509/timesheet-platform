"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { NewItemForm } from "./new-item-form";

/** "Add item" opens the form in a dialog rather than leaving it on the page all the time. */
export function AddItemDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="btn btn-primary btn-sm gap-1.5"><Plus className="h-3.5 w-3.5" aria-hidden />Add item</button>
      </DialogTrigger>
      {open && (
        <DialogContent title="Add an item" description="A quantity entered here becomes its first stock. You can split it into sizes later." className="max-w-xl">
          <div className="mt-4"><NewItemForm bare /></div>
        </DialogContent>
      )}
    </Dialog>
  );
}
