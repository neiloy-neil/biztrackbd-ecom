"use client";

import Link from "next/link";
import { CartIcon } from "./icons";
import { useCart } from "./cart-provider";

/** `labelWithCount` contains {n}, for example "Cart, {n} items". */
export function CartLink({ label, labelWithCount }: { label: string; labelWithCount: string }) {
  const { count, ready } = useCart();
  const showCount = ready && count > 0;
  return (
    <Link href="/cart" className="icon-btn" aria-label={showCount ? labelWithCount.replace("{n}", String(count)) : label} data-testid="cart-link">
      <CartIcon />
      {showCount && <span className="badge" data-testid="cart-count">{count}</span>}
    </Link>
  );
}
