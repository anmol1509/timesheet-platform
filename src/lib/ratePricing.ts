import { round2 } from "@/lib/payroll";

/**
 * Hourly rate for supplying manpower, built from monthly cost per worker. Same
 * method as the blog post "How to price manpower supply in the UAE":
 * direct cost + overhead (a % of direct cost) = total cost; margin is a % of
 * total cost; the monthly price is spread over the hours that will actually be
 * billed, not the hours that are paid.
 */
export type RateInput = {
  salaryAndAllowances: number;
  visaAndPermits: number;
  accommodation: number;
  transport: number;
  foodAndConsumables: number;
  gratuityProvision: number;
  leaveAndTicketProvision: number;
  /** % of direct cost. */
  overheadPct: number;
  /** % of total cost. */
  marginPct: number;
  /** Hours the worker is paid for in a month, e.g. 26 days x 8 = 208. */
  paidHours: number;
  /** % of paid hours that are never billed (absence, unpaid holidays, waiting time). */
  unbilledPct: number;
};

export function hourlyRate(i: RateInput) {
  const nz = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  const direct = round2(
    nz(i.salaryAndAllowances) + nz(i.visaAndPermits) + nz(i.accommodation) + nz(i.transport) +
      nz(i.foodAndConsumables) + nz(i.gratuityProvision) + nz(i.leaveAndTicketProvision),
  );
  const overhead = round2(direct * (nz(i.overheadPct) / 100));
  const totalCost = round2(direct + overhead);
  const margin = round2(totalCost * (nz(i.marginPct) / 100));
  const monthlyPrice = round2(totalCost + margin);
  const paidHours = nz(i.paidHours);
  const billableHours = paidHours * (1 - Math.min(nz(i.unbilledPct), 99) / 100);
  const ok = billableHours > 0 && monthlyPrice > 0;
  return {
    direct,
    overhead,
    totalCost,
    margin,
    monthlyPrice,
    billableHours: round2(billableHours),
    /** Rate if every paid hour were billed, to show what unbilled hours cost. */
    rateOnPaidHours: ok && paidHours > 0 ? round2(monthlyPrice / paidHours) : 0,
    rate: ok ? round2(monthlyPrice / billableHours) : 0,
  };
}
