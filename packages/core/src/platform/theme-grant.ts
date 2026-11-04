import { type PrismaClient } from "@biztrackbd/db";
import { ValidationError, NotFoundError } from "../errors";
import { catalogTheme, mergeCatalogue, purchaseExpiry } from "./theme-catalogue";
import { groupTrxId, newPaymentGroup, normalizeDiscountCode, priceThemePurchase, purchaseShares } from "./theme-pricing";

/**
 * An online (UddoktaPay) payment for a theme or a bundle that the gateway reports completed. Kept apart from payments/uddoktapay.ts so that file
 * only has to call it. The price is worked out again here from what the charge says was bought (theme or bundle, and the code): the gateway's
 * amount is only ever compared with it, never trusted as the price. A code that has expired or run out since checkout began still counts,
 * because the store paid the price it was shown.
 */
export async function grantThemePurchaseFromPayment(db: PrismaClient, p: {
  tenantId: string; themeId: string; bundleId: string; code: string; paid: number; trxId: string; invoiceId: string;
  mfsProvider: "BKASH" | "NAGAD" | "ROCKET" | "UPAY"; senderNumber: string; method: string | null;
}): Promise<void> {
  const catalogue = mergeCatalogue(await db.theme.findMany());
  if (!p.bundleId) {
    const theme = catalogTheme(catalogue, p.themeId);
    if (!theme || !theme.premium) throw new ValidationError("That is not a premium theme");
  }
  // The return page, the webhook and a replay all report the same payment: once it is recorded, later reports change nothing.
  if (await db.themePurchase.findUnique({ where: { trxId: p.trxId }, select: { id: true } })) return;
  const tenant = await db.tenant.findUnique({ where: { id: p.tenantId }, select: { id: true } });
  if (!tenant) throw new NotFoundError("Tenant");
  const [bundles, codeRow, mine] = await Promise.all([
    db.themeBundle.findMany(),
    p.code ? db.themeDiscount.findUnique({ where: { code: normalizeDiscountCode(p.code) } }) : Promise.resolve(null),
    db.themePurchase.findMany({ where: { tenantId: p.tenantId, status: "APPROVED" }, select: { themeId: true, expiresAt: true } }),
  ]);
  const ownedForever = new Set(mine.filter((r) => r.expiresAt === null).map((r) => r.themeId));
  const quote = priceThemePurchase({ catalogue, bundles, input: { themeId: p.themeId, bundleId: p.bundleId }, code: codeRow, ownedForever, usable: new Set(), ignoreCodeLimits: true });
  if (!(p.paid >= quote.total)) throw new ValidationError(quote.kind === "BUNDLE" ? "The amount paid is less than the bundle price" : "The amount paid is less than the theme price");
  const shares = purchaseShares(quote);
  if (shares.length === 0) throw new ValidationError("There is nothing to unlock for this payment");
  try {
    await db.$transaction(async (tx) => {
      if (await tx.themePurchase.findUnique({ where: { trxId: p.trxId } })) return;
      const now = new Date();
      const groupId = newPaymentGroup();
      for (const [i, row] of shares.entries()) {
        const current = await tx.themePurchase.findFirst({ where: { tenantId: p.tenantId, themeId: row.themeId, status: "APPROVED", expiresAt: { not: null } }, orderBy: { expiresAt: "desc" }, select: { expiresAt: true } });
        await tx.themePurchase.create({
          data: {
            tenantId: p.tenantId, themeId: row.themeId, amount: row.amount, mfsProvider: p.mfsProvider, senderNumber: p.senderNumber, trxId: groupTrxId(p.trxId, i),
            status: "APPROVED", approvedAt: now, expiresAt: purchaseExpiry(quote.priceModel, now, current?.expiresAt ?? null),
            groupId, bundleId: quote.bundleId, leadRow: i === 0, discountCode: quote.code, discountAmount: row.discountAmount,
          },
        });
      }
      // The use is counted even when the code has run out since checkout started: the store paid the price it was shown.
      if (quote.codeId) await tx.themeDiscount.update({ where: { id: quote.codeId }, data: { usedCount: { increment: 1 } } });
      await tx.platformAuditLog.create({ data: { actorId: "SYSTEM", action: "theme.purchase_online", tenantId: p.tenantId, details: { themeId: p.themeId || null, bundleId: quote.bundleId, themes: shares.map((s) => s.themeId), invoiceId: p.invoiceId, trxId: p.trxId, amount: quote.total, paid: p.paid, code: quote.code, discount: quote.discount, method: p.method } } });
    });
  } catch (err) {
    if ((err as { code?: string }).code !== "P2002") throw err;
  }
}
