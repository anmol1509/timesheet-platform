"use client";

import { useState, useTransition } from "react";
import {
  addClientContactAction,
  removeClientContactAction,
  updateClientContactAction,
} from "../actions";
import { DeleteButton } from "@/components/DeleteButton";

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
      <h2 className="mb-3 text-sm font-semibold text-primary">
        Contacts ({contacts.length})
      </h2>
      <div className="card overflow-hidden">
        {contacts.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
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
                        className="input w-full px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={draft.designation}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, designation: e.target.value }))
                        }
                        className="input w-full px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={draft.phone}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, phone: e.target.value }))
                        }
                        className="input w-full px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={draft.email}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, email: e.target.value }))
                        }
                        className="input w-full px-2 py-1"
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
                        className="text-xs font-medium text-subtle hover:underline"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-primary">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {c.designation || "—"}
                    </td>
                    <td className="px-4 py-3 text-secondary">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-secondary">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="mr-2 text-xs font-medium text-muted hover:underline"
                      >
                        Edit
                      </button>
                      <DeleteButton
                        action={removeClientContactAction}
                        hiddenFields={{ clientId, contactId: c.id }}
                        confirmMessage={`Remove contact "${c.name}"?`}
                        label="Remove"
                      />
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
        <form
          action={addClientContactAction}
          className="flex flex-wrap items-end gap-3 border-t border-default p-4 first:border-t-0"
        >
          <input type="hidden" name="clientId" value={clientId} />
          <label className="block min-w-[140px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">
              Name
            </span>
            <input
              name="name"
              required
              className="input w-full"
            />
          </label>
          <label className="block min-w-[140px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">
              Designation
            </span>
            <input
              name="designation"
              className="input w-full"
            />
          </label>
          <label className="block min-w-[140px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">
              Phone
            </span>
            <input
              name="phone"
              className="input w-full"
            />
          </label>
          <label className="block min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">
              Email
            </span>
            <input
              name="email"
              type="email"
              className="input w-full"
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
          >
            + Add
          </button>
        </form>
      </div>
    </section>
  );
}
