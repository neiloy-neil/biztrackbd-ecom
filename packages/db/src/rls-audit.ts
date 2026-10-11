import pg from "pg";

/**
 * A sweep over EVERY table that carries a tenantId, not a hand-picked list, so a table added in a later phase cannot be forgotten.
 * Structure: row-level security enabled and forced, a policy that names the tenant for every command, no "true" policy.
 * Behaviour, as the restricted app role: with no tenant set nothing is visible; with a tenant set no other tenant's row can be
 * read, changed or removed; and a row copied from another tenant cannot be inserted.
 * Read the result with `failures(report)`: an empty list means the isolation holds for every table in this database.
 */

export interface TableAudit {
  table: string;
  rows: number;
  /** False for platform-only tables the app role has no grant on at all (the strongest protection; nothing else to test). */
  appCanRead: boolean;
  rlsEnabled: boolean;
  rlsForced: boolean;
  policies: number;
  policyProblems: string[];
  /** Rows visible with no tenant set (must be 0). */
  visibleWithoutTenant: number;
  /** Rows of other tenants visible, changed or deleted while acting as one tenant (all must be 0). */
  otherTenantRead: number;
  otherTenantUpdated: number;
  otherTenantDeleted: number;
  /** "blocked" or "none to try" (no other tenant has a row here) or "ALLOWED" (a failure). */
  crossTenantInsert: "blocked" | "none to try" | "ALLOWED";
}

export interface RlsReport {
  tables: TableAudit[];
  /** Tables with no tenantId the app role can read. Only the plan catalogue is expected. */
  readablePlatformTables: string[];
  appRole: { bypassRls: boolean; superuser: boolean };
}

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const DENIED = /row-level security|permission denied/i;

