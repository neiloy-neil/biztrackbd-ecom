import { permanentRedirect, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyCustomPageRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") search.set(k, v);
    else if (Array.isArray(v)) for (const item of v) search.append(k, item);
  }
  const query = search.toString();
  const target = `/${slug}${query ? `?${query}` : ""}`;
  if (sp.preview) {
    redirect(target);
  } else {
    permanentRedirect(target);
  }
}
