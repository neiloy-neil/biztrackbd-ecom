import { createHmac, randomBytes } from "node:crypto";

/** Direct calls to Supabase's admin API, for creating and removing test accounts, and a TOTP generator like an authenticator app. */
const url = () => process.env.SUPABASE_URL!;
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;
const headers = () => ({ apikey: key(), authorization: `Bearer ${key()}`, "content-type": "application/json" });

export const PASSWORD = "correct horse battery staple";
export const emailFor = (run: string, who: string) => `e2e-real-${run}-${who}@biztrack-e2e.test`;

export async function createUser(email: string, o: { password?: string; confirmed?: boolean } = {}): Promise<string> {
  const r = await fetch(`${url()}/auth/v1/admin/users`, { method: "POST", headers: headers(), body: JSON.stringify({ email, password: o.password ?? PASSWORD, email_confirm: o.confirmed ?? true }) });
  const j = (await r.json()) as { id?: string; msg?: string };
  if (!j.id) throw new Error(`createUser ${email}: ${r.status} ${j.msg ?? ""}`);
  return j.id;
}

export async function deleteAllTestUsers(): Promise<number> {
  let n = 0;
  for (;;) {
    const r = await fetch(`${url()}/auth/v1/admin/users?page=1&per_page=200`, { headers: headers() });
    const users = ((await r.json()) as { users?: { id: string; email?: string }[] }).users ?? [];
    const mine = users.filter((u) => (u.email ?? "").startsWith("e2e-real-"));
    for (const u of mine) {
      await fetch(`${url()}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: headers() });
      n++;
    }
    if (mine.length === 0) return n;
  }
}

/** The one-time code Supabase would have emailed, without sending any email. */
export async function emailCode(email: string): Promise<string> {
  const r = await fetch(`${url()}/auth/v1/admin/generate_link`, { method: "POST", headers: headers(), body: JSON.stringify({ type: "magiclink", email }) });
  const j = (await r.json()) as { email_otp?: string; properties?: { email_otp?: string } };
  const otp = j.email_otp ?? j.properties?.email_otp;
  if (!otp) throw new Error(`no code for ${email}: ${r.status}`);
  return otp;
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(s: string): Buffer {
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238, 6 digits, 30 seconds: what Google Authenticator shows. `step` shifts by whole periods (for a code a moment old or new). */
export function totp(secret: string, step = 0, now = Date.now()): string {
  const counter = Math.floor(now / 30_000) + step;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32(secret)).update(buf).digest();
  const o = h[h.length - 1]! & 0xf;
  const n = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(n % 1_000_000).padStart(6, "0");
}

export const runId = () => randomBytes(3).toString("hex");
