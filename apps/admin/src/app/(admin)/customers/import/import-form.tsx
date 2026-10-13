"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { importCustomersAction, type CustomerImportState } from "./actions";

export function ImportForm() {
  const [state, action] = useActionState<CustomerImportState, FormData>(importCustomersAction, null);
  return (
    <form action={action} className="stack">
      <label className="field" style={{ marginBottom: 0 }}><span className="label">CSV file</span><input className="input" type="file" name="file" accept=".csv,text/csv" required data-testid="cimport-file" /></label>
      <div><SubmitButton className="btn btn-primary" pending="Importing…" data-testid="cimport-go">Import customers</SubmitButton></div>
      {state && !state.ok && <div className="notice bad" role="alert" data-testid="cimport-error">{state.error}</div>}
      {state?.ok && (
        <div role="status" data-testid="cimport-result" className="stack">
          <div className={`notice ${state.created ? "good" : ""}`}>
            Read as a {state.format === "shopify" ? "Shopify customer export" : "plain customer list"}. <b>{state.created}</b> new {state.created === 1 ? "customer" : "customers"} added, <b>{state.existing}</b> already {state.existing === 1 ? "was" : "were"} in your store (left as they are){state.duplicates ? `, ${state.duplicates} repeated ${state.duplicates === 1 ? "number" : "numbers"} in the file skipped` : ""}{state.failed.length ? `, ${state.failed.length} could not be read` : ""}.
          </div>
          {state.failed.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 20 }} data-testid="cimport-failed">
              {state.failed.slice(0, 20).map((f) => <li key={f.line}>Line {f.line}{f.name ? ` (${f.name})` : ""}: {f.reason}</li>)}
              {state.failed.length > 20 && <li>and {state.failed.length - 20} more</li>}
            </ul>
          )}
          <p style={{ margin: 0 }}><Link href="/customers" className="btn btn-secondary" prefetch={false}>See the customers</Link></p>
        </div>
      )}
    </form>
  );
}
