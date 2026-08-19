import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { Badge } from "@/components/Badge";
import { getIdleWorkers } from "@/lib/demandSupply";
import { TRADES } from "@/lib/trades";
import { MobilisationBoard } from "./mobilisation-board";

export default async function MobilisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const request = await prisma.demandRequest.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      trades: {
        include: { allocations: { include: { employee: true } } },
        orderBy: { trade: "asc" },
      },
    },
  });
  if (!request || isOutsideBranch(request.branchId, branchId, isSuperAdmin)) notFound();

  const idleWorkers = await getIdleWorkers(branchId);

  // Same closed list the demand form offers, so a re-designation can't invent
  // a trade the rest of the module doesn't know about.
  const tradeOptions = [...TRADES];

  const totalNeeded = request.trades.reduce((sum, t) => sum + t.quantity, 0);
  const totalAssigned = request.trades.reduce((sum, t) => sum + t.allocations.length, 0);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/demand" className="text-sm text-muted hover:underline">
          ← Demands
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-primary">
              Mobilise Request #{request.requestNo}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {request.client.name} — {request.project.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={totalAssigned >= totalNeeded ? "green" : "amber"}>
              {totalAssigned} / {totalNeeded} mobilised
            </Badge>
            <Link href={`/demand/${request.id}/documents`} className="btn btn-secondary">
              Generate documents
            </Link>
          </div>
        </div>
      </div>

      {request.trades.every((t) => !t.approved) && (
        // Approval is per trade line, so this is only shown when *nothing* is
        // approved; a partly-approved demand is mobilised line by line.
        <p className="rounded-control border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
          No trade on this demand is approved yet — approve the lines you want to
          fill on the{" "}
          <Link href={`/demand/${request.id}`} className="font-medium underline">
            demand page
          </Link>
          .
        </p>
      )}

      <MobilisationBoard
        lines={request.trades.map((t) => ({
          id: t.id,
          trade: t.trade,
          approved: t.approved,
          quantity: t.quantity,
          shift: t.shift,
          assigned: t.allocations.map((a) => ({
            id: a.id,
            employeeId: a.employeeId,
            name: a.employee.name,
            employeeIdNo: a.employee.employeeIdNo,
          })),
        }))}
        workers={idleWorkers.map((w) => ({
          id: w.id,
          name: w.name,
          employeeIdNo: w.employeeIdNo,
          trade: w.trade,
          skillNames: w.skillNames,
        }))}
        tradeOptions={tradeOptions}
      />
    </div>
  );
}
