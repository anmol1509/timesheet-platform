import { validateIban } from "@/lib/iban";

/**
 * Pre-flight checks on a UAE WPS salary file (SIF), for the public checker. Pure and
 * browser-safe, so a file never has to leave the visitor's machine.
 *
 * Format checked (the same one lib/wps.ts writes):
 *   EDR,<person code>,<routing code>,<account/IBAN>,<start>,<end>,<days>,<fixed>,<variable>,<leave days>
 *   SCR,<establishment id>,<payer routing code>,<date>,<HHMM>,<MMYYYY>,<count>,<total>,AED,<payer IBAN>
 *
 * These are structural checks of the kind that commonly get a file bounced. They cannot know
 * your bank's own rules or whether an account exists, so a clean result is not a guarantee of
 * acceptance. Severity: "error" is something that will very likely be rejected; "warning" is
 * unusual and worth a look; "info" is context.
 */
export type Severity = "error" | "warning" | "info";

export type SifIssue = {
  severity: Severity;
  /** Stable id, used by tests and for grouping. */
  code: string;
  /** 1-based line number in the file, or null for file-level issues. */
  line: number | null;
  message: string;
  fix?: string;
};

export type SifSummary = {
  employeeRecords: number;
  hasControlRecord: boolean;
  establishmentId: string | null;
  month: string | null; // MMYYYY as written
  declaredCount: number | null;
  declaredTotal: number | null;
  computedTotal: number;
};

export type SifReport = { issues: SifIssue[]; summary: SifSummary; errors: number; warnings: number; ok: boolean };

const cents = (n: number) => Math.round(n * 100);

function realDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
}

