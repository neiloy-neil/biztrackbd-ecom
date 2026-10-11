"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface CartLine {
  variantId: string;
  quantity: number;
}

interface CartApi {
  lines: CartLine[];
  count: number;
  /** False until the saved cart has been read from the browser, so badges do not flash 0. */
  ready: boolean;
  add: (variantId: string, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

const KEY = "bt_cart_v1";
const MAX_QTY = 50;
const MAX_LINES = 50;
const Ctx = createContext<CartApi | null>(null);

/**
 * The cart lives in the browser as variant ids and quantities only. Prices are never stored: every screen asks the
 * server (quoteCartAction), and the server recalculates again when the order is placed.
 */
function read(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l): l is CartLine => l && typeof l.variantId === "string" && Number.isInteger(l.quantity) && l.quantity > 0)
      .slice(0, MAX_LINES)
      .map((l) => ({ variantId: l.variantId, quantity: Math.min(l.quantity, MAX_QTY) }));
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* private mode or full storage: the cart still works for this page view */
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(read());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setLines(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commit = useCallback((next: CartLine[]) => {
    setLines(next);
    write(next);
  }, []);

  const api = useMemo<CartApi>(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      ready,
      add: (variantId, quantity = 1) => {
        const current = read();
        const found = current.find((l) => l.variantId === variantId);
        if (found) found.quantity = Math.min(found.quantity + quantity, MAX_QTY);
        else if (current.length < MAX_LINES) current.push({ variantId, quantity: Math.min(quantity, MAX_QTY) });
        commit(current);
      },
      setQuantity: (variantId, quantity) =>
        commit(lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, Math.min(quantity, MAX_QTY)) } : l))),
      remove: (variantId) => commit(lines.filter((l) => l.variantId !== variantId)),
      clear: () => commit([]),
    }),
    [lines, ready, commit],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCart(): CartApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside <CartProvider>");
  return c;
}
