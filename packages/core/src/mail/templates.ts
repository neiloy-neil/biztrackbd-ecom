import { renderMail, type MailBody, type MailLang } from "./layout";

/**
 * Every email the platform sends to a store owner or a new team member, in English and Bangla (docs/44). A template is a function
 * from the facts of the moment to words; `renderMail` gives them the shared look. The urgent ones also have a short text message.
 */

export type MailKind =
  | "WELCOME" | "STAFF_INVITE" | "TRIAL_ENDING" | "RENEWAL_DUE" | "PAYMENT_APPROVED" | "PAYMENT_REJECTED"
  | "PAYMENT_OVERDUE" | "READ_ONLY_STARTED" | "LOCKED" | "TICKET_REPLY" | "SIGN_IN_CODE";

export interface MailVars {
  storeName: string;
  ownerName?: string;
  storeUrl?: string;
  adminUrl?: string;
  billingUrl?: string;
  trialEnds?: string;
  inviterName?: string;
  roleLabel?: string;
  link?: string;
  expires?: string;
  daysLeft?: number | null;
  plan?: string;
  paidUntil?: string;
  reason?: string;
  ticketCode?: string;
  excerpt?: string;
  ticketUrl?: string;
  /** The one-time sign-in code. */
  code?: string;
  /** Say it in English and Bangla together (when the person's language is not known). */
  both?: boolean;
}

export interface MailOut { subject: string; body: MailBody; sms?: string }

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
const days = (lang: MailLang, n: number) => (lang === "bn" ? `${bn(n)} দিন` : `${n} ${n === 1 ? "day" : "days"}`);

/** The kinds that also send a short text message, because missing them can take a store offline. */
export const URGENT_KINDS: MailKind[] = ["TRIAL_ENDING", "RENEWAL_DUE", "PAYMENT_OVERDUE", "READ_ONLY_STARTED", "LOCKED"];

type Builder = (lang: MailLang, v: MailVars) => MailOut;

const first = (name?: string) => (name ?? "").trim().split(/\s+/)[0] ?? "";

