"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { importProductsAction, type ImportState } from "../bulk-actions";

export function ImportForm() {
  const [state, action] = useActionState<ImportState, FormData>(importProductsAction, null);
  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <label><span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>CSV file</span><input className="input" type="file" name="file" accept=".csv,text/csv" required data-testid="import-file" /></label>
      <div><SubmitButton className="btn btn-primary" pending="Importing…" data-testid="import-go">Import products</SubmitButton></div>
      {state && !state.ok && <div className="notice bad" role="alert" data-testid="import-error">{state.error}</div>}
      {state?.ok && (
        <div role="status" data-testid="import-result">
          <div className={`notice ${state.created ? "good" : ""}`}>
            <b>Format detected:</b> {state.platform.toUpperCase()} — {state.created} {state.created === 1 ? "product" : "products"} ({state.totalVariants} variants) imported successfully{state.failed.length ? `, ${state.failed.length} skipped` : ""}.{state.stoppedByPlan ? " Your plan's product limit stopped the import." : ""}
          </div>
          {state.failed.length > 0 && (
            <ul style={{ margin: "10px 0 0", paddingLeft: 20 }} data-testid="import-failed">
              {state.failed.slice(0, 20).map((f) => <li key={f.line}>Line {f.line}{f.title ? ` (${f.title})` : ""}: {f.reason}</li>)}
              {state.failed.length > 20 && <li>and {state.failed.length - 20} more</li>}
            </ul>
          )}
          {state.created > 0 && <p style={{ marginTop: 12 }}><Link href="/products" className="btn btn-secondary" prefetch={false}>See the products</Link></p>}
        </div>
      )}
    </form>
  );
}
