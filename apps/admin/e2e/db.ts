import pg from "pg";

/** Direct database access for test setup and assertions (owner role). Never used by the app. */
export async function withDb<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error("DIRECT_URL is not set (see /.env.example)");
  if (/prod/i.test(url)) throw new Error("Refusing to run end-to-end tests against a database whose URL contains 'prod'");
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

export const DEMO = "rongdhonu";
export const tenantId = () => withDb(async (c) => (await c.query(`SELECT id FROM "Tenant" WHERE subdomain = $1`, [DEMO])).rows[0].id as string);
