import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

const styles = {
  primary: { background: "var(--brand)", color: "var(--brand-ink, #fff)", border: "1px solid var(--brand)" },
  secondary: { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)" },
  danger: { background: "var(--surface)", color: "var(--danger)", border: "1px solid var(--danger)" },
} as const;

export function Button({ variant = "primary", style, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      style={{
        ...styles[variant], borderRadius: "var(--radius)", padding: "10px 16px", fontWeight: 600,
        fontFamily: "inherit", fontSize: 14, cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.6 : 1, minHeight: 44, ...style,
      }}
    />
  );
}
