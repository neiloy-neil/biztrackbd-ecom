-- Search boxes use Prisma `contains` with mode "insensitive", which is `ILIKE '%text%'`. A plain b-tree cannot serve that, so each search
-- scanned the whole table. Trigram GIN indexes can. Raw SQL only: Prisma's schema language cannot express operator classes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_title_trgm_idx"         ON "Product"        USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_titleBn_trgm_idx"       ON "Product"        USING gin ("titleBn" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ProductVariant_sku_trgm_idx"    ON "ProductVariant" USING gin ("sku" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ProductVariant_title_trgm_idx"  ON "ProductVariant" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Order_orderNumber_trgm_idx"     ON "Order"          USING gin ("orderNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Order_customerName_trgm_idx"    ON "Order"          USING gin ("customerName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Customer_name_trgm_idx"         ON "Customer"       USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Customer_email_trgm_idx"        ON "Customer"       USING gin ("email" gin_trgm_ops);
