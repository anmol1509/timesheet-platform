import { htmlToText } from "@/lib/letterHtml";
import { presetHtml, type LetterPreset } from "@/lib/letterPresets";

/** A short fingerprint of a letter's visible words, so unedited copies of an older ready-made wording can be recognised. */
export function wordingFingerprint(html: string): string {
  const t = htmlToText(html);
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

/** The ready-made wording of earlier releases, per template, as fingerprints. A template whose words still match one of these has never been edited. */
const OLDER_WORDING: Record<string, string[]> = {
  "noc-standard": [
    "72a3d749"
  ],
  "mobilization-standard": [
    "68f76871"
  ],
  "undertaking-standard": [
    "17f1c5a3"
  ],
  "supplier-undertaking-standard": [
    "e493461c"
  ],
  "advance-request": [
    "64f864c8"
  ],
  "advance-receipt": [
    "9bec9cf1"
  ],
  "salary-revision": [
    "4548d981"
  ],
  "final-settlement": [
    "b12b3eb6"
  ],
  "deduction-notice": [
    "57945966"
  ],
  "salary-transfer-letter": [
    "ddab2dd7"
  ],
  "salary-certificate": [
    "e70243bf"
  ],
  "employment-certificate": [
    "180328d9"
  ],
  "experience-certificate": [
    "f9c8385d"
  ],
  "warning-letter": [
    "75aa002b"
  ],
  "leave-approval": [
    "2293b89e"
  ]
};

export type PresetState = "original" | "update" | "edited";

/** Whether a template made from a ready-made one is still the current wording, is an untouched older version, or has been edited. */
export function presetState(preset: LetterPreset, html: string): PresetState {
  const now = wordingFingerprint(html);
  if (now === wordingFingerprint(presetHtml(preset))) return "original";
  return (OLDER_WORDING[preset.key] ?? []).includes(now) ? "update" : "edited";
}
