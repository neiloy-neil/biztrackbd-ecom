import { NextResponse } from "next/server";
import { getBasePrisma, withTenant } from "@biztrackbd/db";
import { verifyOrderDownloadToken } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const payload = verifyOrderDownloadToken(token);

  if (!payload) {
    return new NextResponse(
      `<!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="utf-8">
        <title>ইনভ্যালিড ডাউনলোড লিংক</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
          .card { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 440px; text-align: center; }
          h2 { color: #dc2626; margin-top: 0; }
          p { color: #64748b; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>⚠️ ডাউনলোড লিংকটি মেয়াদোত্তীর্ণ বা সঠিক নয়</h2>
          <p>আপনার ডাউনলোড লিংকটির মেয়াদ শেষ হয়ে থাকতে পারে অথবা ভুল লিংক ব্যবহার করা হয়েছে। অনুগ্রহ করে আপনার অর্ডার পেজ চেক করুন অথবা সহায়তার জন্য আমাদের সাথে যোগাযোগ করুন।</p>
        </div>
      </body>
      </html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const { tenantId, orderId, itemId } = payload;

  const orderData = await withTenant(tenantId, async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        paymentStatus: true,
        status: true,
        customerName: true,
      },
    });

    if (!order) return null;

    const item = await tx.orderItem.findUnique({
      where: { id: itemId },
      select: {
        productTitle: true,
        digitalDeliveryUrl: true,
        digitalDeliveredAt: true,
      },
    });

    return { order, item };
  });

  if (!orderData || !orderData.item) {
    return new NextResponse("Order or digital asset not found", { status: 404 });
  }

  const { order, item } = orderData;

  // If order is not yet paid:
  if (order.paymentStatus !== "PAID") {
    return new NextResponse(
      `<!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="utf-8">
        <title>পেমেন্ট যাচাইকরণ বাকি</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
          .card { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 440px; text-align: center; }
          h2 { color: #d97706; margin-top: 0; }
          p { color: #64748b; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>⏳ পেমেন্ট যাচাই প্রক্রিয়াধীন</h2>
          <p>অর্ডার #${order.orderNumber} এর পেমেন্ট এখনও যাচাই করা হচ্ছে। পেমেন্ট নিশ্চিত হওয়া মাত্রই আপনার ফাইলটি ডাউনলোড করতে পারবেন।</p>
        </div>
      </body>
      </html>`,
      { status: 402, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // If asset URL not ready yet (on-demand):
  if (!item.digitalDeliveryUrl) {
    return new NextResponse(
      `<!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="utf-8">
        <title>ফাইল প্রস্তুত হচ্ছে</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
          .card { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 440px; text-align: center; }
          h2 { color: #0284c7; margin-top: 0; }
          p { color: #64748b; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>📄 ফাইল প্রস্তুত হচ্ছে</h2>
          <p>আপনার অর্ডারকৃত <strong>${item.productTitle}</strong> ফাইলটি প্রস্তুত করা হচ্ছে। সম্পূর্ণ হওয়া মাত্রই আপনার মোবাইলে SMS পাঠিয়ে দেওয়া হবে।</p>
        </div>
      </body>
      </html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Redirect customer directly to the verified digital file URL
  return NextResponse.redirect(item.digitalDeliveryUrl, 307);
}