function parseAmount(s: string): number | null {
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export function checkSif(text: string, filename?: string): SifReport {
  const issues: SifIssue[] = [];
  const add = (severity: Severity, code: string, line: number | null, message: string, fix?: string) =>
    issues.push({ severity, code, line, message, fix });

  const rawLines = text.replace(/^﻿/, "").split(/\r\n|\n|\r/);
  const lines = rawLines.map((raw, i) => ({ raw, n: i + 1 })).filter((l) => l.raw.trim() !== "");

  const summary: SifSummary = {
    employeeRecords: 0, hasControlRecord: false, establishmentId: null, month: null,
    declaredCount: null, declaredTotal: null, computedTotal: 0,
  };

  if (lines.length === 0) {
    add("error", "empty", null, "The file is empty.", "Paste or upload the SIF file.");
    return finish(issues, summary);
  }

  const edr: { n: number; f: string[] }[] = [];
  const scr: { n: number; f: string[] }[] = [];

  for (const { raw, n } of lines) {
    const f = raw.split(",");
    const type = f[0].trim();
    if (type !== "EDR" && type !== "SCR") {
      add("error", "unknown-record", n, `The line starts with "${f[0].slice(0, 12)}", not EDR (employee) or SCR (control).`, "Every line must be an EDR employee record or the single SCR control record.");
      continue;
    }
    // Spaces around a value are invisible but break the match against the bank's and MOHRE's records.
    const padded = f.map((v, i) => ({ v, i })).filter(({ v }) => v !== v.trim());
    if (padded.length) {
      add("error", "whitespace", n, `Extra spaces around ${padded.length > 1 ? "values" : "a value"} in field${padded.length > 1 ? "s" : ""} ${padded.map((p) => p.i + 1).join(", ")}.`, "Remove leading and trailing spaces from every field.");
    }
    (type === "EDR" ? edr : scr).push({ n, f: f.map((v) => v.trim()) });
  }

  summary.employeeRecords = edr.length;

  // --- control record -------------------------------------------------------------------
  if (scr.length === 0) {
    add("error", "no-scr", null, "There is no SCR control record.", "A SIF file ends with one SCR line carrying the record count and total.");
  } else if (scr.length > 1) {
    add("error", "many-scr", scr[1].n, `There are ${scr.length} SCR control records; there must be exactly one.`, "Remove the extra SCR lines.");
  }
  summary.hasControlRecord = scr.length > 0;

  // --- employee records -----------------------------------------------------------------
  const seen = new Map<string, number>();
  let computed = 0;

  for (const { n, f } of edr) {
    if (f.length !== 10) {
      add("error", "edr-fields", n, `An EDR record needs 10 fields; this one has ${f.length}.`, "Check for a missing or extra comma.");
      continue;
    }
    const [, person, routing, account, start, end, days, fixed, variable, leave] = f;

    if (!/^\d+$/.test(person)) add("error", "person-code", n, `Employee ID "${person}" should be digits only.`, "Copy the ID exactly as it appears on the labour card, with no spaces or letters.");
    else if (person.length !== 14) add("warning", "person-length", n, `Employee ID "${person}" has ${person.length} digits; MOHRE person codes are usually 14.`, "Check for a missing or extra leading zero.");
    if (seen.has(person)) add("error", "duplicate", n, `Employee ID ${person} already appears on line ${seen.get(person)}.`, "Each employee should appear once per file.");
    else seen.set(person, n);

    if (!/^\d{9}$/.test(routing)) add("error", "routing", n, `Routing code "${routing}" should be 9 digits.`, "Use the receiving bank's or exchange house's 9-digit routing code.");

    if (/^AE/i.test(account)) {
      const r = validateIban(account);
      if (!r.valid) add("error", "iban", n, `Account "${account}" is not a valid IBAN: ${r.problems[0]}`, "Correct the IBAN on the employee record.");
    } else if (account === "") {
      add("error", "account", n, "The account field is empty.", "Add the employee's IBAN or account number.");
    } else {
      add("warning", "account-format", n, `Account "${account}" is not a UAE IBAN.`, "Fine for exchange-house or payment-card accounts; otherwise check it.");
    }

    const d1 = realDate(start), d2 = realDate(end);
    if (!d1) add("error", "start-date", n, `Pay period start "${start}" is not a valid YYYY-MM-DD date.`, "Write dates as 2026-09-01.");
    if (!d2) add("error", "end-date", n, `Pay period end "${end}" is not a valid YYYY-MM-DD date.`, "Write dates as 2026-09-30.");
    if (d1 && d2) {
      if (d2 < d1) add("error", "period-order", n, "The pay period ends before it starts.", "Swap or correct the dates.");
      else if (/^\d+$/.test(days) && Number(days) > (d2.getTime() - d1.getTime()) / 86400000 + 1) {
        add("warning", "days-exceed", n, `${days} days paid, but the period is only ${(d2.getTime() - d1.getTime()) / 86400000 + 1} days long.`, "Check the days paid.");
      }
    }
    if (!/^\d+$/.test(days)) add("error", "days", n, `Days paid "${days}" should be a whole number.`, "Use a whole number of days.");
    else if (Number(days) > 31) add("error", "days-range", n, `Days paid is ${days}; a month has at most 31.`, "Correct the days paid.");

    const fx = parseAmount(fixed), vr = parseAmount(variable);
    for (const [label, raw, val] of [["Fixed salary", fixed, fx], ["Variable pay", variable, vr]] as const) {
      if (val === null) add("error", "amount", n, `${label} "${raw}" is not a number.`, "Use digits with a decimal point, no currency symbols or thousands separators.");
      else if (val < 0) add("error", "negative", n, `${label} is negative (${raw}).`, "Salary amounts cannot be negative.");
      else if (!/^\d+\.\d{2}$/.test(raw)) add("warning", "decimals", n, `${label} "${raw}" is not written with exactly two decimals.`, "Write amounts like 1990.00.");
    }
    if (fx !== null && vr !== null) computed += fx + vr;

    if (!/^\d+$/.test(leave)) add("error", "leave", n, `Leave days "${leave}" should be a whole number.`, "Use 0 if there was no leave.");
  }
  summary.computedTotal = cents(computed) / 100;

  // --- control record checks ------------------------------------------------------------
  const control = scr[0];
  if (control) {
    const { n, f } = control;
    if (f.length !== 10) {
      add("error", "scr-fields", n, `The SCR record needs 10 fields; this one has ${f.length}.`, "Check for a missing or extra comma.");
    } else {
      const [, estId, payerRouting, date, hhmm, monthYear, count, total, currency, payerIban] = f;
      summary.establishmentId = estId || null;
      summary.month = monthYear || null;

      if (!/^\d+$/.test(estId)) add("error", "est-id", n, `Establishment ID "${estId}" should be digits only.`, "Use the establishment ID from your MOHRE registration.");
      if (!/^\d{9}$/.test(payerRouting)) add("error", "payer-routing", n, `Payer routing code "${payerRouting}" should be 9 digits.`, "Use your bank's 9-digit routing code.");
      if (!realDate(date)) add("error", "scr-date", n, `File date "${date}" is not a valid YYYY-MM-DD date.`, "Write the date as 2026-10-01.");
      if (!/^([01]\d|2[0-3])[0-5]\d$/.test(hhmm)) add("error", "scr-time", n, `File time "${hhmm}" should be HHMM, for example 0805.`, "Use a 24-hour time with four digits.");

      const mm = /^(\d{2})(\d{4})$/.exec(monthYear);
      if (!mm || +mm[1] < 1 || +mm[1] > 12) {
        add("error", "scr-month", n, `Salary month "${monthYear}" should be MMYYYY, for example 092026.`, "Month first, then year.");
      } else {
        const off = edr.filter(({ f: e }) => e.length === 10 && realDate(e[4]) && `${e[4].slice(5, 7)}${e[4].slice(0, 4)}` !== monthYear);
        if (off.length) add("warning", "month-mismatch", off[0].n, `${off.length} employee record${off.length > 1 ? "s" : ""} start in a different month from the control record (${monthYear}).`, "Check the salary month on the SCR line and the pay periods.");
      }

      if (!/^\d+$/.test(count)) add("error", "scr-count", n, `Record count "${count}" should be a whole number.`);
      else {
        summary.declaredCount = Number(count);
        if (Number(count) !== edr.length) add("error", "count-mismatch", n, `The control record says ${count} employees but the file has ${edr.length}.`, "Update the count to match the number of EDR lines.");
      }

      const tot = parseAmount(total);
      if (tot === null) add("error", "scr-total", n, `Total "${total}" is not a number.`);
      else {
        summary.declaredTotal = tot;
        const diff = cents(tot) - cents(computed);
        if (diff !== 0) add("error", "total-mismatch", n, `The control total is ${total}, but the employee lines add up to ${(cents(computed) / 100).toFixed(2)} (a difference of ${(Math.abs(diff) / 100).toFixed(2)}).`, "Even a single fils of difference rejects the whole file. Recalculate the total from the lines.");
      }

      if (currency !== "AED") add("error", "currency", n, `Currency is "${currency}"; it must be AED.`);
      const ib = validateIban(payerIban);
      if (!ib.valid) add("error", "payer-iban", n, `Payer IBAN "${payerIban}" is not valid: ${ib.problems[0]}`, "Correct the establishment's IBAN.");

      if (control.n !== lines[lines.length - 1].n) add("warning", "scr-position", n, "The control record is not the last line.", "Banks normally expect the SCR record at the end of the file.");
    }
  }

  // --- file name (uploads only) ---------------------------------------------------------
  if (filename) {
    if (!/\.sif$/i.test(filename)) add("warning", "extension", null, `The file name "${filename}" does not end in .SIF.`, "Banks usually require the .SIF extension.");
    else if (summary.establishmentId && !filename.startsWith(summary.establishmentId)) {
      add("warning", "filename", null, `Banks usually name the file with the establishment ID first (${summary.establishmentId}…); this one is "${filename}".`, "Check your bank's file naming rule.");
    }
  }

  if (edr.length === 0 && scr.length > 0) add("warning", "no-employees", null, "The file has a control record but no employee records.");
  return finish(issues, summary);
}

function finish(issues: SifIssue[], summary: SifSummary): SifReport {
  const order = { error: 0, warning: 1, info: 2 } as const;
  issues.sort((a, b) => order[a.severity] - order[b.severity] || (a.line ?? 0) - (b.line ?? 0));
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  return { issues, summary, errors, warnings, ok: errors === 0 };
}
