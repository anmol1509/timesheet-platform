"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { OtherDocFields } from "@/components/OtherDocFields";
import { readOtherDoc } from "@/components/otherDocRead";
import { nameFromFile, otherDocProblem, trackedExpiry } from "@/lib/otherDoc";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
/**
 * A file picked for "Other" in a module's document form, held here until it has a name and an expiry decision. The AI
 * suggests both from the file; nothing is saved until Upload. `save` gets the name and the expiry ("" when not tracked).
 */
export function OtherDocStage({ file, save, onDone }: {
  file: File;
  save: (input: { name: string; expiry: string }) => Promise<{ error?: string | null } | void>;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(() => nameFromFile(file.name));
  const [track, setTrack] = useState(false);
  const [expiry, setExpiry] = useState("");
  const [note, setNote] = useState<string | null>("Reading the file…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const first = nameFromFile(file.name);
    void readOtherDoc(file).then((read) => {
      if (!live) return;
      if (!read) { setNote(null); return; }
      setName((n) => (n === first && read.name ? read.name : n));
      if (read.expiry) { setTrack(true); setExpiry((e) => e || read.expiry); }
      setNote(read.name || read.expiry ? "Filled in from the file. Check it before uploading." : null);
    });
    return () => { live = false; };
  }, [file]);

  function submit() {
    const why = otherDocProblem(name, track, expiry);
    if (why) { setError(why); return; }
    setError(null);
    start(async () => {
      const res = await save({ name: name.trim(), expiry: trackedExpiry(track, expiry) });
      if (res && res.error) { setError(res.error); return; }
      onDone();
    });
  }

  return (
    <div className="space-y-3 border-b border-default bg-surface-subtle p-4">
      <p className="text-xs font-medium text-muted">New document: {file.name}</p>
      <OtherDocFields name={name} onName={setName} track={track} onTrack={setTrack} expiry={expiry} onExpiry={setExpiry} disabled={pending} note={note} />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="btn" type="button" disabled={pending} onClick={submit} loading={pending}>Upload</Button>
        <button type="button" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary" disabled={pending} onClick={onDone}><X className="h-4 w-4" aria-hidden />Cancel</button>
        {error && <Alert inline>{error}</Alert>}
      </div>
    </div>
  );
}
