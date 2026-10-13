import { isPayType, payDataGap, wpsGaps, type CompanyPayType } from "@/lib/payroll";

export type ReadinessFacts = {
  company: { name: string; isOwnCompany: boolean; payType: string | null } | null;
  payStructure: string | null; basicSalary: number; flatMonthlyRate: number; hourlyRate: number;
  paymentMode: string | null; molPersonCode: string | null; routingCode: string | null; account: string | null;
  laborCardExpiry: Date | null; emiratesIdExpiry: Date | null; visaExpiry: Date | null;
};

export type ReadinessItem = { key: string; label: string; ok: boolean; problem?: string; fix?: string; blocking: boolean };
export type Readiness = { applies: boolean; ready: boolean; items: ReadinessItem[]; note?: string };

/**
 * Whether a worker can be paid in a payroll run, in the order payroll people fix things. "Blocking" items stop a run
 * being approved; the document checks only warn. Pure, so the same answer can drive the page and the tests.
 */
export function payrollReadiness(f: ReadinessFacts, now = new Date()): Readiness {
  if (!f.company) return { applies: false, ready: false, items: [], note: "Not under any company yet. Pick a company on the Trade & pay tab for them to appear in payroll." };
  if (!f.company.isOwnCompany) return { applies: false, ready: false, items: [], note: `Paid by ${f.company.name}, which is not one of your own companies, so they don't appear in your payroll.` };

  const type: CompanyPayType | null = isPayType(f.company.payType) ? f.company.payType : null;
  const payGap = payDataGap(type, { payStructure: f.payStructure, basicSalary: f.basicSalary, flatMonthlyRate: f.flatMonthlyRate, hourlyRate: f.hourlyRate });
  const bankGaps = wpsGaps({ paymentMode: f.paymentMode, personCode: f.molPersonCode, routingCode: f.routingCode, account: f.account });
  const expired = (d: Date | null) => !!d && d.getTime() < now.getTime();

  const items: ReadinessItem[] = [
    { key: "pay", label: "Pay set up", ok: payGap === null, problem: payGap ?? undefined, fix: "Trade & pay tab", blocking: true },
    { key: "bank", label: "Bank and WPS details", ok: bankGaps.length === 0, problem: bankGaps.length ? `missing ${bankGaps.join(", ")}` : undefined, fix: "Payroll & WPS tab (or set the payment mode to Cash)", blocking: true },
    { key: "labour", label: "Labour card valid", ok: !expired(f.laborCardExpiry), problem: "labour card has expired", fix: "Documents: renew and update the expiry date", blocking: false },
    { key: "eid", label: "Emirates ID valid", ok: !expired(f.emiratesIdExpiry), problem: "Emirates ID has expired", fix: "Documents: renew and update the expiry date", blocking: false },
    { key: "visa", label: "Visa valid", ok: !expired(f.visaExpiry), problem: "visa has expired", fix: "Documents: renew and update the expiry date", blocking: false },
  ];
  return { applies: true, ready: items.every((i) => i.ok || !i.blocking), items };
}
