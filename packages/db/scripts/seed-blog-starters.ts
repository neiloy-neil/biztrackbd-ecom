/**
 * Puts the two starter guides into PlatformBlogPost so staff can edit them in Platform Admin. Safe to run again: a post whose link
 * name already exists is left alone, so edits made in the admin are never overwritten.
 *
 *   pnpm --filter @biztrackbd/db exec tsx scripts/seed-blog-starters.ts
 *   ... --refresh   also rewrites a starter post that nobody has edited yet (still never touches one edited in the admin)
 */
import { config } from "dotenv";
import pg from "pg";
import { STARTER_BLOG_POSTS } from "../../core/src/platform/blog-starters";

config({ path: "../../.env.local" });
config({ path: "../../.env" });

const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is not set");

const refresh = process.argv.includes("--refresh");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  for (const p of STARTER_BLOG_POSTS) {
    const res = await client.query(
      `INSERT INTO "PlatformBlogPost" ("id","slug","title","description","body","ctaLabel","ctaHref","status","publishedAt","createdBy","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PUBLISHED',now(),'system',now())
       ON CONFLICT ("slug") DO ${
         refresh
           ? `UPDATE SET "title"=EXCLUDED."title","description"=EXCLUDED."description","body"=EXCLUDED."body","ctaLabel"=EXCLUDED."ctaLabel","ctaHref"=EXCLUDED."ctaHref","updatedAt"=now()
              WHERE "PlatformBlogPost"."createdBy"='system' AND "PlatformBlogPost"."updatedBy" IS NULL`
           : "NOTHING"
       }`,
      [`starter_${p.slug}`, p.slug, p.title, p.description, p.body, p.ctaLabel, p.ctaHref],
    );
    console.log(`${p.slug}: ${res.rowCount ? (refresh ? "added or refreshed" : "added") : "left unchanged (edited in the admin, or already there)"}`);
  }
} finally {
  await client.end();
}
