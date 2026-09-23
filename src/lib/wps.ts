import { round2 } from "@/lib/payroll";

/**
 * UAE Wage Protection System "SIF" (Salary Information File) builder.
 *
 * One SCR (control) record plus one EDR (employee) record per paid worker:
 *   EDR,<person code>,<routing code>,<account>,<start>,<end>,<days>,<fixed>,<variable>,<leave days>
 *   SCR,<establishment id>,<payer routing code>,<date>,<HHMM>,<MMYYYY>,<count>,<total>,AED,<payer IBAN>
 * Fixed + variable per worker always equals their net pay, so the SCR total
 * ties to the payroll run exactly.
 *
 * NOTE: banks and exchange houses differ slightly in what they accept (file
 * naming, optional trailing fields). Upload a first file to your bank's WPS
 * portal in test/validation mode before relying on it.
 */
export type SifLine = {
  personCode: string;
  routingCode: string;
  account: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  days: number;
  net: number;
  overtimePay: number;
  adjustment: number;
  leaveDays: number;
};

const money = (n: number) => round2(n).toFixed(2);

/** Splits net into fixed + variable so that fixed + variable === net. */
export function splitPay(l: Pick<SifLine, "net" | "overtimePay" | "adjustment">) {
  const variable = Math.max(0, round2(l.overtimePay + Math.max(0, l.adjustment)));
  const fixed = round2(l.net - variable);
  return { fixed, variable };
}

export function buildSif(input: {
  establishmentId: string;
  payerRoutingCode: string;
  payerIban: string;
  month: string; // YYYY-MM
  lines: SifLine[];
  now?: Date;
}): { filename: string; content: string; total: number; count: number } {
  const now = input.now ?? new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  const hhmm = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;
  const [y, mo] = input.month.split("-");

  const edr = input.lines.map((l) => {
    const { fixed, variable } = splitPay(l);
    return ["EDR", l.personCode, l.routingCode, l.account, l.periodStart, l.periodEnd, l.days, money(fixed), money(variable), l.leaveDays].join(",");
  });
  const total = round2(input.lines.reduce((s, l) => s + l.net, 0));
  const scr = ["SCR", input.establishmentId, input.payerRoutingCode, date, hhmm, `${mo}${y}`, input.lines.length, money(total), "AED", input.payerIban].join(",");

  const yymmdd = `${String(now.getUTCFullYear()).slice(2)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
  return {
    filename: `${input.establishmentId}${yymmdd}${hhmm}.SIF`,
    content: [...edr, scr].join("\r\n") + "\r\n",
    total,
    count: input.lines.length,
  };
}
