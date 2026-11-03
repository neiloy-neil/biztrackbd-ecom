import Link from "next/link";

export default function NoAccess() {
  return (
    <div role="main" className="card" style={{ margin: "64px auto", maxWidth: 480 }}>
      <AuthBrand />
      <h1 style={{ marginTop: 0 }}>You do not have access to this page</h1>
      <p className="muted">Your platform role does not include it.</p>
      <Link href="/" className="link">Back to overview</Link>
    </div>
  );
}
import { AuthBrand } from "@/components/auth-brand";