export const MAIL: Record<MailKind, Builder> = {
  WELCOME: (lang, v) => lang === "bn"
    ? { subject: `${v.storeName} খোলা হয়েছে: স্বাগতম BizTrackBD-তে`, body: { lang, preheader: "আপনার স্টোর চালু। প্রথম পণ্য যোগ করুন।", heading: `স্বাগতম${first(v.ownerName) ? `, ${first(v.ownerName)}` : ""}`,
        paragraphs: [`আপনার স্টোর ${v.storeName} চালু হয়েছে। ফ্রি ট্রায়ালে সব কিছু ব্যবহার করে দেখতে পারবেন, কার্ড লাগবে না।`, "প্রথমে কয়েকটি পণ্য যোগ করুন, ডেলিভারি চার্জ ঠিক করুন, তারপর আপনার লিংক শেয়ার করুন।"],
        facts: [{ label: "আপনার স্টোরের ঠিকানা", value: v.storeUrl ?? "" }, ...(v.trialEnds ? [{ label: "ফ্রি ট্রায়াল চলবে", value: v.trialEnds }] : [])],
        button: { text: "অ্যাডমিনে যান", url: v.adminUrl ?? "" } } }
    : { subject: `${v.storeName} is open: welcome to BizTrackBD`, body: { lang, preheader: "Your store is live. Add your first products.", heading: `Welcome${first(v.ownerName) ? `, ${first(v.ownerName)}` : ""}`,
        paragraphs: [`Your store ${v.storeName} is open. The free trial lets you use everything, and no card is needed.`, "Start by adding a few products, set your delivery charges, then share your link."],
        facts: [{ label: "Your store address", value: v.storeUrl ?? "" }, ...(v.trialEnds ? [{ label: "Free trial runs until", value: v.trialEnds }] : [])],
        button: { text: "Open my admin", url: v.adminUrl ?? "" } } },

  STAFF_INVITE: (lang, v) => lang === "bn"
    ? { subject: `${v.inviterName ?? "একজন"} আপনাকে ${v.storeName}-এ আমন্ত্রণ জানিয়েছে`, body: { lang, preheader: `${v.storeName}-এর টিমে যোগ দিন।`, heading: "আপনাকে টিমে আমন্ত্রণ জানানো হয়েছে",
        paragraphs: [`${v.inviterName ?? "স্টোরের মালিক"} আপনাকে ${v.storeName}-এর টিমে ${v.roleLabel ?? "সদস্য"} হিসেবে যোগ দিতে বলেছেন।`],
        ...(v.expires ? { facts: [{ label: "এই লিংক চলবে", value: v.expires }] } : {}), button: { text: "আমন্ত্রণ গ্রহণ করুন", url: v.link ?? "" },
        note: "আপনি এটি আশা না করলে এই মেইল উপেক্ষা করুন। লিংকটি কারও সাথে শেয়ার করবেন না।" } }
    : { subject: `${v.inviterName ?? "Someone"} invited you to ${v.storeName}`, body: { lang, preheader: `Join the ${v.storeName} team.`, heading: "You have been invited to a team",
        paragraphs: [`${v.inviterName ?? "The store owner"} asked you to join the ${v.storeName} team as ${v.roleLabel ?? "a team member"}.`],
        ...(v.expires ? { facts: [{ label: "This link works until", value: v.expires }] } : {}), button: { text: "Accept the invitation", url: v.link ?? "" },
        note: "If you were not expecting this, ignore this email. Do not share the link with anyone." } },

  TRIAL_ENDING: (lang, v) => {
    const n = v.daysLeft ?? 3;
    return lang === "bn"
      ? { subject: `${v.storeName}: ফ্রি ট্রায়াল শেষ হতে ${days(lang, n)} বাকি`, body: { lang, preheader: "প্ল্যান বেছে নিন, স্টোর চালু থাকবে।", heading: `ট্রায়াল শেষ হতে ${days(lang, n)} বাকি`,
          paragraphs: ["ট্রায়াল শেষ হলে একটি প্ল্যান না নিলে আপনার স্টোর অফলাইন হয়ে যাবে। আপনার পণ্য ও অর্ডার নিরাপদ থাকবে।", "bKash বা Nagad-এ প্ল্যানের টাকা পাঠিয়ে TrxID দিন। আমরা কয়েক ঘণ্টার মধ্যে যাচাই করি।"],
          button: { text: "প্ল্যান বেছে নিন", url: v.billingUrl ?? "" } }, ...(n <= 1 ? { sms: `${v.storeName}: ফ্রি ট্রায়াল কাল শেষ। স্টোর চালু রাখতে প্ল্যান নিন: ${v.billingUrl ?? ""}` } : {}) }
      : { subject: `${v.storeName}: your free trial ends in ${days(lang, n)}`, body: { lang, preheader: "Choose a plan to keep your store online.", heading: `Your trial ends in ${days(lang, n)}`,
          paragraphs: ["When the trial ends your store goes offline unless you have a plan. Your products and orders stay safe.", "Send the plan price by bKash or Nagad and enter the TrxID. We check it within a few hours."],
          button: { text: "Choose a plan", url: v.billingUrl ?? "" } }, ...(n <= 1 ? { sms: `${v.storeName}: your free trial ends tomorrow. Choose a plan to keep your store online: ${v.billingUrl ?? ""}` } : {}) };
  },

  RENEWAL_DUE: (lang, v) => {
    const n = v.daysLeft ?? 3;
    return lang === "bn"
      ? { subject: `${v.storeName}: প্ল্যান নবায়নের সময় ${days(lang, n)} পরে`, body: { lang, preheader: "আগে থেকে পাঠিয়ে দিন, স্টোর চালু থাকবে।", heading: `প্ল্যান ${days(lang, n)} পরে শেষ হবে`,
          paragraphs: ["শেষ হওয়ার আগে পরের মাসের টাকা পাঠালে স্টোর কোনো বিরতি ছাড়া চলবে। বাকি সময় যোগ হয়ে যাবে, কিছু হারাবে না।"], button: { text: "টাকা পাঠান", url: v.billingUrl ?? "" } },
        ...(n <= 1 ? { sms: `${v.storeName}: প্ল্যান কাল শেষ। নবায়ন করুন: ${v.billingUrl ?? ""}` } : {}) }
      : { subject: `${v.storeName}: your plan renews in ${days(lang, n)}`, body: { lang, preheader: "Pay ahead and your store never goes offline.", heading: `Your plan ends in ${days(lang, n)}`,
          paragraphs: ["Pay before it ends and your store runs without a break. Any time left is added on, so you lose nothing."], button: { text: "Send payment", url: v.billingUrl ?? "" } },
        ...(n <= 1 ? { sms: `${v.storeName}: your plan ends tomorrow. Renew: ${v.billingUrl ?? ""}` } : {}) };
  },

  PAYMENT_APPROVED: (lang, v) => lang === "bn"
    ? { subject: `${v.storeName}: পেমেন্ট নিশ্চিত, ${v.plan ?? ""} প্ল্যান চালু`, body: { lang, preheader: "ধন্যবাদ। আপনার প্ল্যান চালু হয়েছে।", heading: "পেমেন্ট নিশ্চিত হয়েছে",
        paragraphs: ["ধন্যবাদ। আপনার পেমেন্ট যাচাই হয়েছে এবং প্ল্যান চালু হয়ে গেছে।"], facts: [...(v.plan ? [{ label: "প্ল্যান", value: v.plan }] : []), ...(v.paidUntil ? [{ label: "চালু থাকবে", value: v.paidUntil }] : [])],
        button: { text: "অ্যাডমিনে যান", url: v.adminUrl ?? "" } } }
    : { subject: `${v.storeName}: payment confirmed, ${v.plan ?? ""} plan is on`, body: { lang, preheader: "Thank you. Your plan is active.", heading: "Payment confirmed",
        paragraphs: ["Thank you. Your payment was checked and your plan is now active."], facts: [...(v.plan ? [{ label: "Plan", value: v.plan }] : []), ...(v.paidUntil ? [{ label: "Active until", value: v.paidUntil }] : [])],
        button: { text: "Open my admin", url: v.adminUrl ?? "" } } },

  PAYMENT_REJECTED: (lang, v) => lang === "bn"
    ? { subject: `${v.storeName}: আপনার পেমেন্ট যাচাই করা যায়নি`, body: { lang, preheader: "আবার সঠিক TrxID দিন।", heading: "পেমেন্ট যাচাই করা যায়নি",
        paragraphs: ["আপনার পাঠানো পেমেন্ট আমরা খুঁজে পাইনি বা তথ্য মেলেনি।", "টাকা পাঠিয়ে থাকলে bKash বা Nagad অ্যাপে TrxID ও পরিমাণ দেখে আবার পাঠান।"], facts: [{ label: "কারণ", value: v.reason ?? "" }],
        button: { text: "আবার পাঠান", url: v.billingUrl ?? "" } } }
    : { subject: `${v.storeName}: we could not confirm your payment`, body: { lang, preheader: "Please check the TrxID and send it again.", heading: "We could not confirm your payment",
        paragraphs: ["We could not find the payment you sent, or the details did not match.", "If you did send money, check the TrxID and the amount in your bKash or Nagad app and submit it again."], facts: [{ label: "Reason", value: v.reason ?? "" }],
        button: { text: "Send it again", url: v.billingUrl ?? "" } } },

  PAYMENT_OVERDUE: (lang, v) => lang === "bn"
    ? { subject: `${v.storeName}: প্ল্যানের টাকা বাকি, স্টোর শিগগির অফলাইন হবে`, body: { lang, preheader: "৩ দিনের মধ্যে টাকা না পাঠালে স্টোর অফলাইন হবে।", heading: "প্ল্যানের মেয়াদ শেষ হয়েছে",
        paragraphs: ["আপনার প্ল্যান শেষ হয়েছে। আরও ৩ দিন সবকিছু চলবে, তারপর স্টোর অফলাইন ও অ্যাডমিন শুধু দেখার জন্য হয়ে যাবে।", "টাকা পাঠালেই সব আগের মতো চালু হবে। কোনো তথ্য হারাবে না।"], button: { text: "এখনই টাকা পাঠান", url: v.billingUrl ?? "" } },
        sms: `${v.storeName}: প্ল্যান শেষ। ৩ দিনের মধ্যে টাকা পাঠান, নাহলে স্টোর অফলাইন হবে: ${v.billingUrl ?? ""}` }
    : { subject: `${v.storeName}: plan payment is due, your store will go offline soon`, body: { lang, preheader: "Pay within 3 days to keep your store online.", heading: "Your plan has ended",
        paragraphs: ["Your plan has ended. Everything keeps working for 3 more days, then your store goes offline and your admin becomes read-only.", "Paying brings everything back as it was. Nothing is lost."], button: { text: "Send payment now", url: v.billingUrl ?? "" } },
        sms: `${v.storeName}: your plan has ended. Pay within 3 days or your store goes offline: ${v.billingUrl ?? ""}` },

  READ_ONLY_STARTED: (lang, v) => lang === "bn"
    ? { subject: `${v.storeName}: স্টোর এখন অফলাইন`, body: { lang, preheader: "গ্রাহকরা এখন অর্ডার দিতে পারছেন না।", heading: "আপনার স্টোর এখন অফলাইন",
        paragraphs: ["টাকা না আসায় স্টোর অফলাইন হয়েছে এবং আপনার অ্যাডমিন এখন শুধু দেখার জন্য। গ্রাহকরা অর্ডার দিতে পারছেন না।", "টাকা পাঠালে আমরা যাচাই করার পরেই সব চালু হয়ে যাবে।"], button: { text: "টাকা পাঠান", url: v.billingUrl ?? "" } },
        sms: `${v.storeName}: স্টোর অফলাইন হয়েছে। চালু করতে টাকা পাঠান: ${v.billingUrl ?? ""}` }
    : { subject: `${v.storeName}: your store is offline`, body: { lang, preheader: "Customers cannot place orders right now.", heading: "Your store is offline",
        paragraphs: ["Because payment has not arrived, your store is offline and your admin is read-only. Customers cannot place orders.", "Send payment and it all comes back once we have checked it."], button: { text: "Send payment", url: v.billingUrl ?? "" } },
        sms: `${v.storeName}: your store is offline. Send payment to bring it back: ${v.billingUrl ?? ""}` },

  LOCKED: (lang, v) => lang === "bn"
    ? { subject: `${v.storeName}: অ্যাডমিন লক হয়েছে`, body: { lang, preheader: "শুধু বিলিং পাতা খোলা আছে। আপনার তথ্য নিরাপদ।", heading: "আপনার অ্যাডমিন লক হয়েছে",
        paragraphs: ["অনেকদিন টাকা না আসায় অ্যাডমিন লক হয়েছে। শুধু বিলিং পাতা খোলা আছে।", "আপনার পণ্য, অর্ডার ও গ্রাহকের তথ্য নিরাপদে আছে। টাকা পাঠালে সব ফিরে আসবে।"], button: { text: "বিলিং খুলুন", url: v.billingUrl ?? "" } },
        sms: `${v.storeName}: অ্যাডমিন লক হয়েছে। তথ্য নিরাপদ। টাকা পাঠিয়ে খুলুন: ${v.billingUrl ?? ""}` }
    : { subject: `${v.storeName}: your admin is locked`, body: { lang, preheader: "Only billing is open. Your data is safe.", heading: "Your admin is locked",
        paragraphs: ["Because payment has been missing for a long time, your admin is locked and only the billing page is open.", "Your products, orders and customers are safe. Paying brings everything back."], button: { text: "Open billing", url: v.billingUrl ?? "" } },
        sms: `${v.storeName}: your admin is locked. Your data is safe. Pay to unlock: ${v.billingUrl ?? ""}` },

  // The code is the same words whichever page asked; when the language is not known the email says it in both.
  SIGN_IN_CODE: (lang, v) => {
    const en = ["Type this code to continue. It works once, for a short time. Never share it with anyone."];
    const bnp = ["এই কোডটি লিখে এগিয়ে যান। এটি একবারই কাজ করবে, অল্প সময়ের জন্য। কাউকে কোডটি বলবেন না।"];
    const wide = v.both === true;
    const l: MailLang = lang;
    return {
      subject: l === "bn" && !wide ? `আপনার BizTrackBD কোড: ${v.code}` : wide ? `Your BizTrackBD code: ${v.code} | আপনার কোড` : `Your BizTrackBD code: ${v.code}`,
      body: {
        lang: l, preheader: l === "bn" && !wide ? "আপনার এককালীন কোড।" : "Your one-time code.",
        heading: wide ? "Your sign-in code | আপনার সাইন-ইন কোড" : l === "bn" ? "আপনার সাইন-ইন কোড" : "Your sign-in code",
        paragraphs: wide ? [...en, ...bnp] : l === "bn" ? bnp : en,
        facts: [{ label: wide ? "Code | কোড" : l === "bn" ? "কোড" : "Code", value: v.code ?? "" }],
        note: wide ? "If you did not ask for this, ignore this email. | আপনি না চেয়ে থাকলে উপেক্ষা করুন।" : l === "bn" ? "আপনি না চেয়ে থাকলে এই মেইল উপেক্ষা করুন।" : "If you did not ask for this, ignore this email.",
      },
    };
  },

  TICKET_REPLY: (lang, v) => lang === "bn"
    ? { subject: `সাপোর্টের উত্তর: ${v.ticketCode ?? ""}`, body: { lang, preheader: "আপনার সাপোর্ট অনুরোধে উত্তর এসেছে।", heading: "আপনার সাপোর্ট অনুরোধে উত্তর এসেছে",
        paragraphs: [v.excerpt ?? ""], facts: [...(v.ticketCode ? [{ label: "অনুরোধ", value: v.ticketCode }] : [])], button: { text: "উত্তর দেখুন", url: v.ticketUrl ?? "" } } }
    : { subject: `Reply from support: ${v.ticketCode ?? ""}`, body: { lang, preheader: "Support replied to your request.", heading: "Support replied to your request",
        paragraphs: [v.excerpt ?? ""], facts: [...(v.ticketCode ? [{ label: "Request", value: v.ticketCode }] : [])], button: { text: "Read the reply", url: v.ticketUrl ?? "" } } },
};

