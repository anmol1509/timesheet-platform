import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { ESS_COOKIE, ESS_DURATION_SECONDS, createEssToken, verifyEssToken } from "./token";

export async function setEssCookie(employeeId: string) {
  const store = await cookies();
  store.set(ESS_COOKIE, await createEssToken(employeeId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ESS_DURATION_SECONDS,
  });
}

export async function clearEssCookie() {
  (await cookies()).delete(ESS_COOKIE);
}

/** The signed-in employee, re-checked against the database every request so
 * switching portal access off (or terminating them) takes effect immediately. */
export async function getEssEmployee() {
  const token = (await cookies()).get(ESS_COOKIE)?.value;
  const session = token ? await verifyEssToken(token) : null;
  if (!session) return null;
  const employee = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: {
      id: true,
      name: true,
      employeeIdNo: true,
      trade: true,
      position: true,
      status: true,
      essEnabled: true,
      branchId: true,
      branch: { select: { name: true, logoId: true } },
      project: { select: { name: true } },
      site: { select: { name: true } },
    },
  });
  if (!employee || !employee.essEnabled || employee.status === "TERMINATED") return null;
  return employee;
}
