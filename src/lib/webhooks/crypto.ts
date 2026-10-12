import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "crypto";

/**
 * A webhook's signing secret has to be readable to sign with, so it is stored
 * encrypted (AES-256-GCM) under a key derived from SESSION_SECRET rather than
 * as plain text. If SESSION_SECRET is ever rotated, endpoints must be given new
 * secrets.
 */
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return Buffer.from(hkdfSync("sha256", secret, "manpowersync", "webhook-signing-secret", 32));
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, tag, enc] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export const newSigningSecret = () => "whsec_" + randomBytes(24).toString("base64url");

/** The value of the ManpowerSync-Signature header: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">. */
export function signPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}
