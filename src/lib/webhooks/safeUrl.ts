import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * A webhook URL is typed in by a customer and then fetched by our server, so it
 * could be pointed at something only we can reach (our own database, a cloud
 * metadata address, an internal service). This allows only https to public
 * addresses, and the address checked is the one that is then connected to.
 */
const allowPrivate = () => process.env.NODE_ENV !== "production" && process.env.WEBHOOK_ALLOW_INSECURE === "1";

function v4Blocked(a: string) {
  const [p, q] = a.split(".").map(Number);
  return (
    p === 0 || p === 10 || p === 127 || (p === 100 && q >= 64 && q <= 127) || (p === 169 && q === 254) || (p === 172 && q >= 16 && q <= 31) ||
    (p === 192 && q === 168) || (p === 192 && q === 0) || (p === 198 && (q === 18 || q === 19)) || p >= 224
  );
}

/** The 16 bytes of an IPv6 address, or null if it doesn't parse. Handles "::" and a trailing dotted IPv4. */
function v6Bytes(addr: string): number[] | null {
  let a = addr;
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (dotted) {
    const o = dotted[1].split(".").map(Number);
    if (o.some((n) => n > 255)) return null;
    a = a.slice(0, -dotted[1].length) + ((o[0] << 8) | o[1]).toString(16) + ":" + ((o[2] << 8) | o[3]).toString(16);
  }
  const halves = a.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  const groups = [...head, ...Array(Math.max(0, fill)).fill("0"), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.flatMap((g) => [parseInt(g, 16) >> 8, parseInt(g, 16) & 255]);
}

export function addressBlocked(address: string): boolean {
  const lower = address.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (isIP(lower) === 4) return v4Blocked(lower);
  const b = v6Bytes(lower);
  if (!b) return true; // can't read it, so don't connect to it
  const zeros = (from: number, to: number) => b.slice(from, to).every((x) => x === 0);
  const v4 = (i: number) => v4Blocked(b.slice(i, i + 4).join("."));
  if (zeros(0, 10) && b[10] === 255 && b[11] === 255) return v4(12); // ::ffff:a.b.c.d
  if (zeros(0, 12)) return true; // ::, ::1 and the deprecated IPv4-compatible form
  if (b[0] === 0 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && zeros(4, 12)) return v4(12); // NAT64
  if (b[0] === 0x20 && b[1] === 0x02) return v4(2); // 6to4
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0 && b[3] === 0) return true; // Teredo
  return (b[0] & 0xfe) === 0xfc || (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) || b[0] === 0xff || (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8);
}

export type SafeTarget = { url: URL; address: string; family: 4 | 6 };

/** Throws an Error whose message is safe to show the customer. */
export async function resolveSafeTarget(raw: string): Promise<SafeTarget> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Enter a full web address, such as https://example.com/webhooks.");
  }
  const insecureOk = allowPrivate();
  if (url.protocol !== "https:" && !(insecureOk && url.protocol === "http:")) throw new Error("The address must start with https://.");
  if (url.username || url.password) throw new Error("The address can't contain a username or password.");
  if (url.port && !insecureOk && !["443", "8443"].includes(url.port)) throw new Error("Use the standard HTTPS port (443 or 8443).");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!insecureOk && (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal"))) {
    throw new Error("That address points to a private network. Use a public address.");
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
  } catch {
    throw new Error("We couldn't find that address. Check the spelling.");
  }
  if (addresses.length === 0) throw new Error("We couldn't find that address. Check the spelling.");
  if (!insecureOk && addresses.some((a) => addressBlocked(a.address))) throw new Error("That address points to a private network. Use a public address.");
  const first = addresses[0];
  return { url, address: first.address, family: first.family === 6 ? 6 : 4 };
}
