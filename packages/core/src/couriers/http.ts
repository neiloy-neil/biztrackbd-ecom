import { CourierError } from "../errors";

const TIMEOUT_MS = 12_000;

/**
 * One JSON request to a courier. Failures become a CourierError whose message is safe to show:
 * only the courier's own error text (shortened), never the request, headers or keys.
 * A timeout or dropped connection is "ambiguous": the courier may have acted before we lost the reply.
 */
export async function courierJson<T = unknown>(
  fetchFn: typeof fetch,
  provider: string,
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: init.method ?? "GET",
      headers: { Accept: "application/json", ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}), ...init.headers },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new CourierError(`Could not reach ${provider}. Check ${provider}'s portal before trying again.`, provider, true);
  }
  const text = await res.text().catch(() => "");
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const j = (json ?? {}) as Record<string, unknown>;
    const detail = [j.message, j.error, j.errors && typeof j.errors === "object" ? JSON.stringify(j.errors) : undefined].find((x) => typeof x === "string" && x.trim());
    const why = typeof detail === "string" ? detail.slice(0, 200) : `error ${res.status}`;
    if (res.status === 401 || res.status === 403) throw new CourierError(`${provider} did not accept the keys. Check them in Settings, Integrations.`, provider);
    throw new CourierError(`${provider} said: ${why}`, provider, res.status >= 500);
  }
  if (json === null) throw new CourierError(`${provider} sent a reply we could not read.`, provider, true);
  return json as T;
}

export const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
export const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
export const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
