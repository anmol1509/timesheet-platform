"use client";

import { useMemo, useState } from "react";
import { validateIban } from "@/lib/iban";
import s from "../calculator.module.css";
import { Field } from "../calc-ui";

const EXAMPLE = "AE07 0331 2345 6789 0123 456";

/** Runs entirely in the browser; nothing typed or pasted is sent anywhere. */
export function IbanValidator() {
  const [one, setOne] = useState(EXAMPLE);
  const [list, setList] = useState("");

  const single = useMemo(() => validateIban(one), [one]);
  const rows = useMemo(
    () => list.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => validateIban(l)),
    [list],
  );
  const good = rows.filter((r) => r.valid).length;

  return (
    <div className={s.stack}>
      <div className={s.layout}>
        <div className={s.panel}>
          <h2 className={s.panelTitle}>Check one IBAN</h2>
          <p className={s.panelHint}>An example is filled in. Spaces and dashes are fine.</p>
          <Field id="iban" label="IBAN">
            <input
              id="iban"
              className={s.input}
              value={one}
              onChange={(e) => setOne(e.target.value)}
              placeholder="AE07 0331 2345 6789 0123 456"
              autoComplete="off"
              spellCheck={false}
              style={{ fontFamily: "var(--font-geist-mono, ui-monospace, monospace)" }}
            />
          </Field>
          <p className={s.privacy}>Checked in your browser. Nothing is uploaded or stored.</p>
        </div>

        <div className={`${s.panel} ${s.result}`} aria-live="polite">
          <h2 className={s.panelTitle}>Result</h2>
          {!single.normalized ? (
            <p className={s.warn}>Enter an IBAN to check it.</p>
          ) : single.valid ? (
            <>
              <p className={`${s.banner} ${single.isUae ? s.bannerOk : s.bannerWarn}`}>
                {single.isUae ? "Valid UAE IBAN" : `Valid IBAN, but for ${single.country}, not the UAE`}
              </p>
              <p className={`${s.mono}`} style={{ fontSize: 18, margin: "0 0 8px" }}>{single.formatted}</p>
              <ul className={s.rows}>
                <li className={s.row}><span>Length</span><strong>{single.normalized.length} characters</strong></li>
                <li className={s.row}><span>Country</span><strong>{single.country}</strong></li>
                <li className={s.row}><span>Check digits</span><strong>{single.normalized.slice(2, 4)} (correct)</strong></li>
                {single.isUae && (
                  <>
                    <li className={s.row}><span>Bank code</span><strong>{single.bankCode}</strong></li>
                    <li className={s.row}><span>Account number</span><strong className={s.mono}>{single.accountNumber}</strong></li>
                  </>
                )}
              </ul>
              {!single.isUae && <p className={s.note}>WPS salary files need the employee&rsquo;s UAE account, so a non-UAE IBAN usually needs correcting.</p>}
            </>
          ) : (
            <>
              <p className={`${s.banner} ${s.bannerBad}`}>Not a valid IBAN</p>
              <ul className={s.issues}>
                {single.problems.map((p) => (
                  <li key={p} className={`${s.issue} ${s.issueError}`}>{p}</li>
                ))}
              </ul>
            </>
          )}
          <p className={s.note}>A valid IBAN has the right structure. It can&rsquo;t confirm the account exists or belongs to the person named.</p>
        </div>
      </div>

      <div className={s.panel}>
        <h2 className={s.panelTitle}>Check a list</h2>
        <p className={s.panelHint}>Paste one IBAN per line, for example a column from your payroll sheet.</p>
        <textarea
          className={s.textarea}
          style={{ minHeight: 140 }}
          value={list}
          onChange={(e) => setList(e.target.value)}
          placeholder={"AE070331234567890123456\nAE070331234567890123457\n…"}
          spellCheck={false}
          aria-label="List of IBANs, one per line"
        />
        {rows.length > 0 && (
          <>
            <p className={`${s.banner} ${good === rows.length ? s.bannerOk : s.bannerBad}`} style={{ marginTop: 14 }}>
              {good} of {rows.length} valid{good === rows.length ? "" : `, ${rows.length - good} to fix`}
            </p>
            <div className={s.tableWrap}>
              <table className={s.listTable}>
                <thead>
                  <tr><th>#</th><th>IBAN</th><th>Result</th><th>Problem</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td className={s.mono}>{r.formatted || r.input}</td>
                      <td><span className={r.valid ? s.pillOk : s.pillBad}>{r.valid ? "Valid" : "Invalid"}</span></td>
                      <td>{r.valid ? (r.isUae ? "" : `Not a UAE IBAN (${r.country})`) : r.problems[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
