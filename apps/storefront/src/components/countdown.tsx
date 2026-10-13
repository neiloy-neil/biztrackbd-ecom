"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Counts down to a real moment the merchant set. Draws nothing before it has the browser's clock (so the server and the browser agree), and
 * nothing once the time is up: an offer that has ended is never left on the page.
 */
export function Countdown({ endsAt, labels }: { endsAt: string; labels: { d: string; h: string; m: string; s: string } }) {
  const end = new Date(endsAt).getTime();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end]);
  if (left === null || left <= 0) return null;
  const sec = Math.floor(left / 1000);
  const parts: [number, string][] = [[Math.floor(sec / 86400), labels.d], [Math.floor((sec % 86400) / 3600), labels.h], [Math.floor((sec % 3600) / 60), labels.m], [sec % 60, labels.s]];
  return (
    <div className="lp-clock" role="timer" aria-live="off" data-testid="lp-clock">
      {parts.map(([n, l]) => <div key={l}><b>{pad(n)}</b><span>{l}</span></div>)}
    </div>
  );
}
