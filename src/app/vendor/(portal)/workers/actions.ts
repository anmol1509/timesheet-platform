"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { approverIds, notifyUsers } from "@/lib/notifications/notify";
import { parseDay } from "@/lib/dates";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";

type State = { error: string | null; ok?: boolean };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const day = (v: FormDataEntryValue | null) => { const s = str(v); return s ? parseDay(s) : null; };
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];
const FILES = [["passportFile", "PASSPORT"], ["emiratesIdFile", "EMIRATES_ID"], ["otherFile", "OTHER"]] as const;

/** A supplier proposes a new worker. It waits in a staging table until our staff approve it. */
export async function submitWorkerAction(_prev: State, formData: FormData): Promise<State> {
  const vendor = await getVendor();
  if (!vendor) return { error: "Please sign in again." };
  if (vendor.labourApprovalStatus !== "Approved") return { error: "Adding workers isn't enabled for your company yet. Please contact us." };

  const firstName = str(formData.get("firstName"));
  const lastName = str(formData.get("lastName"));
  const trade = str(formData.get("trade"));
  const passportNumber = str(formData.get("passportNumber")).toUpperCase().replace(/\s+/g, "");
  const emiratesId = str(formData.get("emiratesId")).replace(/[\s-]/g, "");
  const dateOfBirth = day(formData.get("dateOfBirth"));
  if (!firstName || !lastName) return { error: "Enter the worker's first and last name." };
  if (!trade) return { error: "Choose the worker's trade." };
  if (!passportNumber) return { error: "Enter the passport number." };
  if (!emiratesId) return { error: "Enter the Emirates ID number (or the ICP registration number if the card is not issued yet)." };
  if (!dateOfBirth) return { error: "Enter the date of birth." };
  if (dateOfBirth.getTime() > Date.now() - 16 * 365 * 86_400_000) return { error: "That date of birth is too recent for a worker." };
  const skill = await prisma.skill.findUnique({ where: { name: trade }, select: { id: true } });
  if (!skill) return { error: "Choose a trade from the list." };

  const files: { file: File; docType: string }[] = [];
  for (const [field, docType] of FILES) {
    const f = formData.get(field);
    if (!(f instanceof File) || f.size === 0) continue;
    if (!ALLOWED.includes(f.type)) return { error: "Attach documents as PDF, JPG or PNG." };
    if (f.size > MAX_UPLOAD_BYTES) return { error: `${f.name} is ${(f.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_UPLOAD_LABEL}.` };
    files.push({ file: f, docType });
  }

  // Deliberately vague: it must not reveal which other supplier already has this person.
  const clash = await Promise.all([
    prisma.employee.count({ where: { OR: [{ passportNumber: { equals: passportNumber, mode: "insensitive" } }, { emiratesId }] } }),
    prisma.workerSubmission.count({ where: { status: "PENDING", OR: [{ passportNumber: { equals: passportNumber, mode: "insensitive" } }, { emiratesId }] } }),
  ]);
  if (clash[0] + clash[1] > 0) return { error: "A worker with this passport or Emirates ID is already registered or waiting for approval. Please contact us if you think this is a mistake." };

  const sub = await prisma.workerSubmission.create({
    data: {
      supplierId: vendor.id, branchId: vendor.branchId, firstName, middleName: str(formData.get("middleName")) || null, lastName,
      gender: ["MALE", "FEMALE"].includes(str(formData.get("gender"))) ? str(formData.get("gender")) : null,
      dateOfBirth, nationality: str(formData.get("nationality")) || null, mobileNumber: str(formData.get("mobileNumber")) || null, trade,
      joinDate: day(formData.get("joinDate")), bloodGroup: str(formData.get("bloodGroup")) || null, passportNumber, emiratesId,
      passportExpiry: day(formData.get("passportExpiry")), emiratesIdExpiry: day(formData.get("emiratesIdExpiry")), visaExpiry: day(formData.get("visaExpiry")),
      laborCardExpiry: day(formData.get("laborCardExpiry")), medicalExpiry: day(formData.get("medicalExpiry")),
    },
  });
  for (const { file, docType } of files) {
    await prisma.attachment.create({
      data: { entityType: "WORKER_SUBMISSION", entityId: sub.id, docType, filename: file.name, fileData: Buffer.from(await file.arrayBuffer()), mimeType: file.type, branchId: vendor.branchId, uploadedBySupplierId: vendor.id },
    });
  }
  await notifyUsers({
    userIds: await approverIds("partners", vendor.branchId),
    kind: "SUPPLIER_WORKER_SUBMITTED",
    title: `New worker to approve: ${firstName} ${lastName}`,
    body: `${vendor.name} added a ${trade}.`,
    href: "/approvals?type=WORKER",
  });
  revalidatePath("/vendor/workers");
  return { error: null, ok: true };
}

/** Withdraw a submission that hasn't been decided. */
export async function withdrawWorkerAction(formData: FormData): Promise<State> {
  const vendor = await getVendor();
  if (!vendor) return { error: "Please sign in again." };
  const sub = await prisma.workerSubmission.findFirst({ where: { id: str(formData.get("id")), supplierId: vendor.id } });
  if (!sub) return { error: "Not found." };
  if (sub.status !== "PENDING") return { error: "That submission has already been decided." };
  await prisma.$transaction([
    prisma.attachment.deleteMany({ where: { entityType: "WORKER_SUBMISSION", entityId: sub.id } }),
    prisma.workerSubmission.delete({ where: { id: sub.id } }),
  ]);
  revalidatePath("/vendor/workers");
  return { error: null, ok: true };
}
