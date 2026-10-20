-- Stores that have online-payment orders (UddoktaPay, SSLCommerz, bKash) still unpaid after a while, for the expiry sweep. Returns store ids only.
-- Without this, a shopper who closes the payment page leaves a PENDING order that holds stock for ever.
CREATE OR REPLACE FUNCTION tenants_with_stale_gateway_orders(older_than_minutes integer DEFAULT 60)
RETURNS TABLE ("tenantId" text) AS $$
  SELECT DISTINCT o."tenantId" FROM "Order" o
  WHERE o."deletedAt" IS NULL AND o.status = 'PENDING' AND o."paymentStatus" = 'UNPAID' AND o."paymentMethod"::text LIKE 'GATEWAY%'
    AND o."createdAt" < timezone('utc', now()) - make_interval(mins => older_than_minutes);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION tenants_with_stale_gateway_orders(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenants_with_stale_gateway_orders(integer) TO biztrack_app, biztrack_platform;
