"use client";

import { useRef } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function MarkPaidButton({
  action,
  invoiceId,
  invoiceNumber,
}: {
  action: (formData: FormData) => void | Promise<void>;
  invoiceId: string;
  invoiceNumber: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={formRef} action={action}>
        <input type="hidden" name="invoiceId" value={invoiceId} />
      </form>
      <ConfirmDialog
        title="Mark invoice as paid"
        description={`Mark invoice ${invoiceNumber} as paid? This updates its status immediately.`}
        confirmLabel="Mark paid"
        danger={false}
        onConfirm={() => formRef.current?.requestSubmit()}
        trigger={(open) => (
          <button
            type="button"
            onClick={open}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            Mark paid
          </button>
        )}
      />
    </>
  );
}
