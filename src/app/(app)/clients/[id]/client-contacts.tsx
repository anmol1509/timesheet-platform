"use client";

import { useState, useTransition } from "react";
import {
  addClientContactAction,
  removeClientContactAction,
  updateClientContactAction,
} from "../actions";

type Contact = {
  id: string;
  name: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
};

const emptyDraft = { name: "", designation: "", phone: "", email: "" };

export function ClientContacts({
  clientId,
  contacts,
}: {
  clientId: string;
  contacts: Contact[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [pending, startTransition] = useTransition();

  function startEdit(c: Contact) {
    setEditingId(c.id);
    setDraft({
      name: c.name,
      designation: c.designation || "",
      phone: c.phone || "",
      email: c.email || "",
    });
  }

  function saveEdit() {
    if (!editingId) return;
    const formData = new FormData();
    formData.set("clientId", clientId);
    formData.set("contactId", editingId);
    formData.set("name", draft.name);
    formData.set("designation", draft.designation);
    formData.set("phone", draft.phone);
    formData.set("email", draft.email);
    startTransition(async () => {
      await updateClientContactAction(formData);
      setEditingId(null);
    });
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">
        Contacts ({contacts.length})
      </h2>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {contacts.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.map((c) =>
                editingId === c.id ? (
                  <tr key={c.id}>
                    <td className="px-4 py-2">
                      <input
                        value={draft.name}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, name: e.target.value }))
                        }
                        autoFocus
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-900"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={draft.designation}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, designation: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-900"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={draft.phone}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, phone: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-900"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={draft.email}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, email: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-900"
                      />
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={saveEdit}
                        className="mr-2 text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50"
                      >
                        {pending ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs font-medium text-slate-400 hover:underline"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.designation || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="mr-2 text-xs font-medium text-slate-500 hover:underline"
                      >
                        Edit
                      </button>
                      <form action={removeClientContactAction} className="inline">
                        <input type="hidden" name="clientId" value={clientId} />
                        <input type="hidden" name="contactId" value={c.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
        <form
          action={addClientContactAction}
          className="flex flex-wrap items-end gap-3 border-t border-slate-100 p-4 first:border-t-0"
        >
          <input type="hidden" name="clientId" value={clientId} />
          <label className="block min-w-[140px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Name
            </span>
            <input
              name="name"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </label>
          <label className="block min-w-[140px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Designation
            </span>
            <input
              name="designation"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </label>
          <label className="block min-w-[140px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Phone
            </span>
            <input
              name="phone"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </label>
          <label className="block min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Email
            </span>
            <input
              name="email"
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0B1642]/90"
          >
            + Add
          </button>
        </form>
      </div>
    </section>
  );
}
