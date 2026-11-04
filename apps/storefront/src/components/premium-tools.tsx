"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/**
 * The premium tools: small working pieces that come with the premium themes. Plain values come in (the server has already picked the
 * language and cleaned the settings), nothing here touches the database, and every control is a real button or field with a visible label.
 */

const taka = (n: number) => `৳ ${Math.round(n).toLocaleString("en-IN")}`;

// ---- Size chart with a size finder -----------------------------------------------------------------------------------------------

export interface SizeRow { size: string; chest: number; waist: number; length: number }

export function SizeChart({ title, hint, rows, lang }: { title: string; hint: string; rows: SizeRow[]; lang: "bn" | "en" }) {
  const [chest, setChest] = useState("");
  const sorted = useMemo(() => [...rows].sort((a, b) => a.chest - b.chest), [rows]);
  const n = Number(chest);
  // The smallest size whose chest is at least the shopper's; larger than every size gets the largest.
  const match = n >= 20 ? (sorted.find((r) => r.chest >= n) ?? sorted[sorted.length - 1]) : undefined;
  const th = lang === "bn" ? { size: "সাইজ", chest: "বুক", waist: "কোমর", length: "দৈর্ঘ্য", unit: "ইঞ্চি", yours: "আপনার সাইজ", findLabel: "বুকের মাপ (ইঞ্চি)" } : { size: "Size", chest: "Chest", waist: "Waist", length: "Length", unit: "inches", yours: "Your size", findLabel: "Chest (inches)" };
  return (
    <div className="wrap" data-testid="size-chart">
      <section className="section pt-card">
        <h2>{title}</h2>
        <label className="pt-find">
          <span>{hint || th.findLabel}</span>
          <input className="input" inputMode="decimal" placeholder="38" value={chest} onChange={(e) => setChest(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))} aria-label={th.findLabel} data-testid="size-chest" />
        </label>
        <p className="pt-result" role="status" aria-live="polite" data-testid="size-result">{match ? <>{th.yours}: <b>{match.size}</b></> : " "}</p>
        <div className="pt-scroll">
          <table className="pt-table">
            <caption className="sr-only">{title} ({th.unit})</caption>
            <thead><tr><th scope="col">{th.size}</th><th scope="col">{th.chest}</th><th scope="col">{th.waist}</th><th scope="col">{th.length}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.size} data-match={match?.size === r.size ? "true" : undefined}>
                  <th scope="row">{r.size}</th><td>{r.chest}</td><td>{r.waist}</td><td>{r.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---- Instalment calculator -------------------------------------------------------------------------------------------------------

export function InstalmentCalc({ title, note, price, months, fee, lang }: { title: string; note: string; price: number; months: number[]; fee: number; lang: "bn" | "en" }) {
  const [m, setM] = useState(months[Math.min(1, months.length - 1)] ?? months[0] ?? 3);
  const total = price * (1 + fee / 100);
  const per = Math.ceil(total / m);
  const t = lang === "bn" ? { per: "প্রতি মাসে", total: "মোট", months: "মাস", fee: "ফিসহ" } : { per: "per month", total: "Total", months: "months", fee: "incl. fee" };
  return (
    <div className="wrap" data-testid="instalment-calc">
      <section className="section pt-card">
        <h2>{title}</h2>
        <div className="pt-months" role="group" aria-label={t.months}>
          {months.map((x) => <button key={x} type="button" className="pt-chip" aria-pressed={x === m} onClick={() => setM(x)} data-testid={`inst-${x}`}>{x} {t.months}</button>)}
        </div>
        <p className="pt-big" aria-live="polite"><b data-testid="inst-per">{taka(per)}</b> <span>{t.per}</span></p>
        <p className="pt-sub">{t.total} {taka(total)}{fee > 0 ? ` (${t.fee} ${fee}%)` : ""}</p>
        {note && <p className="pt-sub">{note}</p>}
      </section>
    </div>
  );
}

// ---- Shade finder ----------------------------------------------------------------------------------------------------------------

export interface Shade { name: string; tone: string; undertone: string; hex: string; link: string }

const TONES = ["fair", "light", "medium", "tan", "deep"] as const;
const UNDERTONES = ["warm", "cool", "neutral"] as const;
const LABEL: Record<"bn" | "en", Record<string, string>> = {
  en: { fair: "Fair", light: "Light", medium: "Medium", tan: "Tan", deep: "Deep", warm: "Warm", cool: "Cool", neutral: "Neutral", tone: "Skin tone", under: "Undertone", match: "Your shades", near: "Closest shades", none: "Pick a skin tone and undertone", view: "View" },
  bn: { fair: "ফর্সা", light: "হালকা", medium: "মাঝারি", tan: "তামাটে", deep: "গাঢ়", warm: "উষ্ণ", cool: "শীতল", neutral: "নিরপেক্ষ", tone: "ত্বকের রঙ", under: "আন্ডারটোন", match: "আপনার শেড", near: "সবচেয়ে কাছের শেড", none: "ত্বকের রঙ ও আন্ডারটোন বেছে নিন", view: "দেখুন" },
};

export function ShadeFinder({ title, hint, shades, lang }: { title: string; hint: string; shades: Shade[]; lang: "bn" | "en" }) {
  const [tone, setTone] = useState("");
  const [under, setUnder] = useState("");
  const L = LABEL[lang];
  const exact = shades.filter((s) => s.tone === tone && (!under || s.undertone === under));
  // Nothing exact: the shades of the same tone, so the shopper is never left with an empty answer.
  const near = exact.length === 0 && tone ? shades.filter((s) => s.tone === tone) : [];
  const shown = exact.length > 0 ? exact : near;
  return (
    <div className="wrap" data-testid="shade-finder">
      <section className="section pt-card">
        <h2>{title}</h2>
        {hint && <p className="pt-sub">{hint}</p>}
        <div className="pt-group" role="group" aria-label={L.tone}>
          <span className="pt-label">{L.tone}</span>
          {TONES.map((x) => <button key={x} type="button" className="pt-chip" aria-pressed={tone === x} onClick={() => setTone(x)} data-testid={`tone-${x}`}>{L[x]}</button>)}
        </div>
        <div className="pt-group" role="group" aria-label={L.under}>
          <span className="pt-label">{L.under}</span>
          {UNDERTONES.map((x) => <button key={x} type="button" className="pt-chip" aria-pressed={under === x} onClick={() => setUnder(under === x ? "" : x)} data-testid={`under-${x}`}>{L[x]}</button>)}
        </div>
        <div aria-live="polite" data-testid="shade-result">
          {!tone ? <p className="pt-sub">{L.none}</p> : <p className="pt-result">{exact.length > 0 ? L.match : L.near}</p>}
          <ul className="pt-shades">
            {shown.map((s) => (
              <li key={s.name}>
                <span className="pt-dot" style={{ background: s.hex }} aria-hidden="true" />
                <span><b>{s.name}</b><br /><span className="pt-sub">{L[s.tone]} · {L[s.undertone]}</span></span>
                {s.link && <Link href={s.link} className="btn btn-ghost btn-round pt-view">{L.view}</Link>}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

// ---- Delivery slot and weekly repeat ---------------------------------------------------------------------------------------------

export const DELIVERY_KEY = "bt-delivery-pref";
export interface DeliveryPref { date: string; slot: string; repeat: boolean }

function readPref(): DeliveryPref | null {
  try {
    const raw = window.localStorage.getItem(DELIVERY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<DeliveryPref>;
    return typeof p.date === "string" && typeof p.slot === "string" ? { date: p.date.slice(0, 40), slot: p.slot.slice(0, 60), repeat: p.repeat === true } : null;
  } catch {
    return null;
  }
}

/** What the checkout adds to the front of the order note, or "" when the shopper chose nothing. Safe to call anywhere in the browser. */
export function deliveryNote(): string {
  if (typeof window === "undefined") return "";
  const p = readPref();
  if (!p) return "";
  return `[Delivery: ${p.date}, ${p.slot}${p.repeat ? ", repeat weekly" : ""}]`;
}

export function DeliverySlot({ title, morning, evening, days, repeat, repeatLabel, lang }: { title: string; morning: string; evening: string; days: number; repeat: boolean; repeatLabel: string; lang: "bn" | "en" }) {
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [again, setAgain] = useState(false);
  const [ready, setReady] = useState(false);
  // Dates are worked out in the browser (Dhaka's calendar day), starting tomorrow when it is already evening.
  const options = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now.getTime() + (i + (now.getHours() >= 17 ? 1 : 0)) * 86_400_000);
      out.push({ value: d.toISOString().slice(0, 10), label: new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", month: "short" }).format(d) });
    }
    return out;
  }, [days, lang]);
  useEffect(() => {
    const p = readPref();
    if (p) { setDate(p.date); setSlot(p.slot); setAgain(p.repeat); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      if (date && slot) window.localStorage.setItem(DELIVERY_KEY, JSON.stringify({ date, slot, repeat: again }));
      else window.localStorage.removeItem(DELIVERY_KEY);
    } catch { /* storage can be blocked; the choice then only lasts on this page */ }
  }, [date, slot, again, ready]);
  const t = lang === "bn" ? { day: "দিন", slot: "সময়", saved: "ঠিক আছে, চেকআউটে আপনার অর্ডারের সঙ্গে যাবে" } : { day: "Day", slot: "Time", saved: "Saved. It goes with your order at checkout" };
  return (
    <div className="wrap" data-testid="delivery-slot">
      <section className="section pt-card">
        <h2>{title}</h2>
        <div className="pt-group" role="group" aria-label={t.day}>
          <span className="pt-label">{t.day}</span>
          {options.map((o) => <button key={o.value} type="button" className="pt-chip" aria-pressed={date === o.label} onClick={() => setDate(o.label)} data-testid={`day-${o.value}`}>{o.label}</button>)}
        </div>
        <div className="pt-group" role="group" aria-label={t.slot}>
          <span className="pt-label">{t.slot}</span>
          {[morning, evening].map((x) => <button key={x} type="button" className="pt-chip" aria-pressed={slot === x} onClick={() => setSlot(x)} data-testid={x === morning ? "slot-morning" : "slot-evening"}>{x}</button>)}
        </div>
        {repeat && (
          <label className="pt-check">
            <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} data-testid="repeat-weekly" />
            <span>{repeatLabel}</span>
          </label>
        )}
        {date && slot && <p className="pt-result" role="status" data-testid="slot-saved">{t.saved}: {date}, {slot}{again ? (lang === "bn" ? ", প্রতি সপ্তাহে" : ", every week") : ""}</p>}
      </section>
    </div>
  );
}
