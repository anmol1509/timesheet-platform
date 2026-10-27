import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { RESET_KIND, emailKey, hashToken, newToken } from "@/lib/passwordReset";

export type CompanySetup = {
  lookups: { category: string; value: string; sortOrder: number; isActive: boolean }[];
  templates: { name: string; category: string | null; title: string | null; presetKey: string | null; bodyHtml: string | null; audience: string; remarksText: string }[];
};

/** The setup (never the data) of a company, to start a new one with the same dropdowns and letter templates. */
export async function loadCompanySetup(branchId: string): Promise<CompanySetup> {
  const [lookups, templates] = await Promise.all([
    prisma.lookupValue.findMany({ where: { branchId }, select: { category: true, value: true, sortOrder: true, isActive: true } }),
    prisma.letterTemplate.findMany({ where: { branchId }, select: { name: true, category: true, title: true, presetKey: true, bodyHtml: true, audience: true, remarksText: true } }),
  ]);
  return { lookups, templates };
}

export const INVITE_DAYS = 7;

export type ProvisionInput = {
  code: string;
  name: string;
  emirate?: string | null;
  adminName: string;
  adminEmail: string;
  credits: number;
  setup?: CompanySetup;
  baseUrl: string;
  inviteDays?: number;
};

export type ProvisionResult = { branchId: string; userId: string; inviteLink: string; inviteExpires: Date } | { error: string };

/**
 * Sets a company up: the company itself, its monthly AI credits, its first administrator and a one-time link to choose a password.
 * The administrator has no password until the link is used, so nothing secret is ever sent or shown besides the link.
 */
export async function provisionCompany(input: ProvisionInput): Promise<ProvisionResult> {
  const email = input.adminEmail.trim().toLowerCase();
  const code = input.code.trim().toUpperCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "That email address doesn't look right." };
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return { error: "Someone already signs in with that email address." };
  if (await prisma.branch.findUnique({ where: { code }, select: { id: true } })) return { error: `A company with the code ${code} already exists.` };

  const token = newToken();
  const days = input.inviteDays ?? INVITE_DAYS;
  const inviteExpires = new Date(Date.now() + days * 86_400_000);
  const result = await prisma.$transaction(async (tx) => {
    const branch = await tx.branch.create({ data: { code, name: input.name.trim(), emirate: input.emirate || null, aiMonthlyCredits: Math.max(0, Math.round(input.credits)) } });
    if (input.setup) {
      await tx.lookupValue.createMany({ data: input.setup.lookups.map((l) => ({ ...l, branchId: branch.id })), skipDuplicates: true });
      await tx.letterTemplate.createMany({ data: input.setup.templates.map((t) => ({ ...t, branchId: branch.id })) });
    }
    // A brand-new database starts with an empty default company. On a customer's own deployment it is never used, so it is hidden from pickers.
    const spare = await tx.branch.findUnique({ where: { code: "MAIN" }, select: { id: true } });
    if (spare && (await tx.user.count({ where: { branchId: spare.id } })) === 0 && (await tx.employee.count({ where: { branchId: spare.id } })) === 0) await tx.branch.update({ where: { id: spare.id }, data: { isActive: false } });
    // A random password nobody knows: the person sets their own through the link.
    const user = await tx.user.create({ data: { email, name: input.adminName.trim(), passwordHash: hashPassword(randomBytes(24).toString("hex")), role: "BRANCH_ADMIN", branchId: branch.id } });
    await tx.otpChallenge.create({ data: { kind: RESET_KIND, phone: emailKey(email), codeHash: hashToken(token), expiresAt: inviteExpires } });
    return { branchId: branch.id, userId: user.id };
  });
  return { ...result, inviteLink: `${input.baseUrl.replace(/\/$/, "")}/login/reset?token=${token}`, inviteExpires };
}
