/** Where a visitor goes to try the admin (docs/41). One template opens its admin straight away; none shows the chooser. */
export function demoAdminUrl(template?: string): string {
  const admin = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001").replace(/\/$/, "");
  return template ? `${admin}/demo/start?template=${encodeURIComponent(template)}` : `${admin}/demo`;
}
