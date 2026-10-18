import { redirect } from "next/navigation";

const PROVIDER_TO_APP: Record<string, string> = {
  STEADFAST: "steadfast_courier",
  PATHAO: "pathao_courier",
  REDX: "redx_courier",
  META_CAPI: "meta_pixel_capi",
  GA4: "google_analytics",
  SMS_BYO: "sms_alerts",
  SSLCOMMERZ: "sslcommerz_pay",
  BKASH_DIRECT: "bkash_direct_pay",
  UDDOKTAPAY: "uddoktapay_pay",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; open?: string }>;
}) {
  const sp = await searchParams;
  const targetApp = sp.open ? (PROVIDER_TO_APP[sp.open] ?? sp.open) : undefined;
  redirect(targetApp ? `/settings/apps?open=${targetApp}` : "/settings/apps");
}
