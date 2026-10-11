/** ৳1,150 style amounts. Whole taka when there are no paisa. */
export function formatBdt(amount: number | string | { toString(): string }): string {
  const n = Number(amount.toString());
  const fixed = Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `৳${fixed}`;
}

export function banglaDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)] ?? d);
}
