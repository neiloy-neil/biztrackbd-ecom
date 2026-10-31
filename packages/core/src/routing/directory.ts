import { resolveHostEntry } from "@biztrackbd/db";
import { z } from "zod";
import type { HostEntry } from "./decide";
import { normalizeHost } from "./host";

/** Looks up the store behind a hostname. Callers pass a normalised host. */
export interface HostDirectory {
  lookup(host: string): Promise<HostEntry | null>;
}

export const HostEntrySchema = z.object({
  tenantId: z.string().min(8),
  subdomain: z.string().min(1),
  themeId: z.string().min(1),
  locale: z.string().min(2),
  status: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"]),
  matched: z.enum(["subdomain", "custom", "custom_www", "previous_subdomain"]),
  primaryDomain: z.string().nullable(),
  redirectWww: z.boolean(),
});

/** Source of truth: Postgres, through the SECURITY DEFINER lookup (works before any tenant is known). */
export function dbDirectory(rootDomain: string): HostDirectory {
  return {
    async lookup(host) {
      const row = await resolveHostEntry(host, rootDomain);
      if (!row) return null;
      const parsed = HostEntrySchema.safeParse(row);
      return parsed.success ? parsed.data : null;
    },
  };
}

/**
 * Optional accelerator: Vercel Edge Config, keyed `domain:<host>` (docs/13). `get` is injected so this file does not
 * depend on the SDK and can be tested. A missing or malformed value is a miss, never an error, so the database answers.
 */
export function edgeConfigDirectory(get: (key: string) => Promise<unknown>): HostDirectory {
  return {
    async lookup(host) {
      const raw = await get(edgeKey(host));
      if (raw == null) return null;
      const parsed = HostEntrySchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    },
  };
}

export const edgeKey = (host: string) => `domain:${host}`;

/** First directory with an answer wins. An error in an earlier one falls through to the next. */
export function chainDirectories(...directories: HostDirectory[]): HostDirectory {
  return {
    async lookup(host) {
      let lastError: unknown;
      for (const d of directories) {
        try {
          const hit = await d.lookup(host);
          if (hit) return hit;
        } catch (e) {
          lastError = e;
        }
      }
      if (lastError) throw lastError;
      return null;
    },
  };
}

export interface CacheOptions {
  /** How long a found store is trusted. Edits made in the admin reach other processes within this time. */
  ttlMs?: number;
  /** How long "not a store" is remembered, so random hostnames cannot hammer the database. */
  negativeTtlMs?: number;
  /** If the source fails, an expired entry is still served for this long rather than taking the site down. */
  staleIfErrorMs?: number;
  maxEntries?: number;
  now?: () => number;
}

interface Slot {
  entry: HostEntry | null;
  expires: number;
  staleUntil: number;
}

/** In-process cache with in-flight de-duplication, so a burst for one host makes one lookup. */
export class CachedDirectory implements HostDirectory {
  private readonly slots = new Map<string, Slot>();
  private readonly inflight = new Map<string, Promise<HostEntry | null>>();
  private readonly ttl: number;
  private readonly negTtl: number;
  private readonly staleIfError: number;
  private readonly max: number;
  private readonly now: () => number;

  constructor(private readonly inner: HostDirectory, opts: CacheOptions = {}) {
    this.ttl = opts.ttlMs ?? 15_000;
    this.negTtl = opts.negativeTtlMs ?? 5_000;
    this.staleIfError = opts.staleIfErrorMs ?? 5 * 60_000;
    this.max = opts.maxEntries ?? 5_000;
    this.now = opts.now ?? Date.now;
  }

  async lookup(rawHost: string): Promise<HostEntry | null> {
    const host = normalizeHost(rawHost);
    if (!host) return null;
    const t = this.now();
    const slot = this.slots.get(host);
    if (slot && slot.expires > t) return slot.entry;

    const pending = this.inflight.get(host);
    if (pending) return pending;

    const p = this.inner
      .lookup(host)
      .then((entry) => {
        this.store(host, { entry, expires: this.now() + (entry ? this.ttl : this.negTtl), staleUntil: this.now() + this.staleIfError });
        return entry;
      })
      .catch((e) => {
        // Serve an expired found-entry rather than failing every request while the source is down.
        if (slot?.entry && slot.staleUntil > this.now()) return slot.entry;
        throw e;
      })
      .finally(() => this.inflight.delete(host));
    this.inflight.set(host, p);
    return p;
  }

  /** Forget a host (or everything) so the next request asks the source. Use after this process changes routing data. */
  invalidate(host?: string): void {
    if (host === undefined) this.slots.clear();
    else this.slots.delete(normalizeHost(host) ?? host);
  }

  get size(): number {
    return this.slots.size;
  }

  private store(host: string, slot: Slot): void {
    if (this.slots.size >= this.max && !this.slots.has(host)) {
      // Drop the oldest insertion. Cheap, and good enough for a cache this small.
      const oldest = this.slots.keys().next().value;
      if (oldest !== undefined) this.slots.delete(oldest);
    }
    this.slots.set(host, slot);
  }
}
