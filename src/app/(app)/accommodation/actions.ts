"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function createCampAction(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await prisma.camp.create({ data: { name } });
  revalidatePath("/accommodation");
}

export async function createRoomAction(formData: FormData) {
  await requireUser();
  const campId = String(formData.get("campId") || "");
  const name = String(formData.get("name") || "").trim();
  const bedCount = Math.max(1, Math.min(20, Number(formData.get("bedCount")) || 1));
  if (!campId || !name) return;

  const room = await prisma.room.create({ data: { campId, name } });
  await prisma.bed.createMany({
    data: Array.from({ length: bedCount }, (_, i) => ({
      roomId: room.id,
      label: `Bed ${String(i + 1).padStart(2, "0")}`,
    })),
  });

  revalidatePath("/accommodation");
}

export async function updateCampAction(formData: FormData) {
  await requireUser();
  const campId = String(formData.get("campId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!campId || !name) return;
  await prisma.camp.update({ where: { id: campId }, data: { name } });
  revalidatePath("/accommodation");
}

export async function updateRoomAction(formData: FormData) {
  await requireUser();
  const roomId = String(formData.get("roomId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!roomId || !name) return;
  await prisma.room.update({ where: { id: roomId }, data: { name } });
  revalidatePath("/accommodation");
}

export async function addBedsToRoomAction(formData: FormData) {
  await requireUser();
  const roomId = String(formData.get("roomId") || "");
  const count = Math.max(1, Math.min(20, Number(formData.get("count")) || 1));
  if (!roomId) return;

  const existingBeds = await prisma.bed.count({ where: { roomId } });
  await prisma.bed.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      roomId,
      label: `Bed ${String(existingBeds + i + 1).padStart(2, "0")}`,
    })),
  });

  revalidatePath("/accommodation");
}

export async function assignBedAction(formData: FormData) {
  await requireUser();
  const bedId = String(formData.get("bedId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  if (!bedId || !employeeId) return;
  await prisma.bed.update({ where: { id: bedId }, data: { employeeId } });
  revalidatePath("/accommodation");
  revalidatePath(`/employees/${employeeId}`);
}

export async function unassignBedAction(formData: FormData) {
  await requireUser();
  const bedId = String(formData.get("bedId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  if (!bedId) return;
  await prisma.bed.update({ where: { id: bedId }, data: { employeeId: null } });
  revalidatePath("/accommodation");
  if (employeeId) revalidatePath(`/employees/${employeeId}`);
}

export async function deleteRoomAction(formData: FormData) {
  await requireUser();
  const roomId = String(formData.get("roomId") || "");
  if (!roomId) return;
  await prisma.room.delete({ where: { id: roomId } }); // cascades to its beds
  revalidatePath("/accommodation");
}

export async function deleteCampAction(formData: FormData) {
  await requireUser();
  const campId = String(formData.get("campId") || "");
  if (!campId) return;
  await prisma.camp.delete({ where: { id: campId } }); // cascades to rooms + beds
  revalidatePath("/accommodation");
}
