import { ASK_PREFIX, splitAtWorkerTable, substituteInHtml, tokensIn } from "@/lib/letterHtml";
import { DEFAULT_LETTER_COLUMNS, LETTER_TABLE_COLUMNS } from "@/lib/letterLayout";
import { EMPLOYEE_MERGE_FIELDS, type Audience } from "@/lib/letterFields";
import { SAMPLE_VALUES, SAMPLE_WORKERS } from "@/lib/letterSample";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function sampleTable(): string {
  const cols = LETTER_TABLE_COLUMNS.filter((c) => (DEFAULT_LETTER_COLUMNS as readonly string[]).includes(c.key));
  const cell = (key: string, i: number) => {
    const w = SAMPLE_WORKERS[i];
    return ({ SNO: String(i + 1), NAME: w.name.toUpperCase(), COMPANY: SAMPLE_VALUES.COMPANYNAME, DESIGNATION: w.trade ?? "", NATIONALITY: (w.nationality ?? "").toUpperCase(), PASSPORT: w.passportNumber ?? "", ID_NUMBER: w.emiratesId ?? "" } as Record<string, string>)[key] ?? "";
  };
  return `<table><thead><tr>${cols.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead><tbody>${SAMPLE_WORKERS.map((_, i) => `<tr>${cols.map((c) => `<td>${esc(cell(c.key, i))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

/** A template's wording with sample details filled in (and a sample worker table), as plain text, for a picture of the paper. */
export function sampleFilledHtml(html: string, audience: Audience): string {
  const values: Record<string, string> = audience === "EMPLOYEE" ? Object.fromEntries(EMPLOYEE_MERGE_FIELDS.map((f) => [f.key, f.example])) : { ...SAMPLE_VALUES, SPONSORSHIPCOMPANYNAME: SAMPLE_VALUES.COMPANYNAME };
  for (const t of tokensIn(html)) if (t.startsWith(ASK_PREFIX)) values[t] = `[${t.slice(ASK_PREFIX.length).trim()}]`;
  if (audience !== "SITE") return substituteInHtml(html, values);
  const { before, after } = splitAtWorkerTable(html);
  return substituteInHtml(before, values) + sampleTable() + substituteInHtml(after, values);
}
