import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/tools/courier-fraud-checker", request.url), 301);
}
