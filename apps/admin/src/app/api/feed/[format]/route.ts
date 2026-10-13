import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ format: string }> }
) {
  const { format } = await params;
  if (!["facebook.xml", "google.xml", "catalog.xml"].includes(format)) {
    return new NextResponse("Supported feeds: facebook.xml, google.xml, catalog.xml", { status: 404 });
  }

  const url = new URL(req.url);
  const target = new URL("/api/catalog/facebook", url.origin);
  url.searchParams.forEach((val, key) => target.searchParams.set(key, val));

  return NextResponse.rewrite(target);
}
