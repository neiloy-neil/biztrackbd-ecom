const TONE: Record<string, string> = {
  PENDING: "warn", PENDING_VERIFICATION: "warn", UNPAID: "warn",
  CONFIRMED: "", PROCESSING: "", SHIPPED: "",
  DELIVERED: "ok", PAID: "ok",
  CANCELLED: "bad", RETURNED: "bad", FAILED: "bad", REFUNDED: "bad",
};

export function Chip({ value }: { value: string }) {
  return <span className={`pill ${TONE[value] ?? ""}`}>{value.replace(/_/g, " ").toLowerCase()}</span>;
}
