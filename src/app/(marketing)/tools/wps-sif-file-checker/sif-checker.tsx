"use client";

import { useRef, useState } from "react";
import { checkSif, type SifReport } from "@/lib/sifCheck";
import { buildSif, type SifLine } from "@/lib/wps";
import w from "@/app/(marketing)/welcome/welcome.module.css";
import s from "../calculator.module.css";

const IBAN = "AE070331234567890123456";
const sample = (over: Partial<SifLine> = {}): SifLine => ({
  personCode: "12345678901234", routingCode: "123456789", account: IBAN,
  periodStart: "2026-09-01", periodEnd: "2026-09-30", days: 30, net: 2078.13, overtimePay: 78.13, adjustment: 0, leaveDays: 0, ...over,
});
const built = buildSif({
  establishmentId: "0000123", payerRoutingCode: "987654321", payerIban: IBAN, month: "2026-09",
  lines: [sample(), sample({ personCode: "23456789012345", net: 1500.5, overtimePay: 0 }), sample({ personCode: "34567890123456", net: 1800, overtimePay: 0 })],
  now: new Date(Date.UTC(2026, 9, 1, 8, 5)),
});
const GOOD = built.content;
// Same file with the kinds of mistakes that get a real one rejected.
const BAD = built.content
  .replace("EDR,23456789012345,", "EDR,12345678901234,") // duplicate employee ID
  .replace(`${IBAN},2026-09-01,2026-09-30,30,1500.50`, "AE070331234567890123457,2026-09-01,2026-09-30,30,1500.50") // wrong check digit
  .replace(/(SCR,[^\r\n]*,3,)(\d+\.\d{2})/, (_m, head: string) => `${head}5378.64`); // total out by one fils (should be 5378.63)

const money = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/** Reads the file with FileReader and checks it in the browser; nothing is uploaded. */
export function SifChecker() {
  const [text, setText] = useState("");
  const [name, setName] = useState<string | undefined>();
  const [report, setReport] = useState<SifReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (t: string, filename?: string) => {
    setText(t);
    setName(filename);
    setReport(checkSif(t, filename));
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => run(String(reader.result ?? ""), f.name);
    reader.readAsText(f);
  };

  const sum = report?.summary;
  return (
    <div className={s.stack}>
      <div className={s.panel}>
        <h2 className={s.panelTitle}>Your SIF file</h2>
        <p className={s.panelHint}>Upload the file or paste its contents, then check it.</p>
        <textarea
          className={s.textarea}
          value={text}
          onChange={(e) => { setText(e.target.value); setName(undefined); setReport(null); }}
          placeholder={"EDR,12345678901234,123456789,AE070331234567890123456,2026-09-01,2026-09-30,30,2000.00,78.13,0\nSCR,0000123,987654321,2026-10-01,0805,092026,1,2078.13,AED,AE070331234567890123456"}
          spellCheck={false}
          aria-label="SIF file contents"
        />
        <div className={s.actions}>
          <button type="button" className={`${w.btn} ${w.btnPrimary}`} onClick={() => run(text, name)} disabled={!text.trim()}>
            Check file
          </button>
          <button type="button" className={`${w.btn} ${w.btnGhost}`} onClick={() => fileRef.current?.click()}>
            Upload a file
          </button>
          <input ref={fileRef} type="file" accept=".sif,.txt,.csv" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <p className={s.panelHint} style={{ margin: "14px 0 0" }}>
          No file handy? Try{" "}
          <button type="button" className={s.linkBtn} onClick={() => run(GOOD)}>a valid example</button> or{" "}
          <button type="button" className={s.linkBtn} onClick={() => run(BAD)}>an example with mistakes</button>.
        </p>
        <p className={s.privacy}>Checked in your browser. The file is not uploaded, stored or sent anywhere.</p>
      </div>

      {report && sum && (
        <div className={`${s.panel} ${s.result}`} aria-live="polite">
          <h2 className={s.panelTitle}>Result</h2>
          <p className={`${s.banner} ${report.errors ? s.bannerBad : report.warnings ? s.bannerWarn : s.bannerOk}`}>
            {report.errors
              ? `${report.errors} problem${report.errors === 1 ? "" : "s"} likely to get this file rejected${report.warnings ? `, plus ${report.warnings} to review` : ""}`
              : report.warnings
                ? `No errors found, but ${report.warnings} thing${report.warnings === 1 ? "" : "s"} to review`
                : "No errors found"}
          </p>
          <div className={s.stats}>
            <div className={s.stat}><span>Employee records</span><strong>{sum.employeeRecords}</strong></div>
            <div className={s.stat}><span>Control record says</span><strong>{sum.declaredCount ?? "—"} · AED {money(sum.declaredTotal)}</strong></div>
            <div className={s.stat}><span>Lines add up to</span><strong>AED {money(sum.computedTotal)}</strong></div>
            <div className={s.stat}><span>Establishment · month</span><strong>{sum.establishmentId ?? "—"} · {sum.month ?? "—"}</strong></div>
          </div>
          {report.issues.length > 0 && (
            <ul className={s.issues}>
              {report.issues.map((i, k) => (
                <li key={k} className={`${s.issue} ${i.severity === "error" ? s.issueError : i.severity === "warning" ? s.issueWarning : s.issueInfo}`}>
                  <span className={s.issueMeta}>{i.severity}{i.line ? ` · line ${i.line}` : ""}</span>
                  {i.message}
                  {i.fix && <span className={s.issueFix}>{i.fix}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className={s.note}>
            This checks the structure of the file, the kind of mistakes that commonly get one rejected. Your bank applies its own rules too, so a clean result is not a guarantee.
          </p>
        </div>
      )}
    </div>
  );
}
