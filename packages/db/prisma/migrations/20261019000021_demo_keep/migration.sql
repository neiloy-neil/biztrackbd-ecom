-- "Keep this store" (docs/41): a random code on each visitor demo that lets the signup carry the demo's products and design into a real store.
ALTER TABLE "Tenant" ADD COLUMN "demoKeepToken" TEXT;
