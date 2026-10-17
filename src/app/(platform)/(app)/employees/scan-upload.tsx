"use client";

import { useRef, useState } from "react";
import { ScanDrop } from "@/components/quick-view/ScanDrop";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { shrinkImage } from "@/lib/compressImage";
import { pdfPageToImage } from "@/lib/pdfPageToImage";
import type { ExtractedDocumentFields } from "@/app/api/documents/extract/route";
import { uploadDocumentAction, uploadPhotoAction } from "./[id]/actions";
import { applyScanAction, type ScanResult } from "./quick-view";

export type ScanOutcome = ScanResult & {
  files: number;
  /** Files that were saved but whose details couldn't be read. */
  unread: number;
  /** Why the last file couldn't be read, when it couldn't. */
  reason: string | null;
  photo: boolean;
};

/** The document types a pack can be filed under, and the profile date each one carries. */
const EXPIRY_OF: Record<string, keyof ExtractedDocumentFields> = {
  PASSPORT: "passportExpiry",
  EMIRATES_ID: "emiratesIdExpiry",
  LABOR_CARD: "laborCardExpiry",
  VISA: "visaExpiry",
  RESIDENCY_ISSUANCE: "visaExpiry",
};

/**
 * One way to add a scan, everywhere in the quick view. The file is read, kept
 * as a document against the worker (under every type a pack turns out to
 * contain, with its expiry), and everything readable is put on the profile in
 * the same step — so nothing is typed that the scan already said.
 */
export function ScanUpload({ employeeId, docType, hasPhoto, multiple, title, hint, compact, onDone }: {
  employeeId: string;
  /** "COMBINED" for a pack of several documents, or one document type. */
  docType: string;
  hasPhoto: boolean;
  multiple?: boolean;
  title?: string;
  hint?: string;
  compact?: boolean;
  onDone: (outcome: ScanOutcome) => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function run(picked: File[]) {
    if (picked.length === 0) return;
    setError(null);
    const ac = new AbortController();
    abort.current = ac;
    const out: ScanOutcome = { applied: [], conflicts: [], files: 0, unread: 0, reason: null, photo: false };
    try {
      for (const [n, raw] of picked.entries()) {
        if (ac.signal.aborted) break;
        setStatus(picked.length > 1 ? `Reading ${n + 1} of ${picked.length}…` : "Reading the document…");
        const file = await shrinkImage(raw);
        if (file.size > MAX_UPLOAD_BYTES) { setError(`"${file.name}" is too large — max ${MAX_UPLOAD_LABEL}.`); continue; }

        let fields: ExtractedDocumentFields = {};
        if (file.type.startsWith("image/") || file.type === "application/pdf") {
          const body = new FormData();
          body.append("file", file);
          body.append("docType", docType);
          const res = await fetch("/api/documents/extract", { method: "POST", body, signal: ac.signal }).catch(() => null);
          if (ac.signal.aborted) break;
          const payload = res ? await res.json().catch(() => null) : null;
          if (res?.ok && payload) fields = payload as ExtractedDocumentFields;
          else { out.unread++; out.reason = (payload && typeof payload.error === "string" && payload.error) || "The document couldn't be read."; }
        }

        // Kept as a document under each type it holds, so renewals, lists and reminders find it where they look.
        const found = (fields.documentsFound ?? []).filter((t) => t in EXPIRY_OF);
        const types = docType === "COMBINED" ? (found.length ? found : ["DOCUMENT_PACK"]) : [docType];
        setStatus("Saving…");
        for (const type of types) {
          const form = new FormData();
          form.append("employeeId", employeeId);
          form.append("type", type);
          const key = EXPIRY_OF[type];
          form.append("expiryDate", key && typeof fields[key] === "string" ? (fields[key] as string) : "");
          form.append("file", file);
          const r = await uploadDocumentAction(form);
          if (r.error) { setError(r.error); break; }
        }
        out.files++;

        if (Object.keys(fields).length > 0) {
          const r = await applyScanAction({ id: employeeId, fields });
          if ("error" in r) { setError(r.error); }
          else {
            for (const a of r.applied) if (!out.applied.some((x) => x.key === a.key)) out.applied.push(a);
            for (const c of r.conflicts) if (!out.conflicts.some((x) => x.key === c.key)) out.conflicts.push(c);
          }
        }

        // A pack often carries the worker's photo as one page; lift it out when the profile has none.
        const page = Number(fields.photoPage);
        if (docType === "COMBINED" && !hasPhoto && !out.photo && Number.isFinite(page) && page >= 1) {
          const image = await pdfPageToImage(file, page).catch(() => null);
          if (image) {
            const form = new FormData();
            form.append("employeeId", employeeId);
            form.append("photo", image);
            await uploadPhotoAction(form);
            out.photo = true;
          }
        }
      }
    } catch {
      setError("That didn't upload. Please try again.");
    } finally {
      setStatus(null);
    }
    if (ac.signal.aborted) setError(out.files > 0 ? `Stopped. ${out.files} ${out.files === 1 ? "file was" : "files were"} already saved.` : "Cancelled. Nothing was saved.");
    if (out.files > 0) onDone(out);
  }

  return <ScanDrop title={title} hint={hint} compact={compact} multiple={multiple} status={status} error={error} onFiles={(f) => void run(f)} onCancel={() => abort.current?.abort()} />;
}
