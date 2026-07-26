"use client";

import { deleteUploadAction } from "./actions";

export function DeleteUploadButton({
  uploadId,
  filename,
  monthLabels,
}: {
  uploadId: string;
  filename: string;
  monthLabels: string[];
}) {
  return (
    <form
      action={deleteUploadAction}
      onSubmit={(e) => {
        const monthsText = monthLabels.join(", ") || "its months";
        const ok = window.confirm(
          `Delete "${filename}" from the upload log and wipe ALL employee hours for ${monthsText}?\n\n` +
            `This removes every employee's hours for ${
              monthLabels.length > 1 ? "these months" : "this month"
            } — including hours added by any other upload, not just this file — and cannot be undone.`
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="uploadId" value={uploadId} />
      <button
        type="submit"
        className="text-xs font-medium text-red-600 hover:underline"
      >
        Remove
      </button>
    </form>
  );
}
