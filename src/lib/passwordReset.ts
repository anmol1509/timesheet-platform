import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

/** Reset links live in OtpChallenge (kind PASSWORD_RESET), so no schema change: the token is hashed at rest, single-use, and expires. */
export const RESET_KIND = "PASSWORD_RESET";
export const RESET_TTL_MS = 60 * 60 * 1000;
export const MAX_PER_EMAIL_PER_HOUR = 3;
export const MAX_PER_IP_PER_HOUR = 10;

export const emailKey = (email: string) => `email:${email}`.slice(0, 200);
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");

/** The live (unused, unexpired) reset challenge for a token, with its user, or null. */
export async function findValidReset(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const challenge = await prisma.otpChallenge.findFirst({
    where: { kind: RESET_KIND, codeHash: hashToken(token), consumedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!challenge) return null;
  const email = challenge.phone.replace(/^email:/, "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return null;
  return { challenge, user };
}
