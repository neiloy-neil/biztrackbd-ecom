import { redirect, notFound } from "next/navigation";
import { demoTemplate, findBusinessDemoTemplate } from "@biztrackbd/core";

export default async function DemoRedirectPage({ params }: { params: Promise<{ template: string }> }) {
  const { template } = await params;
  const ecomDemo = demoTemplate(template);
  const bizDemo = findBusinessDemoTemplate(template);

  const host = ecomDemo?.host || bizDemo?.host;
  if (!host) notFound();

  const root =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ??
    (process.env.NODE_ENV === "production" ? "biztrack.bd" : "localhost:3000");
  const url = root.includes("localhost")
    ? `http://${host}.localhost:3000`
    : `https://${host}.${root}`;

  redirect(url);
}
