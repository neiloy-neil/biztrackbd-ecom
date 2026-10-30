import type { Metadata } from "next";
import { can, listApiKeys, listApiRequestLogs } from "@biztrackbd/core";
import { getBasePrisma } from "@biztrackbd/db";
import { requireAccess } from "@/lib/session";
import { PageHeader } from "@biztrackbd/ui";
import { DeveloperHubClient } from "./developer-hub-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Developer Hub & API Keys — BizTrack Admin",
};

export default async function DeveloperSettingsPage() {
  const s = await requireAccess("billing");
  const canEdit = can(s.user.role, "billing", "edit");

  const [keys, rawLogs] = await Promise.all([
    listApiKeys(getBasePrisma(), s.tenantId),
    listApiRequestLogs(getBasePrisma(), s.tenantId, 50),
  ]);

  // Serialize dates for Client Component
  const serializedKeys = keys.map((k) => ({
    ...k,
    createdAt: k.createdAt.toISOString(),
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
    expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
    revokedAt: k.revokedAt ? k.revokedAt.toISOString() : null,
  }));

  const serializedLogs = rawLogs.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="Developer Hub & REST API"
        crumbs={[{ label: "Home", href: "/" }, { label: "Settings" }, { label: "Developer" }]}
        sub="Generate cryptographically secure API keys, inspect interactive cURL & JavaScript code documentation, and monitor live API traffic logs to connect external ERPs, POS systems, and custom integrations."
      />

      {!canEdit && (
        <div className="notice" style={{ marginBottom: 16 }}>
          You have view-only access to developer settings. Contact the store owner to create or revoke API keys.
        </div>
      )}

      <DeveloperHubClient
        keys={serializedKeys}
        logs={serializedLogs}
        canEdit={canEdit}
        tenantSubdomain={s.tenantSubdomain}
      />
    </>
  );
}
