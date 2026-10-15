export const dynamic = "force-static";

export async function GET() {
  return new Response("google-site-verification: google0668054f248577b1.html", {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
