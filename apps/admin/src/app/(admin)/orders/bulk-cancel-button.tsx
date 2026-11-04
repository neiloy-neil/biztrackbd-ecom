"use client";

import { ConfirmSubmitButton } from "@/components/ui";

/** "Cancel selected" for the orders list: refuses to run without a reason, then asks once, naming how many orders it will cancel. */
export function BulkCancelButton({ formAction }: { formAction: (form: FormData) => Promise<void> }) {
  return (
    <ConfirmSubmitButton
      formAction={formAction}
      className="btn btn-danger btn-sm"
      pending="Cancelling…"
      data-testid="bulk-cancel"
      confirm={(form) => {
        const n = [...form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked')].filter((b) => b.offsetParent !== null).length;
        const reason = (form.elements.namedItem("reason") as HTMLSelectElement | null)?.value ?? "";
        if (!reason) return { notice: "Choose why you are cancelling from the reason list, then press Cancel selected again." };
        return {
          title: `Cancel ${n} ${n === 1 ? "order" : "orders"}?`,
          message: `${n === 1 ? "This order" : "These orders"} will be marked cancelled and the reason will be saved. You can reopen a cancelled order from its page.`,
          confirmLabel: `Cancel ${n === 1 ? "order" : "orders"}`,
          cancelLabel: "Keep them",
          tone: "danger",
        };
      }}
    >
      Cancel selected
    </ConfirmSubmitButton>
  );
}