export const MAIL_KIND_LIST = Object.keys(MAIL) as MailKind[];

/** One email, ready to send: subject, HTML and plain text, plus the short text message when the kind has one. */
export function buildMail(kind: MailKind, lang: MailLang | "both", v: MailVars, storeName: string | null = v.storeName): { subject: string; html: string; text: string; sms?: string } {
  const wide = lang === "both";
  const out = MAIL[kind](wide ? "en" : lang, wide ? { ...v, both: true } : v);
  const { html, text } = renderMail(out.body, storeName);
  return { subject: out.subject.replace(/\s+/g, " ").replace(/:\s*,/g, ",").trim(), html, text, ...(out.sms ? { sms: out.sms } : {}) };
}

// ---- The emails Supabase Auth sends (sign-in codes, confirmation, password reset) ---------------------------------------------------------
// Supabase fills in the code and links itself, so these are written once with its placeholders and pasted into Supabase's dashboard
// (Authentication, Email Templates). It cannot tell which language the person uses, so each is in English and Bangla together.

export type AuthMailName = "sign-in-code" | "confirm-signup" | "reset-password" | "change-email" | "reauthentication";

const CODE = "{{ .Token }}";
const LINK = "{{ .ConfirmationURL }}";

export const AUTH_MAILS: Record<AuthMailName, { subject: string; body: MailBody }> = {
  "sign-in-code": {
    subject: "Your BizTrackBD code: {{ .Token }} | আপনার BizTrackBD কোড",
    body: { lang: "en", preheader: "Your one-time code. It works for a few minutes.", heading: "Your sign-in code | আপনার সাইন-ইন কোড",
      paragraphs: ["Type this code to continue. It works once, for a few minutes. Never share it with anyone.", "এই কোডটি লিখে এগিয়ে যান। এটি একবারই কাজ করবে, কয়েক মিনিটের জন্য। কাউকে কোডটি বলবেন না।"],
      facts: [{ label: "Code | কোড", value: CODE }], note: "If you did not ask for this, ignore this email. | আপনি না চেয়ে থাকলে এই মেইল উপেক্ষা করুন।" },
  },
  "confirm-signup": {
    subject: "Confirm your email | আপনার ইমেইল নিশ্চিত করুন",
    body: { lang: "en", preheader: "One tap to confirm your email address.", heading: "Confirm your email | ইমেইল নিশ্চিত করুন",
      paragraphs: ["Tap the button to confirm that this email address is yours.", "এই ইমেইল ঠিকানাটি আপনার, তা নিশ্চিত করতে নিচের বোতামে চাপুন।"],
      button: { text: "Confirm | নিশ্চিত করুন", url: LINK }, note: "If you did not create a BizTrackBD account, ignore this email. | আপনি অ্যাকাউন্ট না খুলে থাকলে এই মেইল উপেক্ষা করুন।" },
  },
  "reset-password": {
    subject: "Your BizTrackBD password code: {{ .Token }} | পাসওয়ার্ড কোড",
    body: { lang: "en", preheader: "Use this code to choose a new password.", heading: "Choose a new password | নতুন পাসওয়ার্ড দিন",
      paragraphs: ["Type this code on the sign-in page, then choose a new password.", "সাইন-ইন পাতায় এই কোডটি লিখুন, তারপর নতুন পাসওয়ার্ড দিন।"],
      facts: [{ label: "Code | কোড", value: CODE }], note: "If you did not ask for this, ignore this email and your password stays as it is. | আপনি না চেয়ে থাকলে উপেক্ষা করুন, আপনার পাসওয়ার্ড আগের মতোই থাকবে।" },
  },
  "change-email": {
    subject: "Confirm your new email | নতুন ইমেইল নিশ্চিত করুন",
    body: { lang: "en", preheader: "Confirm the change of your sign-in email.", heading: "Confirm your new email | নতুন ইমেইল নিশ্চিত করুন",
      paragraphs: ["Tap the button to use this address to sign in from now on.", "এখন থেকে সাইন-ইনের জন্য এই ঠিকানা ব্যবহার করতে নিচের বোতামে চাপুন।"],
      button: { text: "Confirm | নিশ্চিত করুন", url: LINK }, note: "If you did not ask for this, do not tap the button and change your password. | আপনি না চেয়ে থাকলে বোতামে চাপবেন না, পাসওয়ার্ড বদলে ফেলুন।" },
  },
  reauthentication: {
    subject: "Your BizTrackBD confirmation code: {{ .Token }} | নিশ্চিতকরণ কোড",
    body: { lang: "en", preheader: "Confirm it is you.", heading: "Confirm it is you | নিশ্চিত করুন এটি আপনি",
      paragraphs: ["Type this code to confirm the change you are making.", "আপনি যে পরিবর্তন করছেন তা নিশ্চিত করতে এই কোডটি লিখুন।"],
      facts: [{ label: "Code | কোড", value: CODE }] },
  },
};

/** The HTML to paste into one of Supabase's email templates, with its subject line. */
export function buildAuthMail(name: AuthMailName): { subject: string; html: string } {
  const m = AUTH_MAILS[name];
  return { subject: m.subject, html: renderMail(m.body, null).html };
}

/** For tests: every Supabase template, rendered. */
export function authMailsForTests(): Record<AuthMailName, { subject: string; html: string }> {
  return Object.fromEntries((Object.keys(AUTH_MAILS) as AuthMailName[]).map((n) => [n, buildAuthMail(n)])) as Record<AuthMailName, { subject: string; html: string }>;
}
