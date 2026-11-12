import crypto from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE = "pygmy_admin";
const TTL_MS = 12 * 60 * 60 * 1000;
export const SESSION_MAX_AGE = TTL_MS / 1000;

// ── which login methods are on ───────────────────────────────────────────────
export function allowedGithubUsers(): string[] {
  return (process.env.ADMIN_GITHUB_USERS ?? "")
    .split(",")
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
}
export const githubEnabled = () =>
  Boolean(
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      allowedGithubUsers().length
  );
export const adminEnabled = () => Boolean(process.env.PYGMY_ADMIN_KEY) && githubEnabled();

// ── signed session cookie: "<exp>.<nonce>.<login b64url>.<hmac>" ─────────────
function secret(): Buffer {
  return crypto
    .createHash("sha256")
    .update(
      [
        process.env.PYGMY_ADMIN_KEY ?? "",
        process.env.GITHUB_CLIENT_SECRET ?? "",
      ].join("|")
    )
    .digest();
}

const mac = (payload: string) =>
  crypto.createHmac("sha256", secret()).update(payload).digest("hex");

export function signSession(login: string): string {
  const payload = [
    Date.now() + TTL_MS,
    crypto.randomBytes(8).toString("hex"),
    Buffer.from(login).toString("base64url"),
  ].join(".");
  return `${payload}.${mac(payload)}`;
}

/** Returns the logged-in user's name, or null when the session is invalid. */
export function verifySession(token?: string): string | null {
  if (!token || !adminEnabled()) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const payload = parts.slice(0, 3).join(".");
  const given = Buffer.from(parts[3]);
  const expected = Buffer.from(mac(payload));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  if (Number(parts[0]) <= Date.now()) return null;
  return Buffer.from(parts[2], "base64url").toString() || null;
}

export async function getAdmin(): Promise<string | null> {
  const jar = await cookies();
  return verifySession(jar.get(COOKIE)?.value);
}

/** Public base URL of the site (needed for the OAuth callback). */
export function appUrl(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
