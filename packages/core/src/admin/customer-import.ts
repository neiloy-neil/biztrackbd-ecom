import { withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { assertNotInDemo } from "../demo/guard";
import { ValidationError } from "../errors";
import { parseCsv } from "../finance/csv";
import { normalizeBdPhone } from "../phone";
import { assertCan, type StaffActor } from "../permissions";

export const CUSTOMER_IMPORT_MAX_ROWS = 2000;

export const CUSTOMER_IMPORT_TEMPLATE = "Name,Phone,Email,Tags,Notes\r\nTania Akter,01712345678,tania@example.com,\"eid buyer; vip\",Prefers a call before delivery\r\n";

export interface CustomerImportResult {
  /** Which kind of file it was read as: a Shopify customer export, or a plain list. */
  format: "shopify" | "standard";
  created: number;
  /** Already in the store by phone number. Left exactly as they were, apart from empty fields being filled. */
  existing: number;
  /** The same number twice in the file. */
  duplicates: number;
  failed: { line: number; name: string; reason: string }[];
}

const norm = (h: string) => h.normalize("NFC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const clean = (s: string | undefined, max: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const cleanTag = (t: string) => t.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N} -]/gu, "").replace(/\s+/g, " ").trim().slice(0, 24);

/**
 * Brings customers in from a spreadsheet: a plain list (Name, Phone, Email, Tags, Notes) or a Shopify customer export
 * (First Name, Last Name, Phone, Email, Tags, Note). Rows are matched by mobile number. A number already in the store is
 * left alone (empty name, email or notes are filled in, nothing is overwritten). Importing does NOT give the store permission to
 * send them SMS or email: consent stays off until the customer gives it.
 */
export async function importCustomersCsv(tenantId: string, actor: StaffActor, text: string): Promise<CustomerImportResult> {
  await assertNotInDemo(tenantId, "Importing customers");
  assertCan(actor, "customers", "edit");
  const rows = parseCsv(text);
  if (rows.length < 2) throw new ValidationError("The file has no customers. Use the template or an export from Shopify.");
  const head = rows[0]!.map(norm);
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iFirst = col("first name"), iLast = col("last name");
  const iName = col("name", "full name", "customer name", "customer");
  const iPhone = col("phone", "mobile", "mobile number", "phone number", "default address phone");
  const iEmail = col("email", "e mail", "email address");
  const iTags = col("tags", "tag", "labels");
  const iNotes = col("notes", "note", "private note");
  if (iPhone < 0) throw new ValidationError("The file needs a Phone column (or Mobile).");
  if (iName < 0 && iFirst < 0) throw new ValidationError("The file needs a Name column (or First Name and Last Name).");
  const body = rows.slice(1);
  if (body.length > CUSTOMER_IMPORT_MAX_ROWS) throw new ValidationError(`Import up to ${CUSTOMER_IMPORT_MAX_ROWS} customers at a time. This file has ${body.length}.`);

  const out: CustomerImportResult = { format: iFirst >= 0 ? "shopify" : "standard", created: 0, existing: 0, duplicates: 0, failed: [] };
  const seen = new Set<string>();
  const cell = (r: string[], i: number) => (i >= 0 ? r[i] : undefined);

  for (let n = 0; n < body.length; n++) {
    const r = body[n]!;
    const line = n + 2;
    const name = clean(iFirst >= 0 ? `${cell(r, iFirst) ?? ""} ${cell(r, iLast) ?? ""}` : cell(r, iName), 120);
    try {
      if (name.length < 2) throw new ValidationError("No name");
      let phone: string;
      try { phone = normalizeBdPhone(cell(r, iPhone) ?? ""); } catch { throw new ValidationError("Not a Bangladeshi mobile number"); }
      if (seen.has(phone)) { out.duplicates++; continue; }
      seen.add(phone);
      const email = clean(cell(r, iEmail), 120).toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("The email address does not look right");
      const tags = [...new Set((cell(r, iTags) ?? "").split(/[;,|]/).map(cleanTag).filter(Boolean))].slice(0, 8);
      const notes = clean(cell(r, iNotes), 1000);
      const result = await withTenant(tenantId, async (tx) => {
        const found = await tx.customer.findFirst({ where: { phone } });
        if (found) {
          const fill: { name?: string; email?: string; notes?: string; tags?: string[] } = {};
          if (!found.name.trim()) fill.name = name;
          if (!found.email && email) fill.email = email;
          if (!found.notes && notes) fill.notes = notes;
          const merged = [...new Set([...found.tags, ...tags])].slice(0, 12);
          if (merged.length !== found.tags.length) fill.tags = merged;
          if (Object.keys(fill).length) await tx.customer.update({ where: { id: found.id }, data: fill });
          return "existing" as const;
        }
        await tx.customer.create({ data: { tenantId, name, phone, email: email || null, tags, notes: notes || null } });
        return "created" as const;
      });
      out[result]++;
    } catch (e) {
      out.failed.push({ line, name, reason: e instanceof ValidationError ? e.message : "Could not be read" });
    }
  }
  await withTenant(tenantId, (tx) => audit(tx, tenantId, actor, "customers.imported", { created: out.created, existing: out.existing, failed: out.failed.length }));
  return out;
}
