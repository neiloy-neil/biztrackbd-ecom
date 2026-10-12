// Writes every email BizTrackBD sends to HTML files you can open in a browser, and the Supabase sign-in templates ready to paste.
//   pnpm --filter @biztrackbd/core exec tsx scripts/email-preview.ts
// Output: checkup/emails/<kind>.<lang>.html (the platform's own emails, with sample facts) and docs/email-templates/supabase-<name>.html.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../../..");
const { AUTH_MAILS, MAIL_KIND_LIST, buildAuthMail, buildMail } = await import("../src/mail/templates");

const sample = {
  storeName: "Rongdhonu", ownerName: "Rina Akter", storeUrl: "https://rongdhonu.biztrack.bd", adminUrl: "https://admin.biztrack.bd", billingUrl: "https://admin.biztrack.bd/billing",
  trialEnds: "26 October 2026", inviterName: "Rina Akter", roleLabel: "Store manager", link: "https://admin.biztrack.bd/join/abc123", expires: "19 October 2026", daysLeft: 3,
  plan: "Pro", paidUntil: "12 November 2026", reason: "TrxID not found in our bKash", ticketCode: "TK-1042", excerpt: "Thanks for writing. We have switched on your domain; it can take up to an hour to show.", ticketUrl: "https://admin.biztrack.bd/support/x",
};
const out = resolve(root, "checkup/emails");
mkdirSync(out, { recursive: true });
const index: string[] = [];
for (const kind of MAIL_KIND_LIST) {
  for (const lang of ["en", "bn"] as const) {
    const m = buildMail(kind, lang, sample, kind === "STAFF_INVITE" ? null : sample.storeName);
    writeFileSync(resolve(out, `${kind}.${lang}.html`), m.html);
    index.push(`<li><a href="${kind}.${lang}.html">${kind} (${lang})</a>: ${m.subject}${m.sms ? ` <small>+ SMS: ${m.sms}</small>` : ""}</li>`);
  }
}
const dir = resolve(root, "docs/email-templates");
mkdirSync(dir, { recursive: true });
for (const name of Object.keys(AUTH_MAILS) as (keyof typeof AUTH_MAILS)[]) {
  const m = buildAuthMail(name);
  writeFileSync(resolve(dir, `supabase-${name}.html`), m.html);
  writeFileSync(resolve(dir, `supabase-${name}.subject.txt`), m.subject + "\n");
  writeFileSync(resolve(out, `supabase-${name}.html`), m.html);
  index.push(`<li><a href="supabase-${name}.html">Supabase: ${name}</a>: ${m.subject}</li>`);
}
writeFileSync(resolve(out, "index.html"), `<!doctype html><meta charset="utf-8"><title>BizTrackBD emails</title><body style="font-family:sans-serif;max-width:900px;margin:24px auto"><h1>BizTrackBD emails</h1><ul>${index.join("")}</ul>`);
console.log(`Wrote ${index.length} emails to checkup/emails (open index.html) and the Supabase templates to docs/email-templates.`);
