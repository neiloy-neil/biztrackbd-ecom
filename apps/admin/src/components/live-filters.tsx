"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Filters that live in the address bar. Changing one updates the URL, so the list refilters as you go, the back button works, and a
 * link to the filtered list can be shared. The page number always goes back to 1.
 */
export function useUrlFilters() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    q.delete("page");
    const s = q.toString();
    start(() => router.replace(s ? `${path}?${s}` : path, { scroll: false }));
  };
  return { value: (k: string) => sp.get(k) ?? "", set, pending };
}

/** A search box that filters the list a moment after you stop typing. Enter searches at once. */
export function LiveSearch({ name, label, placeholder, defaultValue }: { name: string; label: string; placeholder: string; defaultValue: string }) {
  const { set, value, pending } = useUrlFilters();
  const [text, setText] = useState(defaultValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Nothing to do when the box already says what the address says (on first load, and when React runs this effect twice in development).
    if (text.trim() === value(name)) return;
    timer.current = setTimeout(() => set({ [name]: text.trim() || undefined }), 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <label className="grow live-search" aria-busy={pending}>
      <span className="sr-only">{label}</span>
      <input className="input" type="search" name={name} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} autoComplete="off" />
    </label>
  );
}

/** One choice out of a few, shown as chips. Choosing the one already chosen clears it. */
export function ChipFilter({ name, label, options, value }: { name: string; label: string; options: { value: string; label: string }[]; value: string }) {
  const { set } = useUrlFilters();
  return (
    <div className="chip-filter" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value || "any"} type="button" className="chip" aria-pressed={value === o.value} onClick={() => set({ [name]: value === o.value ? undefined : o.value || undefined })}>{o.label}</button>
      ))}
    </div>
  );
}

/** A dropdown that applies as soon as it changes. */
export function SelectFilter({ name, label, value, options }: { name: string; label: string; value: string; options: { value: string; label: string }[] }) {
  const { set } = useUrlFilters();
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select className="select" name={name} value={value} onChange={(e) => set({ [name]: e.target.value || undefined })}>
        {options.map((o) => <option key={o.value || "any"} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
