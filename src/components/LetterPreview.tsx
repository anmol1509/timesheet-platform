import { LETTER_MERGE_FIELDS, LETTER_TABLE_COLUMNS, DEFAULT_LETTER_COLUMNS } from "@/lib/letterLayout";
import { parseLetterBody } from "@/lib/letterMarkup";
import { SAMPLE_VALUES, SAMPLE_WORKERS } from "@/lib/letterSample";

const KNOWN = new Map(LETTER_MERGE_FIELDS.map((f) => [f.key, f]));

/** Renders text with each %%FIELD%% shown as a highlighted sample value (or a red warning if it isn't a real field). */
function WithFields({ text }: { text: string }) {
  const parts = text.split(/(%%\w+%%)/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^%%(\w+)%%$/.exec(part);
        if (!m) return <span key={i}>{part}</span>;
        const f = KNOWN.get(m[1]);
        return f ? (
          <span key={i} title={`${f.label} — filled in automatically`} className="rounded bg-blue-100 px-1 text-blue-800">
            {f.example}
          </span>
        ) : (
          <span key={i} title="Not a real field — it would print blank" className="rounded bg-red-100 px-1 text-red-700">
            ⚠ {part}
          </span>
        );
      })}
    </>
  );
}

const cell = (key: string, i: number) => {
  const w = SAMPLE_WORKERS[i];
  switch (key) {
    case "SNO": return String(i + 1);
    case "NAME": return w.name.toUpperCase();
    case "COMPANY": return SAMPLE_VALUES.COMPANYNAME;
    case "DESIGNATION": return w.trade ?? "";
    case "NATIONALITY": return (w.nationality ?? "").toUpperCase();
    case "PASSPORT": return w.passportNumber ?? "";
    case "ID_NUMBER": return w.emiratesId ?? "";
    default: return "";
  }
};

/**
 * A paper-style preview of the letter as it will print: the fixed parts (date,
 * addressee, worker table, signature) around the template's own heading and body.
 * Always black on white, like the printed page, regardless of the app theme.
 */
export function LetterPreview({ title, body }: { title: string; body: string }) {
  const blocks = parseLetterBody(body);
  const cols = LETTER_TABLE_COLUMNS.filter((c) => (DEFAULT_LETTER_COLUMNS as readonly string[]).includes(c.key));
  return (
    <div className="mx-auto w-full max-w-[34rem] rounded-sm bg-white p-7 text-[11px] leading-relaxed text-black shadow-[0_1px_6px_rgba(0,0,0,0.15)] ring-1 ring-black/5">
      <p>Date: {SAMPLE_VALUES.DATE}</p>
      <div className="mt-3">
        <p>To,</p>
        <p className="font-bold">M/s. {SAMPLE_VALUES.CLIENTNAME}</p>
        <p>{SAMPLE_VALUES.CLIENTADDRESS}</p>
      </div>
      <p className="mt-2 font-bold">Project: {SAMPLE_VALUES.PROJECTNAME}</p>
      <p className="my-3 text-center text-xs font-bold underline">{(title || "Letter title").toUpperCase()}</p>

      <div className="space-y-2 text-justify">
        {blocks.map((b, i) => {
          const runs = b.runs.map((r, j) => (r.bold ? <strong key={j}><WithFields text={r.text} /></strong> : <WithFields key={j} text={r.text} />));
          return b.type === "li" ? (
            <div key={i} className="flex gap-2 pl-3"><span>•</span><p className="flex-1">{runs}</p></div>
          ) : (
            <p key={i}>{runs}</p>
          );
        })}
      </div>

      <table className="mt-3 w-full border-collapse text-[9px]">
        <thead>
          <tr>{cols.map((c) => <th key={c.key} className="border border-black bg-neutral-200 px-1 py-0.5 text-left">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {SAMPLE_WORKERS.map((_, i) => (
            <tr key={i}>{cols.map((c) => <td key={c.key} className="border border-black px-1 py-0.5">{cell(c.key, i)}</td>)}</tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6">
        <p>For and on behalf of</p>
        <p className="font-bold">{SAMPLE_VALUES.COMPANYNAME}</p>
        <p>Authorised Signatory</p>
      </div>
    </div>
  );
}
