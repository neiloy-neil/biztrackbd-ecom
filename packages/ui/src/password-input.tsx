"use client";

import { useState, type InputHTMLAttributes } from "react";

/** A password field with a Show / Hide button, so a phone user can check what they typed before submitting. */
export function PasswordInput({ id, className = "input", ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="pw-field">
      <input {...rest} id={id} className={className} type={shown ? "text" : "password"} />
      <button type="button" className="pw-toggle" onClick={() => setShown((v) => !v)} aria-pressed={shown} aria-controls={id}>
        {shown ? "Hide" : "Show"}<span className="sr-only"> password</span>
      </button>
    </div>
  );
}
