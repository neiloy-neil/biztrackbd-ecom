import { CachedDirectory, chainDirectories, dbDirectory, edgeConfigDirectory, type HostDirectory } from "@biztrackbd/core";

/**
 * One directory per server process. Lookups go to Edge Config first when it is configured (EDGE_CONFIG is set by Vercel),
 * then to Postgres, and the answer is cached briefly. Postgres alone is fully correct; Edge Config only makes it faster.
 */
let directory: CachedDirectory | undefined;

export function getDirectory(): CachedDirectory {
  if (directory) return directory;
  const root =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ??
    (process.env.NODE_ENV === "production" ? "biztrack.bd" : "localhost:3000");
  const sources: HostDirectory[] = [];

  if (process.env.EDGE_CONFIG) {
    sources.push(
      edgeConfigDirectory(async (key) => {
        const { get } = await import("@vercel/edge-config");
        return get(key);
      }),
    );
  }
  sources.push(dbDirectory(root));

  directory = new CachedDirectory(chainDirectories(...sources));
  return directory;
}
