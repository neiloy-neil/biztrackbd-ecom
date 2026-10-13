"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { checkAddressAction, confirmEmailAction, sendCodeAction, signupAction, type SignupState } from "./actions";

interface Plan {
  tier: string;
  name: string;
  priceMonthly: number;
  blurb: string;
}

interface Theme {
  id: string;
  name: string;
  blurb: string;
  live: boolean;
}

const STEPS = ["You", "Your store", "Address", "Template and plan", "Create"] as const;
const FIELD_STEP: Record<string, number> = {
  ownerName: 0,
  email: 0,
  phone: 0,
  storeName: 1,
  tagline: 1,
  subdomain: 2,
  theme: 3,
  plan: 3,
};

const taka = (n: number) => `৳ ${n.toLocaleString("en-IN")}`;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

export function Wizard({
  plans,
  themes,
  rootDomain,
  initialPlan,
  initialTheme,
  keepCode = "",
  keptProductsCount,
  verify = true,
}: {
  verify?: boolean;
  keepCode?: string;
  keptProductsCount?: number;
  plans: Plan[];
  themes: Theme[];
  rootDomain: string;
  initialPlan: string;
  initialTheme: string;
}) {
  const [state, action, pending] = useActionState<SignupState, FormData>(signupAction, {});
  const [step, setStep] = useState(0);
  const [v, setV] = useState({
    ownerName: "",
    email: "",
    phone: "",
    storeName: "",
    tagline: "",
    subdomain: "",
    plan: initialPlan,
    theme: initialTheme,
    demoData: true,
  });
  // Confirming the email with a code, before anything is created (docs/45).
  const [proof, setProof] = useState("");
  const [phase, setPhase] = useState<"form" | "code">("form");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [touchedAddress, setTouchedAddress] = useState(false);
  const [address, setAddress] = useState<{ ok: boolean; message: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const checkId = useRef(0);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((o) => ({ ...o, [k]: val }));

  const [migrationInfo, setMigrationInfo] = useState<{ platform: string; totalProducts: number } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("biztrack_migration_catalog");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.totalProducts > 0) {
          setMigrationInfo({ platform: parsed.platform, totalProducts: parsed.totalProducts });
        }
      }
    } catch {}
  }, []);

  // Suggest an address from the store name until the owner types their own.
  useEffect(() => {
    if (!touchedAddress) setV((o) => ({ ...o, subdomain: slug(o.storeName) }));
  }, [v.storeName, touchedAddress]);

  // Live address check, a moment after typing stops.
  useEffect(() => {
    if (v.subdomain.length < 3) {
      setAddress(null);
      return;
    }
    const id = ++checkId.current;
    const t = setTimeout(async () => {
      const r = await checkAddressAction(v.subdomain).catch(() => null);
      if (id === checkId.current && r) setAddress(r);
    }, 350);
    return () => clearTimeout(t);
  }, [v.subdomain]);

  // Server error fallback
  useEffect(() => {
    if (state.error && state.field && FIELD_STEP[state.field] !== undefined) {
      setStep(FIELD_STEP[state.field]!);
    }
  }, [state]);

  function validate(s: number): string | null {
    if (s === 0) {
      if (v.ownerName.trim().length < 2) return "Enter your name";
      if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) return "Enter a valid email address";
      if (!/^(\+?88)?01[3-9]\d{8}$/.test(v.phone.replace(/[\s-]/g, "")))
        return "Enter a valid mobile number, like 01712345678";
    }
    if (s === 1 && v.storeName.trim().length < 2) return "Enter your store name";
    if (s === 2) {
      if (v.subdomain.length < 3) return "Choose an address of at least 3 letters or numbers";
      if (address && !address.ok) return address.message;
    }
    return null;
  }

  async function next() {
    const p = validate(step);
    setProblem(p);
    if (p) return;
    if (step === 0 && verify && !proof) {
      setBusy(true);
      const r = await sendCodeAction(v.email, "both").catch(() => ({ ok: false, error: "We could not send the code. Please try again." }));
      setBusy(false);
      if (!r.ok) return setProblem(r.error ?? "We could not send the code.");
      setCode("");
      return setPhase("code");
    }
    setStep(step + 1);
  }

  async function confirm() {
    if (pw !== pw2) return setProblem("The two passwords are not the same.");
    setBusy(true);
    const r = await confirmEmailAction(v.email, code, pw).catch(() => ({ error: "We could not check the code. Please try again." }) as { error?: string; proof?: string });
    setBusy(false);
    if (!("proof" in r) || !r.proof) return setProblem(r.error ?? "That code is not right.");
    setProblem(null);
    setProof(r.proof);
    setPw("");
    setPw2("");
    setPhase("form");
    setStep(1);
  }

  const chosenPlan = plans.find((p) => p.tier === v.plan);
  const chosenTheme = themes.find((t) => t.id === v.theme);
  const displayHost = rootDomain.replace(/:\d+$/, "");

  return (
    <div className="split-start">
      <div className="split-form">
        {keepCode && keptProductsCount !== undefined && (
          <div className="notice" role="status" data-testid="keep-note" style={{ marginBottom: 20 }}>
            Your demo store comes with you: {keptProductsCount}{" "}
            {keptProductsCount === 1 ? "product" : "products"}, pictures, and home page settings. Finish signing up to keep it active.
          </div>
        )}

        <form action={action} className="wizard" data-testid="wizard" noValidate>
          <div style={{ marginBottom: 24 }}>
            <span className="eyebrow" style={{ marginBottom: 8 }}>14-Day Free Trial</span>
            <h1 style={{ margin: 0 }}>Open your store</h1>
            <p className="muted" style={{ marginTop: 6, fontSize: 15 }}>
              Launch your online store in a day. Sell with bKash, Nagad, and Cash on Delivery.
            </p>
          </div>

          <div
            className="progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
            aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
          >
            {STEPS.map((s, i) => (
              <i key={s} className={i <= step ? "on" : ""} />
            ))}
          </div>

          {/* Hidden values posted with form */}
          {Object.entries(v).map(([k, val]) =>
            k === "demoData" ? (
              val ? <input key={k} type="hidden" name={k} value="on" /> : null
            ) : (
              <input key={k} type="hidden" name={k} value={String(val)} />
            )
          )}
          <input type="hidden" name="proof" value={proof} />
          {keepCode && <input type="hidden" name="from" value={keepCode} />}
          <div className="hp" aria-hidden="true">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          {migrationInfo && (
            <div style={{ background: "var(--tint)", border: "1px solid var(--tint-border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--ink)" }}>
              <span style={{ fontSize: 16 }}>📦</span>
              <div>
                <b>{migrationInfo.totalProducts} products detected from {migrationInfo.platform.toUpperCase()}</b>. After your store is created, your catalog can be imported directly in Store Admin &rarr; Products &rarr; Import.
              </div>
            </div>
          )}

          {/* Step 0: You */}
          {step === 0 && phase === "code" && (
            <div data-testid="step-code">
              <h2 style={{ fontSize: 20, marginBottom: 8, color: "var(--ink)" }}>Confirm your email</h2>
              <p className="muted" style={{ marginBottom: 16, fontSize: 15 }}>We sent a code to <b>{v.email}</b>. Type it here, then choose a password for signing in.</p>
              <label className="field">
                <span className="label">Code from the email</span>
                <input className="input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} data-testid="f-code" />
              </label>
              <label className="field">
                <span className="label">Choose a password</span>
                <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} data-testid="f-password" />
                <span className="hint">At least 10 characters. If you already use BizTrackBD with this email, leave both password boxes empty and your new store joins your account.</span>
              </label>
              <label className="field">
                <span className="label">Type the password again</span>
                <input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} data-testid="f-password2" />
              </label>
              <button type="button" className="btn btn-primary btn-lg" onClick={confirm} disabled={busy} data-testid="confirm-email">{busy ? "Checking…" : "Confirm and continue"}</button>
              <button type="button" className="btn btn-secondary btn-lg" style={{ marginLeft: 10 }} onClick={() => { setProblem(null); setPhase("form"); }}>Change email</button>
            </div>
          )}

          {step === 0 && phase === "form" && (
            <div data-testid="step-you">
              <h2 style={{ fontSize: 20, marginBottom: 16, color: "var(--ink)" }}>Who are you?</h2>
              <label className="field">
                <span className="label">Your name</span>
                <input
                  className="input"
                  autoComplete="name"
                  placeholder="e.g. Tanvir Ahmed"
                  value={v.ownerName}
                  onChange={(e) => set("ownerName", e.target.value)}
                  data-testid="f-ownerName"
                />
              </label>
              <label className="field">
                <span className="label">Email address</span>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="tanvir@example.com"
                  value={v.email}
                  onChange={(e) => { set("email", e.target.value); setProof(""); }}
                  data-testid="f-email"
                />
                <span className="hint">For your store admin login and receipts.</span>
              </label>
              <label className="field">
                <span className="label">Mobile number</span>
                <input
                  className="input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="01712345678"
                  value={v.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  data-testid="f-phone"
                />
                <span className="hint">We use this for SMS security codes and Dhaka support.</span>
              </label>
            </div>
          )}

          {/* Step 1: Your store */}
          {step === 1 && (
            <div data-testid="step-store">
              <h2 style={{ fontSize: 20, marginBottom: 16, color: "var(--ink)" }}>What is your store called?</h2>
              <label className="field">
                <span className="label">Store name</span>
                <input
                  className="input"
                  placeholder="e.g. Dhaka Artisan Crafts"
                  value={v.storeName}
                  onChange={(e) => set("storeName", e.target.value)}
                  data-testid="f-storeName"
                />
              </label>
              <label className="field">
                <span className="label">
                  One-line tagline <span className="hint">(optional)</span>
                </span>
                <input
                  className="input"
                  maxLength={120}
                  placeholder="Handloom sarees and cotton panjabis from Narayanganj"
                  value={v.tagline}
                  onChange={(e) => set("tagline", e.target.value)}
                  data-testid="f-tagline"
                />
              </label>
            </div>
          )}

          {/* Step 2: Address */}
          {step === 2 && (
            <div data-testid="step-address">
              <h2 style={{ fontSize: 20, marginBottom: 16, color: "var(--ink)" }}>Choose your store web address</h2>
              <div className="field">
                <label className="label" htmlFor="sub">
                  Free web address
                </label>
                <div className="addr">
                  <input
                    id="sub"
                    className="input"
                    value={v.subdomain}
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => {
                      setTouchedAddress(true);
                      set("subdomain", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                    }}
                    aria-invalid={address ? !address.ok : undefined}
                    aria-describedby="sub-msg"
                    data-testid="f-subdomain"
                  />
                  <span>.{displayHost}</span>
                </div>
                <div id="sub-msg" aria-live="polite" data-testid="address-status" style={{ marginTop: 6 }}>
                  {address &&
                    (address.ok ? (
                      <span className="ok">✓ {v.subdomain}.{displayHost} is available!</span>
                    ) : (
                      <span className="err">✗ {address.message}</span>
                    ))}
                </div>
                <span className="hint">
                  You can connect your own custom domain (e.g. yourbrand.com) at any time.
                </span>
              </div>
            </div>
          )}

          {/* Step 3: Template and plan */}
          {step === 3 && (
            <div data-testid="step-plan">
              <h2 style={{ fontSize: 20, marginBottom: 16, color: "var(--ink)" }}>Pick a storefront template & plan</h2>
              
              <fieldset className="field" style={{ border: 0, padding: 0 }}>
                <legend className="label" style={{ marginBottom: 10 }}>
                  Choose storefront look
                </legend>
                <div className="choice">
                  {themes.map((t) => (
                    <label
                      key={t.id}
                      className={`opt${t.live ? "" : " disabled"}`}
                      style={{
                        borderColor: v.theme === t.id ? "var(--brand)" : "var(--line)",
                        background: v.theme === t.id ? "var(--tint)" : "#FFFFFF",
                      }}
                    >
                      <input
                        type="radio"
                        name="theme_pick"
                        checked={v.theme === t.id}
                        disabled={!t.live}
                        onChange={() => set("theme", t.id)}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <b>{t.name}</b>
                          {!t.live && <span className="pill">Coming soon</span>}
                        </div>
                        <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                          {t.blurb}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="field" style={{ border: 0, padding: 0, marginTop: 14 }}>
                <legend className="label" style={{ marginBottom: 10 }}>
                  Select your 14-day free trial plan
                </legend>
                <div className="choice">
                  {plans.map((p) => {
                    const isSelected = v.plan === p.tier;
                    return (
                      <label
                        key={p.tier}
                        className="opt"
                        data-testid={`pick-${p.tier}`}
                        style={{
                          borderColor: isSelected ? "var(--brand)" : "var(--line)",
                          background: isSelected ? "var(--tint)" : "#FFFFFF",
                        }}
                      >
                        <input
                          type="radio"
                          name="plan_pick"
                          checked={isSelected}
                          onChange={() => set("plan", p.tier)}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <b>{p.name}</b>
                            <span className="num" style={{ fontWeight: 700, color: "var(--brand)" }}>
                              {taka(p.priceMonthly)} / month
                            </span>
                          </div>
                          <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                            {p.blurb} · <strong>14 days free (৳ 0 today)</strong>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <span className="hint" style={{ marginTop: 6 }}>
                  No payment needed today. You can switch or cancel plans at any time.
                </span>
              </fieldset>
            </div>
          )}

          {/* Step 4: Create */}
          {step === 4 && (
            <div data-testid="step-create">
              <h2 style={{ fontSize: 20, marginBottom: 16, color: "var(--ink)" }}>Ready to launch your store</h2>
              <div
                className="card"
                style={{
                  marginBottom: 18,
                  background: "var(--soft)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 20px" }}>
                  <dt className="muted">Store</dt>
                  <dd style={{ margin: 0, fontWeight: 700, color: "var(--ink)" }}>{v.storeName}</dd>
                  <dt className="muted">Address</dt>
                  <dd style={{ margin: 0, color: "var(--brand)", fontWeight: 600, fontFamily: "monospace" }}>
                    {v.subdomain}.{displayHost}
                  </dd>
                  <dt className="muted">Owner</dt>
                  <dd style={{ margin: 0, color: "var(--ink)" }}>
                    {v.ownerName} ({v.email})
                  </dd>
                  <dt className="muted">Template</dt>
                  <dd style={{ margin: 0, color: "var(--ink)" }}>{chosenTheme?.name}</dd>
                  <dt className="muted">Plan</dt>
                  <dd style={{ margin: 0, color: "var(--ink)" }}>
                    {chosenPlan?.name} (14 days free trial, no card needed)
                  </dd>
                </dl>
              </div>

              <label className="opt" style={{ marginBottom: 18 }}>
                <input
                  type="checkbox"
                  checked={v.demoData}
                  onChange={(e) => set("demoData", e.target.checked)}
                  data-testid="f-demo"
                />
                <div>
                  <b>Populate sample products</b>
                  <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                    Add three starter products with prices and sizes so you can test orders and courier bookings immediately. You can delete or replace them anytime.
                  </div>
                </div>
              </label>

              {state.error && (
                <div className="notice bad" role="alert" style={{ marginBottom: 14 }} data-testid="signup-error">
                  {state.error}
                </div>
              )}
            </div>
          )}

          {problem && step < 4 && (
            <div className="err" role="alert" style={{ marginBottom: 14 }} data-testid="step-problem">
              ⚠️ {problem}
            </div>
          )}

          <div className="nav-row" style={{ marginTop: 20, ...(step === 0 && phase === "code" ? { display: "none" } : {}) }}>
            {step > 0 && (
              <button
                key="back"
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={() => {
                  setProblem(null);
                  setStep(step - 1);
                }}
              >
                Back
              </button>
            )}
            {step < 4 ? (
              <button
                key="next"
                type="button"
                className="btn btn-primary btn-lg"
                onClick={next}
                disabled={busy}
                data-testid="next"
              >
                {busy ? "Sending the code…" : "Next Step →"}
              </button>
            ) : (
              <button
                key="create"
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={pending}
                data-testid="create"
              >
                {pending ? "Creating your store…" : "Launch my store 🚀"}
              </button>
            )}
          </div>

          <p className="hint" style={{ marginTop: 18, fontSize: 13, lineHeight: 1.5 }}>
            By opening a store, you agree to our Terms. We never hold your customer money or take commissions.
          </p>
        </form>
      </div>

      {/* Right Column: Dynamic Live Preview & Timeline Sidebar */}
      <aside className="split-side" aria-label="Store Preview & Guarantee">
        <div className="side-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span className="eyebrow" style={{ margin: 0, fontSize: 11.5 }}>Live Store Preview</span>
            <span className="pill live" style={{ fontSize: 11 }}>14 Days Free</span>
          </div>

          <div
            style={{
              position: "relative",
              height: 190,
              borderRadius: 12,
              overflow: "hidden",
              background: "var(--soft)",
              border: "1px solid var(--line)",
              marginBottom: 16,
            }}
          >
            <Image
              src={`/templates/${v.theme}.webp`}
              alt={`${chosenTheme?.name} preview`}
              fill
              sizes="340px"
              style={{ objectFit: "cover", objectPosition: "top" }}
            />
            <div
              style={{
                position: "absolute",
                right: 10,
                bottom: -6,
                width: "28%",
                height: "75%",
                borderRadius: 8,
                overflow: "hidden",
                border: "2px solid #FFFFFF",
                boxShadow: "0 4px 12px rgba(26,26,78,0.2)",
              }}
            >
              <Image
                src={`/templates/${v.theme}-phone.webp`}
                alt={`${chosenTheme?.name} phone preview`}
                fill
                sizes="90px"
                style={{ objectFit: "cover", objectPosition: "top" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>Store name:</span>
              <b style={{ color: "var(--ink)" }}>{v.storeName || "My Online Store"}</b>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>Web address:</span>
              <span style={{ color: "var(--brand)", fontWeight: 700, fontFamily: "monospace" }}>
                {v.subdomain ? `${v.subdomain}.${displayHost}` : `yourshop.${displayHost}`}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>Template:</span>
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>{chosenTheme?.name || "Kapor"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>Selected plan:</span>
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                {chosenPlan?.name} ({taka(chosenPlan?.priceMonthly || 699)}/mo)
              </span>
            </div>
          </div>
        </div>

        <div className="side-card">
          <span className="eyebrow" style={{ fontSize: 11.5, marginBottom: 14 }}>
            What happens next
          </span>
          <div style={{ display: "grid", gap: 16 }}>
            <div className="timeline-item">
              <div className="timeline-dot">1</div>
              <div>
                <b style={{ fontSize: 14, color: "var(--ink)" }}>Store opens immediately</b>
                <p className="muted" style={{ fontSize: 13, marginTop: 2, lineHeight: 1.5 }}>
                  Your store goes live at your address. Add your products and upload photos from your phone.
                </p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot">2</div>
              <div>
                <b style={{ fontSize: 14, color: "var(--ink)" }}>Connect bKash & Nagad</b>
                <p className="muted" style={{ fontSize: 13, marginTop: 2, lineHeight: 1.5 }}>
                  Enter your merchant or personal bKash number. 100% of customer money goes directly to your wallet.
                </p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot">3</div>
              <div>
                <b style={{ fontSize: 14, color: "var(--ink)" }}>Ship with local couriers</b>
                <p className="muted" style={{ fontSize: 13, marginTop: 2, lineHeight: 1.5 }}>
                  Enter your Steadfast or Pathao API keys for 1-click automated pickup dispatch.
                </p>
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--line)",
              marginTop: 18,
              paddingTop: 14,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              fontSize: 12.5,
              color: "var(--ink-2)",
              fontWeight: 600,
            }}
          >
            <span>🔒 We never touch your money</span>
            <span>💳 0% sales commission</span>
            <span>📱 Bangla SMS notifications</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
