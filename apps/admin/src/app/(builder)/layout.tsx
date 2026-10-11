import "./builder.css";
import { ToastProvider } from "@biztrackbd/ui";

// The editor takes the whole screen: no sidebar, no top bar of the admin. Every page in this group checks the signed-in person itself.
export const dynamic = "force-dynamic";

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
