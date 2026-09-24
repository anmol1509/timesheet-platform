import { DEFAULT_LETTER_COLUMNS, LETTER_TABLE_COLUMNS } from "@/lib/letterLayout";
import { EMPLOYEE_MERGE_FIELDS, fieldsFor, type Audience } from "@/lib/letterFields";
import { ASK_PREFIX, splitAtWorkerTable } from "@/lib/letterHtml";
import { SAMPLE_VALUES, SAMPLE_WORKERS } from "@/lib/letterSample";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function sampleTable(): string {
  const cols = LETTER_TABLE_COLUMNS.filter((c) => (DEFAULT_LETTER_COLUMNS as readonly string[]).includes(c.key));
  const cell = (key: string, i: number) => {
    const w = SAMPLE_WORKERS[i];
    return ({ SNO: String(i + 1), NAME: w.name.toUpperCase(), COMPANY: SAMPLE_VALUES.COMPANYNAME, DESIGNATION: w.trade ?? "", NATIONALITY: (w.nationality ?? "").toUpperCase(), PASSPORT: w.passportNumber ?? "", ID_NUMBER: w.emiratesId ?? "" } as Record<string, string>)[key] ?? "";
  };
  return `<table class="letter-sample-table"><thead><tr>${cols.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead><tbody>${SAMPLE_WORKERS.map((_, i) => `<tr>${cols.map((c) => `<td>${esc(cell(c.key, i))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

/** Turns the editor's HTML into preview HTML: fields become coloured sample values, the worker marker becomes a sample table. */
function toPreviewHtml(html: string, audience: Audience): string {
  const fields = new Map(fieldsFor(audience).map((f) => [f.key, f]));
  const chip = (cls: string, text: string, title: string) => `<span class="${cls}" title="${esc(title)}" style="border-radius:4px;padding:0 3px;${cls === "ok" ? "background:#dbeafe;color:#1e40af" : cls === "ask" ? "background:#fef3c7;color:#92400e" : "background:#fee2e2;color:#b91c1c"}">${esc(text)}</span>`;
  const fill = (h: string) =>
    h.replace(/%%([^%<>\n]+?)%%/g, (_m, raw: string) => {
      const key = raw.trim();
      if (key.startsWith(ASK_PREFIX)) return chip("ask", `[${key.slice(ASK_PREFIX.length)}]`, "Filled in when the letter is issued");
      const f = fields.get(key) ?? (key === "SPONSORSHIPCOMPANYNAME" ? fields.get("COMPANYNAME") : undefined);
      return f ? chip("ok", f.example, `${f.label} — filled in automatically`) : chip("bad", `⚠ %%${key}%%`, "Not a real field — it would print blank");
    });
  if (audience !== "SITE") return fill(html);
  const { before, after } = splitAtWorkerTable(html);
  return fill(before) + sampleTable() + fill(after);
}

/**
 * A paper-style preview of the letter as it will print. Site letters show the
 * fixed parts (date, addressee, worker table, signature) around the body;
 * employee letters show a letterhead, reference and signature. Always black on
 * white, like the printed page, whatever the app theme.
 */
export function LetterPreview({ title, html, audience }: { title: string; html: string; audience: Audience }) {
  const body = toPreviewHtml(html, audience);
  return (
    <div className="letter-paper mx-auto w-full max-w-[34rem] rounded-sm bg-white p-7 text-[11px] leading-relaxed text-black shadow-[0_1px_6px_rgba(0,0,0,0.15)] ring-1 ring-black/5">
      {audience === "SITE" ? (
        <>
          <p>Date: {SAMPLE_VALUES.DATE}</p>
          <div className="mt-3"><p>To,</p><p className="font-bold">M/s. {SAMPLE_VALUES.CLIENTNAME}</p><p>{SAMPLE_VALUES.CLIENTADDRESS}</p></div>
          <p className="mt-2 font-bold">Project: {SAMPLE_VALUES.PROJECTNAME}</p>
        </>
      ) : (
        <>
          <div className="mb-3 border-b border-black pb-2"><p className="text-sm font-bold">{SAMPLE_VALUES.COMPANYNAME}</p><p className="text-[9px] text-neutral-600">Business Bay, Dubai · Tel: +971 4 123 4567</p></div>
          <div className="flex justify-between"><p>Ref: {EMPLOYEE_MERGE_FIELDS.find((f) => f.key === "REFNO")!.example}</p><p>Date: {SAMPLE_VALUES.DATE}</p></div>
        </>
      )}
      <p className="my-3 text-center text-xs font-bold underline">{(title || "Letter title").toUpperCase()}</p>
      <div className="text-justify" dangerouslySetInnerHTML={{ __html: body }} />
      <div className="mt-6">
        <p>For and on behalf of</p>
        <p className="font-bold">{SAMPLE_VALUES.COMPANYNAME}</p>
        <p className="mt-4">Authorised Signatory</p>
      </div>
    </div>
  );
}

/** An employee letter with real (already filled in) content, on paper. */
export function EmployeeLetterPaper({ companyName, refNo, date, title, html }: { companyName: string; refNo: string; date: string; title: string; html: string }) {
  return (
    <div className="letter-paper mx-auto w-full max-w-[34rem] rounded-sm bg-white p-7 text-[11px] leading-relaxed text-black shadow-[0_1px_6px_rgba(0,0,0,0.15)] ring-1 ring-black/5">
      <div className="mb-3 border-b border-black pb-2"><p className="text-sm font-bold">{companyName}</p></div>
      <div className="flex justify-between"><p>Ref: {refNo}</p><p>Date: {date}</p></div>
      <p className="my-3 text-center text-xs font-bold underline">{title.toUpperCase()}</p>
      <div className="text-justify" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="mt-6"><p>For and on behalf of</p><p className="font-bold">{companyName}</p><p className="mt-4">Authorised Signatory</p></div>
    </div>
  );
}
