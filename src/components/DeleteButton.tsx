"use client";

import { useRef } from "react";
import { ConfirmDialog } from "./ui/ConfirmDialog";

export function DeleteButton({
  action,
  hiddenFields,
  confirmMessage,
  label = "Delete",
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  confirmMessage: string;
  label?: string;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={formRef} action={action}>
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      </form>
      <ConfirmDialog
        title="Confirm delete"
        description={confirmMessage}
        confirmLabel={label}
        onConfirm={() => formRef.current?.requestSubmit()}
        trigger={(open) => (
          <button
            type="button"
            onClick={open}
            className={className || "text-xs font-medium text-red-600 hover:underline"}
          >
            {label}
          </button>
        )}
      />
    </>
  );
}
