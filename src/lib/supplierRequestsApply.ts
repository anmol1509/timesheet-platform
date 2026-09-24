import { prisma } from "@/lib/db";
import { initialsOf, isValidIban, nextEmployeeId, sanitizePayload, type ChangeKind } from "@/lib/supplierRequests";

export type ApplyResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Turns a pending worker submission into a real Employee, with an ID that
 * continues the supplier's series. Everything is re-checked here, at decision
 * time: someone may have registered the same person since it was submitted.
 */
export async function approveWorkerSubmission(submissionId: string, decidedById: string): Promise<ApplyResult<{ employeeId: string; employeeIdNo: string; name: string; supplier: string; branchId: string }>> {
  const sub = await prisma.workerSubmission.findUnique({ where: { id: submissionId }, include: { supplier: { select: { name: true } } } });
  if (!sub) return { ok: false, error: "Submission not found." };
  if (sub.status !== "PENDING") return { ok: false, error: `Already ${sub.status.toLowerCase()}.` };

  const clash = await prisma.employee.count({ where: { OR: [{ passportNumber: { equals: sub.passportNumber, mode: "insensitive" } }, { emiratesId: sub.emiratesId }] } });
  if (clash > 0) return { ok: false, error: "An employee with this passport or Emirates ID already exists. Reject this submission, or check the employee list." };

  const prefix = initialsOf(sub.supplier.name);
  if (!prefix) return { ok: false, error: "Can't build an employee ID prefix from the supplier's name." };
  const taken = await prisma.employee.findMany({ where: { employeeIdNo: { startsWith: prefix } }, select: { employeeIdNo: true } });
  const employeeIdNo = nextEmployeeId(prefix, taken.map((t) => t.employeeIdNo));
  const name = [sub.firstName, sub.middleName, sub.lastName].filter(Boolean).join(" ");

  const employee = await prisma.$transaction(async (tx) => {
    const e = await tx.employee.create({
      data: {
        employeeIdNo, name, branchId: sub.branchId, supplierId: sub.supplierId, status: "IDLE",
        nationality: sub.nationality, gender: sub.gender, mobileNumber: sub.mobileNumber, dateOfBirth: sub.dateOfBirth, joinDate: sub.joinDate,
        trade: sub.trade, position: sub.trade, bloodGroup: sub.bloodGroup, passportNumber: sub.passportNumber, emiratesId: sub.emiratesId,
        passportExpiry: sub.passportExpiry, emiratesIdExpiry: sub.emiratesIdExpiry, visaExpiry: sub.visaExpiry, laborCardExpiry: sub.laborCardExpiry, medicalExpiry: sub.medicalExpiry,
      },
    });
    // The status guard makes a double-click or a second approver a no-op instead of a second employee.
    const claimed = await tx.workerSubmission.updateMany({ where: { id: sub.id, status: "PENDING" }, data: { status: "APPROVED", decidedAt: new Date(), decidedById, employeeId: e.id } });
    if (claimed.count !== 1) throw new Error("ALREADY_DECIDED");
    return e;
  }).catch((e: Error) => (e.message === "ALREADY_DECIDED" ? null : Promise.reject(e)));
  if (!employee) return { ok: false, error: "Someone else has just decided this one." };
  return { ok: true, employeeId: employee.id, employeeIdNo, name, supplier: sub.supplier.name, branchId: sub.branchId };
}

/** Applies an approved change request to the supplier, writing only whitelisted fields. */
export async function applyChangeRequest(requestId: string, decidedById: string): Promise<ApplyResult<{ supplierId: string; branchId: string; kind: ChangeKind; before: Record<string, string | null>; after: Record<string, string> }>> {
  const req = await prisma.supplierChangeRequest.findUnique({ where: { id: requestId }, include: { supplier: true } });
  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== "PENDING") return { ok: false, error: `Already ${req.status.toLowerCase()}.` };
  const kind = req.kind as ChangeKind;
  const changes = sanitizePayload(kind, req.payload);
  if (Object.keys(changes).length === 0) return { ok: false, error: "This request has nothing valid to apply." };
  if (changes.iban && !isValidIban(changes.iban)) return { ok: false, error: "The requested IBAN fails the format check. Reject it and ask the supplier to resend." };

  const before: Record<string, string | null> = {};
  for (const k of Object.keys(changes)) before[k] = (req.supplier as unknown as Record<string, string | null>)[k] ?? null;
  const claimed = await prisma.$transaction(async (tx) => {
    const c = await tx.supplierChangeRequest.updateMany({ where: { id: req.id, status: "PENDING" }, data: { status: "APPROVED", decidedAt: new Date(), decidedById } });
    if (c.count !== 1) return false;
    await tx.supplier.update({ where: { id: req.supplierId }, data: changes });
    return true;
  });
  if (!claimed) return { ok: false, error: "Someone else has just decided this one." };
  return { ok: true, supplierId: req.supplierId, branchId: req.branchId, kind, before, after: changes };
}
