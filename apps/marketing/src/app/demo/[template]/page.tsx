import { redirect, notFound } from "next/navigation";
import { demoTemplate } from "@biztrackbd/core";

export default async function DemoRedirectPage({ params }: { params: Promise<{ template: string }> }) {
  const { template } = await params;
  const demo = demoTemplate(template);
  if (!demo) notFound();

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const url = root.includes("localhost")
    ? `http://${demo.host}.localhost:3000`
    : `https://${demo.host}.${root}`;

  redirect(url);
}
