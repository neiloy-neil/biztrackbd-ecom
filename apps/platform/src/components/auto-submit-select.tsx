"use client";

/** A drop-down that saves its form the moment it changes. A browser component because the change handler cannot be set from a server page. */
export function AutoSubmitSelect({ name, defaultValue, options }: { name: string; defaultValue: string; options: { value: string; label: string }[] }) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={(e) => e.target.form?.requestSubmit()}
      aria-label={name}
      style={{ padding: "4px 8px", fontSize: 12, borderRadius: 6, border: "1px solid #D5D5E4" }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
