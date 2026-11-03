"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  lookupResetTargetAction,
  dispatchResetOtpAction,
  verifyResetOtpAction,
  completePasswordResetAction,
  type ResetLookupResult,
} from "./actions";
import type { StaffResetTarget, StaffAccountOption } from "@biztrackbd/core";

export function PasswordResetWizard({ next }: { next: string }) {
  // Step state: "identifier" | "account_choice" | "channel_choice" | "otp" | "password"
  const [step, setStep] = useState<"identifier" | "account_choice" | "channel_choice" | "otp" | "password">("identifier");
  const [isPending, startTransition] = useTransition();

  // Data state
  const [identifier, setIdentifier] = useState("");
  const [accounts, setAccounts] = useState<StaffAccountOption[]>([]);
  const [selectedAccountEmail, setSelectedAccountEmail] = useState("");
  const [target, setTarget] = useState<StaffResetTarget | null>(null);
  const [chosenChannel, setChosenChannel] = useState<"email" | "sms">("email");
  const [maskedDestination, setMaskedDestination] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resetTicket, setResetTicket] = useState("");

  // Password fields
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Error & Feedback state
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  // Cooldown countdown timer on OTP step
  useEffect(() => {
    if (step !== "otp") return;
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, resendCooldown]);

  // Step 1: Identifier Submission
  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Please enter your email or mobile phone number.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result: ResetLookupResult = await lookupResetTargetAction(identifier);
      if (!result.success) {
        setError(result.error);
        return;
      }

      if (result.needsAccountChoice) {
        setAccounts(result.accounts);
        setSelectedAccountEmail(result.accounts[0]?.email ?? "");
        setStep("account_choice");
      } else if (result.needsChannelChoice) {
        setAccounts([]);
        setTarget(result.target);
        setChosenChannel(result.target.availableChannels.includes("sms") ? "sms" : "email");
        setStep("channel_choice");
      } else {
        setAccounts([]);
        setTarget({
          email: result.email,
          phone: result.phone,
          maskedEmail: "",
          maskedPhone: null,
          availableChannels: [result.channel],
        });
        setChosenChannel(result.channel);
        setMaskedDestination(result.maskedDestination);
        setResendCooldown(60);
        setStep("otp");
      }
    });
  };

  // Step 1.5: Multi-Account Selection
  const handleAccountSelect = (e: React.FormEvent) => {
    e.preventDefault();
    const acc = accounts.find((a) => a.email === selectedAccountEmail);
    if (!acc) return;
    setError(null);

    const newTarget: StaffResetTarget = {
      email: acc.email,
      phone: acc.phone,
      maskedEmail: acc.maskedEmail,
      maskedPhone: acc.maskedPhone,
      availableChannels: acc.phone ? ["sms", "email"] : ["email"],
      storeNames: acc.storeNames,
    };
    setTarget(newTarget);
    // Prefer SMS since phone was the search term
    setChosenChannel(acc.phone ? "sms" : "email");
    setStep("channel_choice");
  };

  // Step 1b: Channel Choice Submission
  const handleSendChannelOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setError(null);

    startTransition(async () => {
      const res = await dispatchResetOtpAction(target.email, chosenChannel, target.phone);
      if (!res.success) {
        setError(res.error ?? "Failed to send verification code. Please try again.");
        return;
      }
      setMaskedDestination(res.maskedDestination ?? (chosenChannel === "sms" ? target.maskedPhone ?? "" : target.maskedEmail));
      setResendCooldown(60);
      setStep("otp");
    });
  };

  // Step 2: OTP Verification Submission
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otpCode.replace(/\s+/g, "");
    if (!cleanCode || cleanCode.length < 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }
    setError(null);

    const email = target?.email || (identifier.includes("@") ? identifier.trim().toLowerCase() : "");
    if (!email) {
      setError("Session details missing. Please start over.");
      setStep("identifier");
      return;
    }

    startTransition(async () => {
      const res = await verifyResetOtpAction(email, cleanCode);
      if (!res.success || !res.resetTicket) {
        setError(res.error ?? "Invalid code. Please try again.");
        return;
      }
      setResetTicket(res.resetTicket);
      setError(null);
      setStep("password");
    });
  };

  // Resend OTP
  const handleResend = () => {
    if (resendCooldown > 0) return;
    const email = target?.email || (identifier.includes("@") ? identifier.trim().toLowerCase() : "");
    const phone = target?.phone ?? null;
    if (!email) return;

    setError(null);
    setResendNotice(null);

    startTransition(async () => {
      const res = await dispatchResetOtpAction(email, chosenChannel, phone);
      if (res.success) {
        setResendCooldown(60);
        setResendNotice(`A new 6-digit code was sent to your ${chosenChannel === "sms" ? "phone" : "email"}.`);
        setTimeout(() => setResendNotice(null), 5000);
      } else {
        setError(res.error ?? "Could not resend code. Please try again.");
      }
    });
  };

  // Step 3: Password Update Submission
  const handleSetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 10) {
      setError("Password must be at least 10 characters long.");
      return;
    }
    if (password !== again) {
      setError("The two passwords do not match. Please verify and try again.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await completePasswordResetAction(resetTicket, password, again, next);
      if (res && !res.success) {
        setError(res.error ?? "Failed to save password. Please try again.");
      }
    });
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* Visual Step Progress Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "var(--surface-sunken, #f8fafc)",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          border: "1px solid var(--line)",
          color: "var(--text-muted, #64748b)",
        }}
      >
        <span
          style={{
            color:
              step === "identifier" || step === "account_choice" || step === "channel_choice"
                ? "var(--brand)"
                : "#10b981",
          }}
        >
          {step === "otp" || step === "password" ? "✓ 1. Channel" : "1. Channel"}
        </span>
        <span>→</span>
        <span
          style={{
            color: step === "otp" ? "var(--brand)" : step === "password" ? "#10b981" : "inherit",
          }}
        >
          {step === "password" ? "✓ 2. Verify Code" : "2. Verify Code"}
        </span>
        <span>→</span>
        <span
          style={{
            color: step === "password" ? "var(--brand)" : "inherit",
          }}
        >
          3. New Password
        </span>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="notice bad" role="alert" style={{ marginBottom: 0 }}>
          {error}
        </div>
      )}

      {/* Resend Success Toast */}
      {resendNotice && (
        <div
          style={{
            padding: "8px 12px",
            background: "#ecfdf5",
            color: "#065f46",
            borderRadius: 6,
            fontSize: 13,
            border: "1px solid #a7f3d0",
          }}
        >
          {resendNotice}
        </div>
      )}

      {/* STEP 1A: IDENTIFIER INPUT */}
      {step === "identifier" && (
        <form onSubmit={handleLookup} className="stack" style={{ gap: 16 }}>
          <p className="muted" style={{ margin: 0 }}>
            Enter your store account email or Bangladeshi mobile phone number (e.g. <code>017XXXXXXXX</code>).
          </p>
          <div className="field" style={{ margin: 0 }}>
            <label className="label" htmlFor="reset-id">
              Email or Mobile Number
            </label>
            <input
              id="reset-id"
              className="input"
              type="text"
              name="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="01712345678 or owner@store.com"
              required
              autoFocus
              disabled={isPending}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={isPending}>
            {isPending ? "Checking account…" : "Continue"}
          </button>
        </form>
      )}

      {/* STEP 1.5: MULTI-ACCOUNT DISAMBIGUATION (WHEN PHONE HAS MULTIPLE STORES) */}
      {step === "account_choice" && accounts.length > 0 && (
        <form onSubmit={handleAccountSelect} className="stack" style={{ gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, color: "var(--text, #0f172a)" }}>
              Multiple store accounts found
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              This phone number is associated with {accounts.length} merchant accounts. Select the store account you want to reset:
            </p>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {accounts.map((acc) => {
              const isSelected = selectedAccountEmail === acc.email;
              return (
                <label
                  key={acc.email}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 8,
                    border: `2px solid ${isSelected ? "var(--brand)" : "var(--line)"}`,
                    background: isSelected ? "var(--brand-light)" : "var(--surface)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="radio"
                    name="selectedAccount"
                    value={acc.email}
                    checked={isSelected}
                    onChange={() => setSelectedAccountEmail(acc.email)}
                    style={{ marginTop: 3 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text, #0f172a)" }}>
                      {acc.maskedEmail}
                    </div>
                    {acc.storeNames && acc.storeNames.length > 0 && (
                      <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)", marginTop: 2 }}>
                        Store{acc.storeNames.length > 1 ? "s" : ""}:{" "}
                        <span style={{ fontWeight: 500, color: "var(--text, #334155)" }}>
                          {acc.storeNames.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={isPending || !selectedAccountEmail}
          >
            Continue with Selected Account
          </button>

          <button
            type="button"
            className="btn btn-outline btn-block"
            onClick={() => setStep("identifier")}
            disabled={isPending}
            style={{ fontSize: 13 }}
          >
            ← Use a different email or phone
          </button>
        </form>
      )}

      {/* STEP 1B: CHANNEL CHOICE */}
      {step === "channel_choice" && target && (
        <form onSubmit={handleSendChannelOtp} className="stack" style={{ gap: 16 }}>
          <div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Choose where you would like to receive your 6-digit verification code:
            </p>
            {target.storeNames && target.storeNames.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  background: "var(--surface-sunken, #f8fafc)",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  fontSize: 12,
                  color: "var(--text-muted, #64748b)",
                }}
              >
                Store{target.storeNames.length > 1 ? "s" : ""}:{" "}
                <strong style={{ color: "var(--text, #1e293b)" }}>{target.storeNames.join(", ")}</strong>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {target.availableChannels.includes("sms") && target.maskedPhone && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: `2px solid ${chosenChannel === "sms" ? "var(--brand)" : "var(--line)"}`,
                  background: chosenChannel === "sms" ? "var(--brand-light)" : "var(--surface)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="channel"
                  value="sms"
                  checked={chosenChannel === "sms"}
                  onChange={() => setChosenChannel("sms")}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>📱 Mobile SMS</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted, #64748b)" }}>
                    Send SMS to <b>{target.maskedPhone}</b>
                  </div>
                </div>
              </label>
            )}

            {target.availableChannels.includes("email") && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: `2px solid ${chosenChannel === "email" ? "var(--brand)" : "var(--line)"}`,
                  background: chosenChannel === "email" ? "var(--brand-light)" : "var(--surface)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="channel"
                  value="email"
                  checked={chosenChannel === "email"}
                  onChange={() => setChosenChannel("email")}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>📧 Email Inbox</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted, #64748b)" }}>
                    Send code to <b>{target.maskedEmail}</b>
                  </div>
                </div>
              </label>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={isPending}>
            {isPending ? "Sending code…" : `Send Code via ${chosenChannel === "sms" ? "SMS" : "Email"}`}
          </button>

          <button
            type="button"
            className="btn btn-outline btn-block"
            onClick={() => {
              if (accounts.length > 1) {
                setStep("account_choice");
              } else {
                setStep("identifier");
              }
            }}
            disabled={isPending}
            style={{ fontSize: 13 }}
          >
            {accounts.length > 1 ? "← Choose a different account" : "← Use a different email or phone"}
          </button>
        </form>
      )}

      {/* STEP 2: 6-DIGIT OTP VERIFICATION */}
      {step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="stack" style={{ gap: 16 }}>
          <div
            style={{
              padding: "10px 14px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 8,
              fontSize: 13,
              color: "#1e40af",
            }}
          >
            A 6-digit verification code has been dispatched to{" "}
            <b>{maskedDestination || (chosenChannel === "sms" ? "your mobile phone" : "your email")}</b> via{" "}
            <b>{chosenChannel === "sms" ? "SMS" : "Email"}</b>. Code is valid for 5 minutes.
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label className="label" htmlFor="otp-input" style={{ textAlign: "center" }}>
              Enter 6-Digit Code
            </label>
            <input
              id="otp-input"
              className="input"
              type="text"
              inputMode="numeric"
              pattern="[0-9 ]{6,8}"
              maxLength={8}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="123456"
              required
              autoFocus
              disabled={isPending}
              style={{
                fontSize: 24,
                letterSpacing: 8,
                textAlign: "center",
                fontWeight: 700,
                fontFamily: "monospace",
              }}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={isPending || otpCode.trim().length < 6}>
            {isPending ? "Verifying code…" : "Verify Code & Continue"}
          </button>

          {/* Resend Cooldown & Switch Channel */}
          <div style={{ textAlign: "center", fontSize: 13, marginTop: 4 }}>
            {resendCooldown > 0 ? (
              <span className="muted">Resend code in {resendCooldown}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isPending}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--brand)",
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: 0,
                  fontSize: 13,
                }}
              >
                Didn&apos;t get the code? Resend via {chosenChannel === "sms" ? "SMS" : "Email"}
              </button>
            )}

            {target && target.availableChannels.length > 1 && (
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setOtpCode("");
                    setError(null);
                    setStep("channel_choice");
                  }}
                  disabled={isPending}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted, #64748b)",
                    cursor: "pointer",
                    fontSize: 12,
                    textDecoration: "underline",
                  }}
                >
                  Switch delivery to {chosenChannel === "sms" ? "Email" : "SMS"}
                </button>
              </div>
            )}
          </div>
        </form>
      )}

      {/* STEP 3: NEW PASSWORD & CONFIRM */}
      {step === "password" && (
        <form onSubmit={handleSetPassword} className="stack" style={{ gap: 16 }}>
          <div
            style={{
              padding: "10px 14px",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: 8,
              fontSize: 13,
              color: "#065f46",
            }}
          >
            ✓ Identity verified successfully! Create your new password below.
          </div>

          <div className="field" style={{ margin: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="label" htmlFor="new-pw">
                New Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--brand)",
                  fontSize: 12,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="new-pw"
              className="input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={10}
              required
              autoFocus
              disabled={isPending}
              autoComplete="new-password"
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Must be at least 10 characters long.
            </div>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label className="label" htmlFor="confirm-pw">
              Confirm New Password
            </label>
            <input
              id="confirm-pw"
              className="input"
              type={showPassword ? "text" : "password"}
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              minLength={10}
              required
              disabled={isPending}
              autoComplete="new-password"
            />
            {again && (
              <div
                style={{
                  fontSize: 12,
                  marginTop: 4,
                  fontWeight: 500,
                  color: password === again ? "#059669" : "#dc2626",
                }}
              >
                {password === again ? "✓ Passwords match" : "✕ Passwords do not match"}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={isPending || password.length < 10 || password !== again}
          >
            {isPending ? "Saving password and signing in…" : "Save Password & Sign In"}
          </button>
        </form>
      )}

      {/* Footer Navigation */}
      <div style={{ textAlign: "center", marginTop: 8, fontSize: 13 }}>
        <Link className="link" href="/login">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
