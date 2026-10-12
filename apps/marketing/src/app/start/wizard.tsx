"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { checkAddressAction, signupAction, type SignupState } from "./actions";

interface Plan { tier: string; name: string; priceMonthly: number; blurb: string }
interface Theme { id: string; name: string; blurb: string; live: boolean }

const STEPS = ["You", "Your store", "Address", "Template and plan", "Create"] as const;
const FIELD_STEP: Record<string, number> = { ownerName: 0, email: 0, phone: 0, storeName: 1, tagline: 1, subdomain: 2, theme: 3, plan: 3 };
const taka = (n: number) => `৳ ${n.toLocaleString("en-IN")}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

export function Wizard({ plans, themes, rootDomain, initialPlan, initialTheme, keepCode = "" }: { keepCode?: string; plans: Plan[]; themes: Theme[]; rootDomain: string; initialPlan: string; initialTheme: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(signupAction, {});
  const [step, setStep] = useState(0);
  const [v, setV] = useState({ ownerName: "", email: "", phone: "", storeName: "", tagline: "", subdomain: "", plan: initialPlan, theme: initialTheme, demoData: true });
  const [touchedAddress, setTouchedAddress] = useState(false);
  const [address, setAddress] = useState<{ ok: boolean; message: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const checkId = useRef(0);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((o) => ({ ...o, [k]: val }));

  // Suggest an address from the store name until the owner types their own.
  useEffect(() => {
    if (!touchedAddress) setV((o) => ({ ...o, subdomain: slug(o.storeName) }));
  }, [v.storeName, touchedAddress]);

  // Live address check, a moment after typing stops.
  useEffect(() => {
    if (v.subdomain.length < 3) { setAddress(null); return; }
    const id = ++checkId.current;
    const t = setTimeout(async () => {
      const r = await checkAddressAction(v.subdomain).catch(() => null);
      if (id === checkId.current && r) setAddress(r);
    }, 350);
    return () => clearTimeout(t);
  }, [v.subdomain]);

  // The server refused something: go back to the step it belongs to.
  useEffect(() => {
    if (state.error && state.field && FIELD_STEP[state.field] !== undefined) setStep(FIELD_STEP[state.field]!);
  }, [state]);

  function validate(s: number): string | null {
    if (s === 0) {
      if (v.ownerName.trim().length < 2) return "Enter your name";
      if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) return "Enter a valid email address";
      if (!/^(\+?88)?01[3-9]\d{8}$/.test(v.phone.replace(/[\s-]/g, ""))) return "Enter a valid mobile number, like 01712345678";
    }
    if (s === 1 && v.storeName.trim().length < 2) return "Enter your store name";
    if (s === 2) {
      if (v.subdomain.length < 3) return "Choose an address of at least 3 letters or numbers";
      if (address && !address.ok) return address.message;
    }
    return null;
  }
  function next() {
    const p = validate(step);
    setProblem(p);
    if (!p) setStep(step + 1);
  }

  const chosenPlan = plans.find((p) => p.tier === v.plan);
  const chosenTheme = themes.find((t) => t.id === v.theme);

  return (
    <form action={action} className="wizard" data-testid="wizard" noValidate>
      <h1>Open your store</h1>
      <p className="muted">Free for 14 days. No card needed.</p>
      <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
        {STEPS.map((s, i) => <i key={s} className={i <= step ? "on" : ""} />)}
      </div>

      {/* Every value is posted from hidden fields, so the steps can be shown one at a time and nothing is lost. */}
      {Object.entries(v).map(([k, val]) => (k === "demoData" ? (val ? <input key={k} type="hidden" name={k} value="on" /> : null) : <input key={k} type="hidden" name={k} value={String(val)} />))}
      {keepCode && <input type="hidden" name="from" value={keepCode} />}
      <div className="hp" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>

      {step === 0 && (
        <div data-testid="step-you">
          <h2 style={{ fontSize: 22, marginBottom: 16 }}>Who are you?</h2>
          <label className="field"><span className="label">Your name</span><input className="input" autoComplete="name" value={v.ownerName} onChange={(e) => set("ownerName", e.target.value)} data-testid="f-ownerName" /></label>
          <label className="field"><span className="label">Email</span><input className="input" type="email" autoComplete="email" value={v.email} onChange={(e) => set("email", e.target.value)} data-testid="f-email" /><span className="hint">For your account and payment receipts.</span></label>
          <label className="field"><span className="label">Mobile number</span><input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="01712345678" value={v.phone} onChange={(e) => set("phone", e.target.value)} data-testid="f-phone" /></label>
        </div>
      )}

      {step === 1 && (
        <div data-testid="step-store">
          <h2 style={{ fontSize: 22, marginBottom: 16 }}>What is your store called?</h2>
          <label className="field"><span className="label">Store name</span><input className="input" value={v.storeName} onChange={(e) => set("storeName", e.target.value)} data-testid="f-storeName" /></label>
          <label className="field"><span className="label">One line about it <span className="hint">(optional)</span></span><input className="input" maxLength={120} placeholder="Handloom clothing from Narayanganj" value={v.tagline} onChange={(e) => set("tagline", e.target.value)} data-testid="f-tagline" /></label>
        </div>
      )}

      {step === 2 && (
        <div data-testid="step-address">
          <h2 style={{ fontSize: 22, marginBottom: 16 }}>Choose your store address</h2>
          <div className="field">
            <label className="label" htmlFor="sub">Address</label>
            <div className="addr"><input id="sub" className="input" value={v.subdomain} autoCapitalize="none" autoComplete="off" spellCheck={false} onChange={(e) => { setTouchedAddress(true); set("subdomain", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }} aria-invalid={address ? !address.ok : undefined} aria-describedby="sub-msg" data-testid="f-subdomain" /><span>.{rootDomain.replace(/:\d+$/, "")}</span></div>
            <div id="sub-msg" aria-live="polite" data-testid="address-status">{address && (address.ok ? <span className="ok">{v.subdomain}.{rootDomain.replace(/:\d+$/, "")} is available</span> : <span className="err">{address.message}</span>)}</div>
            <span className="hint">You can connect your own domain later on a paid plan.</span>
          </div>
        </div>
      )}

      {step === 3 && (
        <div data-testid="step-plan">
          <h2 style={{ fontSize: 22, marginBottom: 16 }}>Pick a template and a plan</h2>
          <fieldset className="field" style={{ border: 0, padding: 0 }}>
            <legend className="label" style={{ marginBottom: 8 }}>Template</legend>
            <div className="choice">
              {themes.map((t) => (
                <label key={t.id} className={`opt${t.live ? "" : " disabled"}`}>
                  <input type="radio" name="theme_pick" checked={v.theme === t.id} disabled={!t.live} onChange={() => set("theme", t.id)} />
                  <span><b>{t.name}</b> {!t.live && <span className="pill">Coming soon</span>}<br /><span className="muted" style={{ fontSize: 14.5 }}>{t.blurb}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="field" style={{ border: 0, padding: 0 }}>
            <legend className="label" style={{ marginBottom: 8 }}>Try this plan free for 14 days</legend>
            <div className="choice">
              {plans.map((p) => (
                <label key={p.tier} className="opt" data-testid={`pick-${p.tier}`}>
                  <input type="radio" name="plan_pick" checked={v.plan === p.tier} onChange={() => set("plan", p.tier)} />
                  <span><b>{p.name}</b> <span className="num">{taka(p.priceMonthly)} / month after the trial</span><br /><span className="muted" style={{ fontSize: 14.5 }}>{p.blurb}</span></span>
                </label>
              ))}
            </div>
            <span className="hint">You can change plan any time.</span>
          </fieldset>
        </div>
      )}

      {step === 4 && (
        <div data-testid="step-create">
          <h2 style={{ fontSize: 22, marginBottom: 16 }}>Ready to open</h2>
          <div className="card" style={{ marginBottom: 18 }}>
            <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px" }}>
              <dt className="muted">Store</dt><dd style={{ margin: 0 }}><b>{v.storeName}</b></dd>
              <dt className="muted">Address</dt><dd style={{ margin: 0 }}>{v.subdomain}.{rootDomain.replace(/:\d+$/, "")}</dd>
              <dt className="muted">Owner</dt><dd style={{ margin: 0 }}>{v.ownerName}, {v.email}</dd>
              <dt className="muted">Template</dt><dd style={{ margin: 0 }}>{chosenTheme?.name}</dd>
              <dt className="muted">Plan</dt><dd style={{ margin: 0 }}>{chosenPlan?.name}, free for 14 days</dd>
            </dl>
          </div>
          <label className="opt" style={{ marginBottom: 18 }}>
            <input type="checkbox" checked={v.demoData} onChange={(e) => set("demoData", e.target.checked)} data-testid="f-demo" />
            <span><b>Add sample products</b><br /><span className="muted" style={{ fontSize: 14.5 }}>Three sample products so you can see how your store works. Delete them any time.</span></span>
          </label>
          {state.error && <div className="notice bad" role="alert" style={{ marginBottom: 14 }} data-testid="signup-error">{state.error}</div>}
        </div>
      )}

      {problem && step < 4 && <div className="err" role="alert" style={{ marginBottom: 12 }} data-testid="step-problem">{problem}</div>}
      <div className="nav-row">
        {step > 0 && <button key="back" type="button" className="btn btn-secondary btn-lg" onClick={() => { setProblem(null); setStep(step - 1); }}>Back</button>}
        {step < 4 ? (
          <button key="next" type="button" className="btn btn-primary btn-lg" onClick={next} data-testid="next">Next</button>
        ) : (
          <button key="create" type="submit" className="btn btn-primary btn-lg" disabled={pending} data-testid="create">{pending ? "Creating your store…" : "Open my store"}</button>
        )}
      </div>
      <p className="hint" style={{ marginTop: 18 }}>By opening a store you agree to use it lawfully. We never hold your customers' money.</p>
    </form>
  );
}
