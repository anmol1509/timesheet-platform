"use client";

import { useState, useTransition } from "react";

export function InlineEditRow({
  value,
  action,
  hiddenFields,
  fieldName = "name",
  placeholder,
}: {
  value: string;
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  fieldName?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span>{value || <span className="text-subtle">—</span>}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-subtle hover:text-secondary hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await action(formData);
          setEditing(false);
        });
      }}
      className="flex items-center gap-2"
    >
      {Object.entries(hiddenFields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input
        name={fieldName}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        autoFocus
        className="input px-2 py-1"
      />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setDraft(value);
        }}
        className="text-xs font-medium text-subtle hover:underline"
      >
        Cancel
      </button>
    </form>
  );
}
