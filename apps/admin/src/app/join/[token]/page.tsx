import { previewInvite, ROLE_LABELS } from "@biztrackbd/core";
import { authMode } from "@/lib/auth";
import { JoinForm } from "./form";

export const dynamic = "force-dynamic";

export default async function Join({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await previewInvite(token);
  return (
    <div className="card" style={{ margin: "64px auto", maxWidth: 440 }}>
      {invite ? (
        <>
          <h1 style={{ marginTop: 0 }}>Join {invite.storeName}</h1>
          <p className="muted">{invite.email} has been invited as {ROLE_LABELS[invite.role]}.</p>
          <JoinForm token={token} needsPassword={authMode() === "supabase"} />
        </>
      ) : (
        <>
          <h1 style={{ marginTop: 0 }}>This invite is not valid any more</h1>
          <p className="muted">It may have been used, removed or expired. Ask the store owner to send a new one.</p>
        </>
      )}
    </div>
  );
}
