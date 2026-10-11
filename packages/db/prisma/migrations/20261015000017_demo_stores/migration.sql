-- Template demo stores (docs/38). A flag, so platform numbers and the billing sweep can leave them out.
ALTER TABLE "Tenant" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
