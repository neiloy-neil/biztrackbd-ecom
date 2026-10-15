-- Standardizes RLS for recent modules (WhatsApp, Support Desk, Wholesale, and Affiliate Hub):
-- Ensures row level security is both ENABLED and FORCED, and uses standard current_tenant() policy.

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'WhatsAppConfig',
    'WhatsAppTemplate',
    'WhatsAppMessageLog',
    'WhatsAppChatMessage',
    'WhatsAppConversation',
    'SupportQuickReply',
    'WholesaleTier',
    'WholesaleCustomer',
    'WholesalePrice',
    'AffiliatePartner',
    'AffiliateReferral',
    'AffiliatePayout'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS affiliate_partner_tenant_isolation ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS affiliate_referral_tenant_isolation ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS affiliate_payout_tenant_isolation ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS whatsapp_config_tenant_isolation ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS whatsapp_template_tenant_isolation ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS wholesale_tier_tenant_isolation ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I FOR ALL TO biztrack_app USING ("tenantId" = current_tenant()) WITH CHECK ("tenantId" = current_tenant())', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO biztrack_app', tbl);
  END LOOP;
END $$;
