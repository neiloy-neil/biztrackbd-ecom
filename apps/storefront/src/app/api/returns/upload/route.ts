import { NextResponse } from "next/server";
import { verifyOrderAccess } from "@biztrackbd/core";
import { MediaError, MAX_UPLOAD_BYTES, saveImage } from "@biztrackbd/media";
import { getCustomerSession } from "@/lib/session";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const store = await getStore();
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const orderId = form.get("orderId");
  const token = form.get("token");
  const file = form.get("file");

  if (typeof orderId !== "string" || !orderId) {
    return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
  }

  const session = await getCustomerSession(store.id);
  const hasAccess = verifyOrderAccess(store.id, orderId, typeof token === "string" ? token : null) || (session != null);
  if (!hasAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please select an image file" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Photo must be under 8 MB" }, { status: 413 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const saved = await saveImage(store.id, bytes);
    return NextResponse.json({ url: saved.url });
  } catch (e) {
    if (e instanceof MediaError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[returns/upload] error:", e);
    return NextResponse.json({ error: "Could not upload image. Please try again." }, { status: 500 });
  }
}
