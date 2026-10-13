"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";
import { refsBelongToBranch } from "@/lib/refScope";
import { initialsOf, nextEmployeeId } from "@/lib/supplierRequests";
import { checkEmployee } from "@/lib/dataChecks";
import { employeeDuplicates } from "@/lib/duplicateCheck";
import { employeeDocType, missingEssentials, payFieldsFor, type PayChoice } from "@/lib/onboardingEmployee";

export type AddEmployeeState = { error: string | null; warnings?: string[]; employeeId?: string; copiedFiles?: number };

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const date = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};
const money = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
};

/**
 * Turns an onboarding candidate into an employee from the review screen: the details typed there (prefilled from the candidate)
 * create the worker, the candidate is marked as joined and linked to them, and the candidate's files are copied to the worker's
 * documents. Likely mistakes are shown for a second look and never block.
 */
export async function addCandidateAsEmployeeAction(_prev: AddEmployeeState, formData: FormData): Promise<AddEmployeeState> {
  await requireWrite("onboarding.tracker");
  try { assertContactsValid(formData); } catch (e) { return { error: e instanceof Error ? e.message : "That phone number doesn't look right." }; }
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("id") || "");

  const candidate = await prisma.candidateOnboarding.findUnique({ where: { id } });
  if (!candidate || isOutsideBranch(candidate.branchId, branchId, isSuperAdmin)) return { error: "You can't add that candidate." };
  if (candidate.joined) return { error: "This candidate has already been added as an employee." };
  if (!candidate.readyToJoin && formData.get("earlyConfirm") !== "1") {
    return { error: "This candidate's steps aren't complete yet. Tick the box to confirm you are adding them early." };
  }

  const name = text(formData.get("name"));
  const supplierId = text(formData.get("supplierId"));
  const sponsorSupplierId = text(formData.get("sponsorSupplierId"));
  const projectId = text(formData.get("projectId"));
  const passportNumber = text(formData.get("passportNumber"));
  const missing = missingEssentials({ name, passportNumber, supplierId });
  if (missing.length > 0) return { error: `Add the ${missing.join(", ")} first. Everything else can be filled in later.` };
  if (!(await refsBelongToBranch(candidate.branchId, { supplier: [supplierId, sponsorSupplierId], project: projectId }))) {
    return { error: "That company, sponsor or project isn't in this branch." };
  }

  // Pay is only taken from people allowed to set it; anyone else leaves it for payroll.
  let payFields: Record<string, unknown> = {};
  if (can(subjectOf(user), "payroll", "edit")) {
    const choice = (text(formData.get("payChoice")) ?? "LATER") as PayChoice;
    const pay = payFieldsFor({ choice, flat: money(formData.get("flat")), basic: money(formData.get("basic")), housing: money(formData.get("housing")), food: money(formData.get("food")), transport: money(formData.get("transport")), other: money(formData.get("other")), hourly: money(formData.get("hourly")) });
    if ("error" in pay) return { error: pay.error };
    payFields = pay.fields;
  }

  const facts = {
    emiratesId: text(formData.get("emiratesId")), passportNumber, mobileNumber: text(formData.get("mobileNumber")),
    dateOfBirth: date(formData.get("dateOfBirth")), joinDate: date(formData.get("joinDate")) ?? new Date(),
    passportExpiry: date(formData.get("passportExpiry")), emiratesIdExpiry: date(formData.get("emiratesIdExpiry")),
    laborCardExpiry: date(formData.get("laborCardExpiry")), visaExpiry: date(formData.get("visaExpiry")), medicalExpiry: date(formData.get("medicalExpiry")),
  };

  // Likely mistakes: a wrong ID number, an impossible date, someone already on file with the same numbers.
  if (formData.get("confirmWarnings") !== "1") {
    const [dups, otherCandidate] = await Promise.all([
      employeeDuplicates({ emiratesId: facts.emiratesId, passportNumber, mobileNumber: facts.mobileNumber }),
      passportNumber ? prisma.candidateOnboarding.findFirst({ where: { branchId: candidate.branchId, id: { not: id }, passportNumber: { equals: passportNumber, mode: "insensitive" } }, select: { candidateName: true } }) : null,
    ]);
    const warnings = [
      ...checkEmployee({ ...facts, basicSalary: null }, null),
      ...dups,
      ...(otherCandidate ? [`Another candidate on the board, ${otherCandidate.candidateName}, has this passport number.`] : []),
    ];
    if (warnings.length > 0) return { error: null, warnings };
  }

  // The employee ID is generated from the company's initials unless one was typed.
  const company = await prisma.supplier.findUnique({ where: { id: supplierId! }, select: { name: true } });
  let employeeIdNo = text(formData.get("employeeIdNo"));
  if (employeeIdNo) {
    if (await prisma.employee.findUnique({ where: { employeeIdNo }, select: { id: true } })) return { error: `The employee ID ${employeeIdNo} is already taken.` };
  } else {
    const prefix = initialsOf(company?.name ?? "");
    if (!prefix) return { error: "Can't build an employee ID from that company's name. Type an employee ID instead." };
    const taken = await prisma.employee.findMany({ where: { employeeIdNo: { startsWith: prefix } }, select: { employeeIdNo: true } });
    employeeIdNo = nextEmployeeId(prefix, taken.map((t) => t.employeeIdNo));
  }

  const trade = text(formData.get("trade"));
  const joiningDate = facts.joinDate;
  const employee = await prisma.$transaction(async (tx) => {
    const e = await tx.employee.create({
      data: {
        ...payFields,
        employeeIdNo, name: name!, branchId: candidate.branchId, supplierId, sponsorSupplierId, projectId, status: "IDLE",
        nationality: text(formData.get("nationality")), gender: text(formData.get("gender")), bloodGroup: text(formData.get("bloodGroup")),
        mobileNumber: facts.mobileNumber, dateOfBirth: facts.dateOfBirth, joinDate: joiningDate, trade, position: trade,
        passportNumber, emiratesId: facts.emiratesId, passportExpiry: facts.passportExpiry, emiratesIdExpiry: facts.emiratesIdExpiry,
        laborCardExpiry: facts.laborCardExpiry, visaExpiry: facts.visaExpiry, medicalExpiry: facts.medicalExpiry,
        visaNumber: text(formData.get("visaNumber")), notes: candidate.remarks,
      },
    });
    await tx.candidateOnboarding.update({ where: { id }, data: { joined: true, joiningDate, employeeId: e.id } });
    return e;
  });

  // The candidate's files become the worker's documents. A failure here never undoes the hire; the count tells the person how many made it.
  let copiedFiles = 0;
  if (formData.get("copyFiles") === "1") {
    const files = await prisma.attachment.findMany({ where: { entityType: "CANDIDATE_ONBOARDING", entityId: id } });
    for (const f of files) {
      try {
        await prisma.document.create({ data: { employeeId: employee.id, type: employeeDocType(f.docType), filename: f.filename, fileData: f.fileData, mimeType: f.mimeType, expiryDate: f.expiryDate, uploadedById: user.id } });
        copiedFiles++;
      } catch (e) {
        console.error("[onboarding] could not copy a file to the employee:", e instanceof Error ? e.message : e);
      }
    }
  }

  await logAudit({ entityType: "CANDIDATE_ONBOARDING", entityId: id, action: "UPDATE", before: { joined: false }, after: { joined: true, joiningDate, employeeId: employee.id }, userId: user.id, userName: user.name, branchId: candidate.branchId });
  await logAudit({ entityType: "EMPLOYEE", entityId: employee.id, action: "CREATE", after: { employeeIdNo, name, source: `Candidate onboarding #${candidate.candidateNo}`, filesCopied: copiedFiles }, userId: user.id, userName: user.name, branchId: candidate.branchId });

  revalidatePath(`/onboarding/${id}`);
  revalidatePath("/onboarding");
  revalidatePath("/employees");
  revalidatePath("/documents");
  return { error: null, employeeId: employee.id, copiedFiles };
}
