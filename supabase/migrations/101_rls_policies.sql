-- ============================================================================
-- SMARTPOS+ v4.0 — SUPABASE RLS POLICIES (101_rls_policies.sql)
-- Custom Service-Role Backend + Defense-in-Depth RLS
-- Execution Order: 2 of 5 (Run AFTER 100_smartpos_canonical_schema.sql)
-- ============================================================================
-- ARCHITECTURE NOTE:
-- SmartPOS+ Node backend uses custom session tokens + service_role key
-- (SUPABASE_SERVICE_ROLE_KEY). PostgreSQL service_role automatically bypasses
-- RLS. These policies enforce tenant-isolation for any client-side or anon API
-- access while granting service_role full operational access.
-- ============================================================================

BEGIN;

-- 1. Enable RLS on all 28 canonical tables
DO $$
DECLARE
  t TEXT;
  all_tables TEXT[] := ARRAY[
    'users','staff','products','variants','non_inventory_products',
    'sales','sale_items','attendance','login_history','expenses',
    'purchases','creditors','customers','credits','payments',
    'reminders','remittances','notifications','activity_logs',
    'security_events','error_logs','audit_logs','settings','sessions',
    'tenants','feature_flags','system_settings','developer_sessions'
  ];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- 2. Add Tenant Isolation Policies for Tenant-Scoped Tables
DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'users','staff','products','variants','non_inventory_products',
    'sales','sale_items','attendance','login_history','expenses',
    'purchases','creditors','customers','credits','payments',
    'reminders','remittances','notifications','activity_logs',
    'security_events','error_logs','audit_logs','settings','sessions'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_isolation ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_isolation ON public.%I
         FOR ALL
         USING (
           auth.role() = ''service_role'' 
           OR tenant_id::text = (auth.jwt() ->> ''tenant_id'')
         )
         WITH CHECK (
           auth.role() = ''service_role'' 
           OR tenant_id::text = (auth.jwt() ->> ''tenant_id'')
         );',
      t, t
    );
  END LOOP;
END $$;

-- 3. Global Tables RLS Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS tenants_self_service ON public.tenants;
  CREATE POLICY tenants_self_service ON public.tenants
    FOR ALL
    USING (
      auth.role() = 'service_role'
      OR id::text = (auth.jwt() ->> 'tenant_id')
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS dev_sessions_service ON public.developer_sessions;
  CREATE POLICY dev_sessions_service ON public.developer_sessions
    FOR ALL
    USING (auth.role() = 'service_role');
END $$;

COMMIT;
