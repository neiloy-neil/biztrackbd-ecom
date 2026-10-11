import { promises as dns } from "node:dns";
import { readFileSync } from "node:fs";
import { getBasePrisma, withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { NotFoundError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { confirmDomainVerified } from "./service";

/**
 * Connecting a domain without support (docs/13): the owner adds a name, we tell them exactly which record to create, and
 * we keep checking. When the record is right we ask Vercel to serve the name, which also issues the certificate, and when
 * Vercel confirms the domain becomes "Connected". Every step is a plain sentence the owner can act on.
 */

export interface DnsResolver {
  resolve4(host: string): Promise<string[]>;
  resolveCname(host: string): Promise<string[]>;
}
export interface VercelDomainClient {
  /** Adds the name to the storefront project. Adding twice is fine. */
  add(domain: string): Promise<void>;
  /** `configured`: DNS points at Vercel. `ssl`: the certificate state. */
  status(domain: string): Promise<{ configured: boolean; ssl: "pending" | "issued" | "failed" }>;
  remove(domain: string): Promise<void>;
}

export const systemResolver: DnsResolver = {
  resolve4: (h) => dns.resolve4(h),
  resolveCname: (h) => dns.resolveCname(h),
};

/**
 * Development and end-to-end tests only: DEV_DNS_FILE names a JSON file of { "host": { "a": [...], "cname": [...] } } that is
 * read instead of the real DNS, so a test can "create the record" without owning a domain. Ignored in production.
 */
function devFileResolver(): DnsResolver | null {
  const file = process.env.DEV_DNS_FILE;
  if (!file || process.env.NODE_ENV === "production") return null;
  const read = (host: string, kind: "a" | "cname"): string[] => {
    let table: Record<string, { a?: string[]; cname?: string[] }> = {};
    try {
      table = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      /* no file yet: every name is unknown */
    }
    const v = table[host]?.[kind];
    if (!v?.length) throw Object.assign(new Error("ENODATA"), { code: "ENODATA" });
    return v;
  };
  return { resolve4: async (h) => read(h, "a"), resolveCname: async (h) => read(h, "cname") };
}

let resolver: DnsResolver = systemResolver;
let vercel: VercelDomainClient | null = null;
export function setDnsResolver(r: DnsResolver | null): void {
  resolver = r ?? systemResolver;
}
export function setVercelClient(c: VercelDomainClient | null): void {
  vercel = c;
}

/** The real client, used when VERCEL_TOKEN and VERCEL_PROJECT_ID are set. Without them nothing is called and the domain stays "waiting for the certificate". */
export function vercelFromEnv(env = process.env): VercelDomainClient | null {
  const token = env.VERCEL_TOKEN, project = env.VERCEL_PROJECT_ID;
  if (!token || !project) return null;
  const team = env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}` : "";
  const base = env.VERCEL_API_URL ?? "https://api.vercel.com";
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}${path}${team}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15_000) });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, json };
  };
  return {
    async add(domain) {
      const r = await call("POST", `/v10/projects/${project}/domains`, { name: domain });
      // 409 means it is already on this project.
      if (r.status >= 400 && r.status !== 409) throw new Error(`vercel add ${r.status}`);
    },
    async status(domain) {
      const cfg = await call("GET", `/v6/domains/${encodeURIComponent(domain)}/config`);
      const prj = await call("GET", `/v9/projects/${project}/domains/${encodeURIComponent(domain)}`);
      const configured = cfg.status < 400 && cfg.json.misconfigured === false;
      const verified = prj.status < 400 && prj.json.verified === true;
      return { configured: configured && verified, ssl: configured && verified ? "issued" : "pending" };
    },
    async remove(domain) {
      const r = await call("DELETE", `/v9/projects/${project}/domains/${encodeURIComponent(domain)}`);
      if (r.status >= 400 && r.status !== 404) throw new Error(`vercel remove ${r.status}`);
    },
  };
}
const client = () => vercel ?? vercelFromEnv();

export interface DnsInstruction {
  kind: "A" | "CNAME";
  host: string;
  name: string;
  value: string;
  steps: string[];
}

const isApex = (domain: string) => domain.split(".").length <= 2 || /\.(co|com|org|net|gov|edu)\.bd$/.test(domain) && domain.split(".").length <= 3;
const aTarget = () => process.env.PLATFORM_A_RECORD ?? "76.76.21.21";
const cnameTarget = () => (process.env.PLATFORM_CNAME_TARGET ?? "cname.biztrackbd.com").toLowerCase();

/** What the owner must create at their registrar. A name with nothing in front of it needs an A record; "shop.example.com" a CNAME. */
export function dnsInstruction(domain: string): DnsInstruction {
  const apex = isApex(domain);
  const kind = apex ? "A" : "CNAME";
  const name = apex ? "@" : domain.split(".")[0]!;
  const value = apex ? aTarget() : cnameTarget();
  return {
    kind, host: domain, name, value,
    steps: [
      "Sign in where you bought the domain (for example Namecheap, GoDaddy, or the Bangladeshi registrar you used).",
      "Open the DNS settings for the domain.",
      `Add a new ${kind} record. Name: ${name}. Value: ${value}.`,
      "Delete any older A or CNAME record for the same name, so only one is left.",
      "Save. It can take a few minutes, sometimes up to a few hours. We check by ourselves and this page updates.",
    ],
  };
}

export type CheckOutcome = { dnsStatus: "waiting" | "wrong_record" | "found" | "verified"; note: string | null; ssl: "pending" | "issued" | "renewal_failed" | "expiring"; connected: boolean };

const safe = async <T>(p: Promise<T[]>): Promise<T[]> => p.catch(() => []);

async function inspectDns(domain: string): Promise<{ ok: boolean; seen: string[] }> {
  const want = dnsInstruction(domain);
  const r = resolver !== systemResolver ? resolver : devFileResolver() ?? systemResolver;
  const [a, cname] = await Promise.all([safe(r.resolve4(domain)), safe(r.resolveCname(domain))]);
  const seen = [...cname.map((c) => c.toLowerCase().replace(/\.$/, "")), ...a];
  // A subdomain may also be pointed with an A record straight at us, and an apex may be flattened to an address.
  const ok = want.kind === "CNAME" ? cname.some((c) => c.toLowerCase().replace(/\.$/, "") === want.value) || a.includes(aTarget()) : a.includes(aTarget());
  return { ok, seen };
}

/**
 * Looks at one domain and moves it forward as far as it can go. Safe to call at any time and as often as you like
 * (the sweep and the owner's "Check now" both do): every step is idempotent. Never throws for an outside failure; the
 * outcome says what is wrong in words.
 */
export async function checkDomain(tenantId: string, host: string): Promise<CheckOutcome> {
  const domain = host.trim().toLowerCase();
  const row = await withTenant(tenantId, (tx) => tx.domain.findFirst({ where: { domain } }));
  if (!row) throw new NotFoundError("Domain");

  let dnsStatus: CheckOutcome["dnsStatus"] = row.dnsStatus as CheckOutcome["dnsStatus"];
  let note: string | null = row.dnsNote;
  const ssl = row.sslStatus as CheckOutcome["ssl"];
  const want = dnsInstruction(domain);

  const seen = await inspectDns(domain);
  if (!seen.ok) {
    dnsStatus = seen.seen.length ? "wrong_record" : "waiting";
    note = seen.seen.length
      ? `The domain points to ${seen.seen.join(", ")}, not to us. Change it to a ${want.kind} record with the value ${want.value}.`
      : `We cannot see the ${want.kind} record yet. Add it with the value ${want.value}. Changes can take a few minutes.`;
    // A domain that already worked and now points away is not served any more; say so rather than pretending.
    await withTenant(tenantId, (tx) => tx.domain.update({ where: { id: row.id }, data: { dnsStatus: row.verified ? "wrong_record" : dnsStatus, dnsNote: note, lastCheckedAt: new Date() } }));
    return { dnsStatus, note, ssl, connected: false };
  }

  // The record is right. Ask Vercel to serve the name; it issues the certificate by itself.
  const v = client();
  if (!v) {
    await withTenant(tenantId, (tx) => tx.domain.update({ where: { id: row.id }, data: { dnsStatus: "found", dnsNote: "Your record is correct. We are getting the certificate ready.", lastCheckedAt: new Date() } }));
    return { dnsStatus: "found", note: "Your record is correct. We are getting the certificate ready.", ssl, connected: false };
  }
  try {
    await v.add(domain);
    const st = await v.status(domain);
    if (st.configured) {
      await confirmDomainVerified(tenantId, domain);
      await withTenant(tenantId, async (tx) => {
        await tx.domain.update({ where: { id: row.id }, data: { sslStatus: st.ssl === "issued" ? "issued" : "pending", lastCheckedAt: new Date() } });
        if (row.sslStatus !== "issued" && st.ssl === "issued") await audit(tx, tenantId, { userId: "system", email: "system@biztrackbd" }, "domain.ssl_issued", { domain });
      });
      return { dnsStatus: "verified", note: null, ssl: st.ssl === "issued" ? "issued" : "pending", connected: st.ssl === "issued" };
    }
    note = "Your record is correct. We are getting the certificate ready, this usually takes a few minutes.";
    await withTenant(tenantId, (tx) => tx.domain.update({ where: { id: row.id }, data: { dnsStatus: "found", dnsNote: note, lastCheckedAt: new Date() } }));
    return { dnsStatus: "found", note, ssl, connected: false };
  } catch (e) {
    console.error("[domains] vercel step failed", e instanceof Error ? e.message : "unknown");
    note = "Your record is correct. We hit a problem finishing the setup and will try again shortly.";
    await withTenant(tenantId, (tx) => tx.domain.update({ where: { id: row.id }, data: { dnsStatus: "found", dnsNote: note, lastCheckedAt: new Date() } }));
    return { dnsStatus: "found", note, ssl, connected: false };
  }
}

/** The owner pressing "Check now". Limited to once every 15 seconds per domain. */
export async function recheckDomain(tenantId: string, actor: StaffActor, domainId: string): Promise<CheckOutcome> {
  assertCan(actor, "billing", "edit");
  const row = await withTenant(tenantId, (tx) => tx.domain.findFirst({ where: { id: domainId } }));
  if (!row) throw new NotFoundError("Domain");
  if (row.lastCheckedAt && Date.now() - row.lastCheckedAt.getTime() < 15_000) {
    return { dnsStatus: row.dnsStatus as CheckOutcome["dnsStatus"], note: row.dnsNote, ssl: row.sslStatus as CheckOutcome["ssl"], connected: row.verified && row.sslStatus === "issued" };
  }
  return checkDomain(tenantId, row.domain);
}

export interface SweepSummary { checked: number; connected: number; failed: number }

/** For the scheduled job: every domain still connecting. One failing does not stop the rest. */
export async function sweepDomains(): Promise<SweepSummary> {
  const rows = await getBasePrisma().$queryRaw<{ tenantId: string; domain: string }[]>`SELECT "tenantId", "domain" FROM domains_to_check()`;
  const out: SweepSummary = { checked: 0, connected: 0, failed: 0 };
  for (const r of rows) {
    try {
      const res = await checkDomain(r.tenantId, r.domain);
      out.checked++;
      if (res.connected) out.connected++;
    } catch (e) {
      out.failed++;
      console.error("[domains] check failed", e instanceof Error ? e.name : "unknown");
    }
  }
  return out;
}
