"use client";

import { deleteUploadAction } from "./actions";
import { DeleteButton } from "@/components/DeleteButton";

export function DeleteUploadButton({
  uploadId,
  filename,
  monthLabels,
}: {
  uploadId: string;
  filename: string;
  monthLabels: string[];
}) {
  const monthsText = monthLabels.join(", ") || "its months";
  return (
    <DeleteButton
      action={deleteUploadAction}
      hiddenFields={{ uploadId }}
      confirmMessage={
        `Delete "${filename}" from the upload log and wipe ALL employee hours for ${monthsText}? ` +
        `This removes every employee's hours for ${
          monthLabels.length > 1 ? "these months" : "this month"
        } — including hours added by any other upload, not just this file — and cannot be undone.`
      }
      label="Remove"
    />
  );
}
