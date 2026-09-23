import Link from "next/link";
import { prisma } from "@/lib/db";
import { getEssEmployee } from "@/lib/ess/session";
import { Badge } from "@/components/Badge";

export const metadata = { title: "My payslips" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function PayslipsPage() {
  const employee = (await getEssEmployee())!;
  const lines = await prisma.payrollLine.findMany({
    where: { employeeId: employee.id, run: { status: { in: ["APPROVED", "PAID"] } } },
    orderBy: { run: { month: "desc" } },
    take: 36,
    include: { run: { select: { month: true, status: true } } },
  });
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-primary">Payslips</h1>
      {lines.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">No payslips yet. They appear here once your office approves a payroll month.</div>
      ) : (
        <ul className="card divide-y divide-[var(--border)]">
          {lines.map((l) => (
            <li key={l.id}>
              <Link href={`/me/payslips/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-hover">
                <div>
                  <p className="text-sm font-medium text-primary">{l.run.month}</p>
                  <Badge color={l.run.status === "PAID" ? "green" : "blue"} dot>{l.run.status === "PAID" ? "Paid" : "Approved"}</Badge>
                </div>
                <p className="text-base font-semibold tabular-nums text-primary">AED {aed(Number(l.net))}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
