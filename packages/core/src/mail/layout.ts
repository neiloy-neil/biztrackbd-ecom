/**
 * The look shared by every email BizTrackBD sends (docs/44). Plain tables and inline styles, because mail apps ignore most CSS.
 * Everything a person typed (a store name, a reason) goes through `esc` before it reaches the page.
 */

export type MailLang = "en" | "bn";

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const FONT = `'Plus Jakarta Sans','Hind Siliguri','Noto Sans Bengali','Segoe UI',Helvetica,Arial,sans-serif`;

export interface MailBody {
  lang: MailLang;
  /** The line mail apps show next to the subject. */
  preheader: string;
  heading: string;
  /** Each is one paragraph of plain text (escaped here). */
  paragraphs: string[];
  /** Small facts shown in a box under the text: label and value. */
  facts?: { label: string; value: string }[];
  button?: { text: string; url: string };
  /** A quieter paragraph after the button. */
  note?: string;
}

const FOOT: Record<MailLang, { why: (store: string) => string; help: string; auto: string }> = {
  en: {
    why: (s) => `You are getting this because you own ${s} on BizTrackBD.`,
    help: "This message is sent automatically and replies are not read. For help, open Help in your admin.",
    auto: "BizTrackBD · Online store software for Bangladesh",
  },
  bn: {
    why: (s) => `আপনি এই মেইল পাচ্ছেন কারণ আপনি BizTrackBD-তে ${s}-এর মালিক।`,
    help: "এই বার্তা নিজে থেকে পাঠানো হয়েছে, উত্তর পড়া হয় না। সাহায্য লাগলে আপনার অ্যাডমিনে Help খুলুন।",
    auto: "BizTrackBD · বাংলাদেশের অনলাইন স্টোর সফটওয়্যার",
  },
};

export function renderMail(b: MailBody, storeName: string | null): { html: string; text: string } {
  const f = FOOT[b.lang];
  const paras = b.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#3A3A63">${esc(p)}</p>`).join("");
  const facts = b.facts?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;background:#F4F3FF;border-radius:12px"><tr><td style="padding:14px 18px">${b.facts
        .map((x) => `<div style="font-size:13px;color:#6B6B8D;margin-top:6px">${esc(x.label)}</div><div style="font-size:16px;font-weight:700;color:#1A1A4E">${esc(x.value)}</div>`)
        .join("")}</td></tr></table>`
    : "";
  const button = b.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px"><tr><td style="background:#5B4FE8;border-radius:12px"><a href="${esc(b.button.url)}" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none">${esc(b.button.text)}</a></td></tr></table>`
    : "";
  const note = b.note ? `<p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#6B6B8D">${esc(b.note)}</p>` : "";
  const html = `<!doctype html><html lang="${b.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(b.heading)}</title></head>
<body style="margin:0;padding:0;background:#EFEFF6;font-family:${FONT}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(b.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFEFF6"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 14px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="background:#5B4FE8;border-radius:10px;width:36px;height:36px;text-align:center;font-size:20px;font-weight:800;color:#FFFFFF;line-height:36px">B</td>
<td style="padding-left:10px;font-size:18px;font-weight:800;color:#1A1A4E">BizTrackBD</td></tr></table></td></tr>
<tr><td style="background:#FFFFFF;border-radius:16px;padding:28px 26px;border:1px solid #E7E7F0">
<h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#1A1A4E;letter-spacing:-0.3px">${esc(b.heading)}</h1>
${paras}${facts}${button}${note}
</td></tr>
<tr><td style="padding:16px 8px;font-size:12.5px;line-height:1.6;color:#6B6B8D">${storeName ? esc(f.why(storeName)) + "<br>" : ""}${esc(f.help)}<br>${esc(f.auto)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    b.heading, "", ...b.paragraphs, ...(b.facts?.length ? ["", ...b.facts.map((x) => `${x.label}: ${x.value}`)] : []),
    ...(b.button ? ["", `${b.button.text}: ${b.button.url}`] : []), ...(b.note ? ["", b.note] : []), "", "--", storeName ? f.why(storeName) : "", f.help,
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  return { html, text };
}