export async function auditRls(urls: { direct: string; app: string }): Promise<RlsReport> {
  const owner = new pg.Client({ connectionString: urls.direct });
  const app = new pg.Client({ connectionString: urls.app });
  await owner.connect();
  await app.connect();
  try {
    const tables = (
      await owner.query<{ relname: string; enabled: boolean; forced: boolean }>(`
        SELECT cl.relname, cl.relrowsecurity AS enabled, cl.relforcerowsecurity AS forced
        FROM pg_class cl
        JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
        JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attname = 'tenantId' AND NOT a.attisdropped
        WHERE cl.relkind = 'r' ORDER BY cl.relname`)
    ).rows;

    const policies = (await owner.query<{ tablename: string; cmd: string; qual: string | null; with_check: string | null; roles: string[] }>(`SELECT tablename, cmd, qual, with_check, roles FROM pg_policies WHERE schemaname = 'public'`)).rows;
    const tenants = (await owner.query<{ id: string }>(`SELECT id FROM "Tenant" ORDER BY id`)).rows.map((r) => r.id);

    const out: TableAudit[] = [];
    for (const t of tables) {
      const name = q(t.relname);
      const mine = policies.filter((p) => p.tablename === t.relname);
      const problems: string[] = [];
      if (mine.length === 0) problems.push("no policy");
      for (const p of mine) {
        const text = `${p.qual ?? ""} ${p.with_check ?? ""}`;
        if (/^\(?true\)?$/i.test((p.qual ?? "").trim())) problems.push(`policy for ${p.cmd} allows everything`);
        if (!/current_tenant\(\)/.test(text)) problems.push(`policy for ${p.cmd} does not name the tenant`);
        if (p.cmd !== "SELECT" && p.cmd !== "DELETE" && !/current_tenant\(\)/.test(p.with_check ?? p.qual ?? "")) problems.push(`policy for ${p.cmd} has no tenant check on written rows`);
      }
      const rows = Number((await owner.query(`SELECT count(*)::int AS n FROM ${name}`)).rows[0].n);
      const appCanRead = (await owner.query<{ ok: boolean }>(`SELECT has_table_privilege('biztrack_app', $1::regclass, 'SELECT') AS ok`, [`public.${name}`])).rows[0]!.ok;
      if (!appCanRead) {
        out.push({ table: t.relname, rows, appCanRead, rlsEnabled: t.enabled, rlsForced: t.forced, policies: mine.length, policyProblems: [], visibleWithoutTenant: 0, otherTenantRead: 0, otherTenantUpdated: 0, otherTenantDeleted: 0, crossTenantInsert: "none to try" });
        continue;
      }

      await app.query("BEGIN");
      const visibleWithoutTenant = Number((await app.query(`SELECT count(*)::int AS n FROM ${name}`)).rows[0].n);
      await app.query("ROLLBACK");

      let otherRead = 0, otherUpdated = 0, otherDeleted = 0;
      let insert: TableAudit["crossTenantInsert"] = "none to try";
      for (const me of tenants.slice(0, 3)) {
        await app.query("BEGIN");
        await app.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [me]);
        const col = t.relname === "Tenant" ? "id" : "tenantId";
        otherRead += Number((await app.query(`SELECT count(*)::int AS n FROM ${name} WHERE ${q(col)} <> $1`, [me])).rows[0].n);
        for (const [kind, sql] of [["update", `UPDATE ${name} SET ${q(col)} = ${q(col)} WHERE ${q(col)} <> $1`], ["delete", `DELETE FROM ${name} WHERE ${q(col)} <> $1`]] as const) {
          await app.query("SAVEPOINT s");
          try {
            const r = await app.query(sql, [me]);
            if (kind === "update") otherUpdated += r.rowCount ?? 0; else otherDeleted += r.rowCount ?? 0;
          } catch (e) {
            // No grant (append-only tables) is a stronger answer than zero rows.
            if (!DENIED.test(String((e as Error).message))) throw e;
            await app.query("ROLLBACK TO s");
          }
        }
        await app.query("ROLLBACK");

        // Copy another tenant's row, as this tenant: must be refused.
        if (t.relname !== "Tenant" && insert !== "ALLOWED") {
          const foreign = (await owner.query<{ j: object }>(`SELECT to_jsonb(x) AS j FROM ${name} x WHERE x."tenantId" <> $1 LIMIT 1`, [me])).rows[0];
          if (foreign) {
            await app.query("BEGIN");
            await app.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [me]);
            try {
              await app.query(`INSERT INTO ${name} SELECT * FROM jsonb_populate_record(NULL::${name}, $1::jsonb)`, [JSON.stringify(foreign.j)]);
              insert = "ALLOWED";
            } catch (e) {
              if (!DENIED.test(String((e as Error).message))) throw e;
              insert = "blocked";
            }
            await app.query("ROLLBACK");
          }
        }
      }
      out.push({
        table: t.relname, rows, appCanRead, rlsEnabled: t.enabled, rlsForced: t.forced, policies: mine.length, policyProblems: problems,
        visibleWithoutTenant, otherTenantRead: otherRead, otherTenantUpdated: otherUpdated, otherTenantDeleted: otherDeleted, crossTenantInsert: insert,
      });
    }

    const platform = (
      await owner.query<{ relname: string }>(`
        SELECT cl.relname FROM pg_class cl JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
        WHERE cl.relkind = 'r' AND NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = cl.oid AND a.attname = 'tenantId' AND NOT a.attisdropped)
          AND has_table_privilege('biztrack_app', cl.oid, 'SELECT') ORDER BY cl.relname`)
    ).rows.map((r) => r.relname);
    const role = (await owner.query<{ rolbypassrls: boolean; rolsuper: boolean }>(`SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'biztrack_app'`)).rows[0]!;
    return { tables: out, readablePlatformTables: platform, appRole: { bypassRls: role.rolbypassrls, superuser: role.rolsuper } };
  } finally {
    await owner.end();
    await app.end();
  }
}

/** Plain sentences for everything that is wrong. Empty means every table is isolated. */
export function failures(r: RlsReport, opts: { platformTablesAllowed?: string[] } = {}): string[] {
  const allowed = new Set(opts.platformTablesAllowed ?? ["Plan"]);
  const f: string[] = [];
  if (r.appRole.bypassRls || r.appRole.superuser) f.push("the app role can bypass row-level security");
  for (const t of r.tables) {
    if (!t.appCanRead) continue;
    if (!t.rlsEnabled) f.push(`${t.table}: row-level security is off`);
    if (!t.rlsForced) f.push(`${t.table}: row-level security is not forced`);
    for (const p of t.policyProblems) f.push(`${t.table}: ${p}`);
    if (t.visibleWithoutTenant) f.push(`${t.table}: ${t.visibleWithoutTenant} rows are visible with no tenant set`);
    if (t.otherTenantRead) f.push(`${t.table}: another tenant's rows can be read`);
    if (t.otherTenantUpdated) f.push(`${t.table}: another tenant's rows can be changed`);
    if (t.otherTenantDeleted) f.push(`${t.table}: another tenant's rows can be deleted`);
    if (t.crossTenantInsert === "ALLOWED") f.push(`${t.table}: a row for another tenant can be inserted`);
  }
  for (const p of r.readablePlatformTables) if (!allowed.has(p)) f.push(`${p}: a platform table is readable by the app role`);
  return f;
}
