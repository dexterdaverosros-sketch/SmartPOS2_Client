-- ============================================================================
-- SMARTPOS+ v4.0 — BULK INVENTORY TABLES + RLS (105_bulk_inventory.sql)
-- Adds bulk_inventory_transactions + bulk_inventory_items tables,
-- their FKs, indexes, and tenant-isolation RLS policies.
-- Execution Order: 3 of 5 (Run AFTER 101_rls_policies.sql)
-- ============================================================================

BEGIN;

-- 1. Bulk Inventory Transactions (one per delivery session)
CREATE TABLE IF NOT EXISTS public.bulk_inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reference_number TEXT NOT NULL,
  created_by UUID NOT NULL,
  supplier_company TEXT,
  total_items INTEGER NOT NULL DEFAULT 0,
  total_units INTEGER NOT NULL DEFAULT 0,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  idempotency_key UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Bulk Inventory Items (N lines per session)
CREATE TABLE IF NOT EXISTS public.bulk_inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bulk_inventory_id UUID NOT NULL REFERENCES public.bulk_inventory_transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.variants(id) ON DELETE SET NULL,
  barcode TEXT,
  product_name_snapshot TEXT NOT NULL,
  description_snapshot TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  cost_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost_snapshot >= 0),
  selling_price_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (selling_price_snapshot >= 0),
  supplier_company_override TEXT,
  notes TEXT,
  price_cost_update_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (price_cost_update_confirmed IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes (tenant isolation + access paths)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bulk_inventory_tx_ref_unique
  ON public.bulk_inventory_transactions(tenant_id, reference_number);
CREATE INDEX IF NOT EXISTS idx_bulk_inventory_tx_tenant_created
  ON public.bulk_inventory_transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_inventory_tx_idempotency
  ON public.bulk_inventory_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_bulk_inventory_items_parent
  ON public.bulk_inventory_items(bulk_inventory_id);
CREATE INDEX IF NOT EXISTS idx_bulk_inventory_items_tenant
  ON public.bulk_inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bulk_inventory_items_product
  ON public.bulk_inventory_items(product_id);
CREATE INDEX IF NOT EXISTS idx_bulk_inventory_items_barcode
  ON public.bulk_inventory_items(barcode);

-- 4. RLS Enable
ALTER TABLE public.bulk_inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_inventory_items ENABLE ROW LEVEL SECURITY;

-- 5. Tenant isolation policies (same pattern as products/staff in 101_rls_policies.sql)
DROP POLICY IF EXISTS bulk_inventory_transactions_tenant_isolation ON public.bulk_inventory_transactions;
CREATE POLICY bulk_inventory_transactions_tenant_isolation ON public.bulk_inventory_transactions
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR tenant_id::text = (auth.jwt() ->> 'tenant_id')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR tenant_id::text = (auth.jwt() ->> 'tenant_id')
  );

DROP POLICY IF EXISTS bulk_inventory_items_tenant_isolation ON public.bulk_inventory_items;
CREATE POLICY bulk_inventory_items_tenant_isolation ON public.bulk_inventory_items
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR tenant_id::text = (auth.jwt() ->> 'tenant_id')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR tenant_id::text = (auth.jwt() ->> 'tenant_id')
  );

-- 6. Trigger: auto-update updated_at on bulk_inventory_transactions
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

DROP TRIGGER IF EXISTS set_timestamp_bulk_inventory_transactions ON public.bulk_inventory_transactions;
CREATE TRIGGER set_timestamp_bulk_inventory_transactions
BEFORE UPDATE ON public.bulk_inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

COMMIT;
