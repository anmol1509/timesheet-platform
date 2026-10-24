"use client";

import { useState } from "react";
import { createOwnCompanyAction } from "./actions";

export function AddCompanyForm() {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      action={async (fd) => {
        setError(null);
        const r = await createOwnCompanyAction(fd);
        if (r?.error) setError(r.error);
      }}
      className="card flex flex-wrap items-end gap-3 p-4"
    >
      <label className="block min-w-[200px] flex-1">
        <span className="mb-1 block text-xs font-medium text-muted">Company name</span>
        <input name="name" required className="input w-full" placeholder="e.g. Gulf Skills Manpower" />
      </label>
      <label className="block min-w-[200px] flex-1">
        <span className="mb-1 block text-xs font-medium text-muted">Full legal name (optional)</span>
        <input name="fullName" className="input w-full" placeholder="As on the trade licence" />
      </label>
      <button type="submit" className="btn btn-primary">Add company</button>
      {error && <p className="w-full text-sm text-[var(--error)]">{error}</p>}
    </form>
  );
}
