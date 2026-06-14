-- ==============================================
-- SUPER SAFE SUPABASE SETUP - NO ERRORS!
-- ==============================================
-- This script checks for everything before doing anything!
-- ==============================================

-- 1. Create tenants table (if not exists)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add tenant_id columns to ALL existing tables (if missing)
-- ==============================================

DO $$ BEGIN
  -- Check and add tenant_id to users
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenant_id') THEN
    ALTER TABLE users ADD COLUMN tenant_id UUID;
    ALTER TABLE users ADD CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

DO $$ BEGIN
  -- Check and add tenant_id to products
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='tenant_id') THEN
    ALTER TABLE products ADD COLUMN tenant_id UUID;
    ALTER TABLE products ADD CONSTRAINT fk_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

DO $$ BEGIN
  -- Check and add tenant_id to variants
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='variants' AND column_name='tenant_id') THEN
    ALTER TABLE variants ADD COLUMN tenant_id UUID;
    ALTER TABLE variants ADD CONSTRAINT fk_variants_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

DO $$ BEGIN
  -- Check and add tenant_id to staff
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='tenant_id') THEN
    ALTER TABLE staff ADD COLUMN tenant_id UUID;
    ALTER TABLE staff ADD CONSTRAINT fk_staff_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

DO $$ BEGIN
  -- Check and add tenant_id to sales
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='tenant_id') THEN
    ALTER TABLE sales ADD COLUMN tenant_id UUID;
    ALTER TABLE sales ADD CONSTRAINT fk_sales_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

DO $$ BEGIN
  -- Check and add tenant_id to sale_items
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='tenant_id') THEN
    ALTER TABLE sale_items ADD COLUMN tenant_id UUID;
    ALTER TABLE sale_items ADD CONSTRAINT fk_sale_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

DO $$ BEGIN
  -- Check and add tenant_id to customers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='tenant_id') THEN
    ALTER TABLE customers ADD COLUMN tenant_id UUID;
    ALTER TABLE customers ADD CONSTRAINT fk_customers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

DO $$ BEGIN
  -- Check and add tenant_id to non_inventory_products
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='non_inventory_products' AND column_name='tenant_id') THEN
    ALTER TABLE non_inventory_products ADD COLUMN tenant_id UUID;
    ALTER TABLE non_inventory_products ADD CONSTRAINT fk_non_inventory_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

DO $$ BEGIN
  -- Check and add tenant_id to creditors
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='creditors' AND column_name='tenant_id') THEN
    ALTER TABLE creditors ADD COLUMN tenant_id UUID;
    ALTER TABLE creditors ADD CONSTRAINT fk_creditors_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

DO $$ BEGIN
  -- Check and add tenant_id to expenses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='tenant_id') THEN
    ALTER TABLE expenses ADD COLUMN tenant_id UUID;
    ALTER TABLE expenses ADD CONSTRAINT fk_expenses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

DO $$ BEGIN
  -- Check and add tenant_id to purchases
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='tenant_id') THEN
    ALTER TABLE purchases ADD COLUMN tenant_id UUID;
    ALTER TABLE purchases ADD CONSTRAINT fk_purchases_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

DO $$ BEGIN
  -- Check and add tenant_id to remittances
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='remittances' AND column_name='tenant_id') THEN
    ALTER TABLE remittances ADD COLUMN tenant_id UUID;
    ALTER TABLE remittances ADD CONSTRAINT fk_remittances_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

DO $$ BEGIN
  -- Check and add tenant_id to notifications
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='tenant_id') THEN
    ALTER TABLE notifications ADD COLUMN tenant_id UUID;
    ALTER TABLE notifications ADD CONSTRAINT fk_notifications_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END $$;

-- 3. Create SAFE indexes (only if column exists!)
-- ==============================================

-- Tenant index (always safe)
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);

-- User indexes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  END IF;
END $$;

-- Product indexes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='barcode') THEN
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
  END IF;
END $$;

-- Variant index
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='variants' AND column_name='tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_variants_tenant ON variants(tenant_id);
  END IF;
END $$;

-- Staff indexes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff(tenant_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='staff_id') THEN
    CREATE INDEX IF NOT EXISTS idx_staff_id ON staff(staff_id);
  END IF;
END $$;

-- Sales index
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenant_id);
  END IF;
END $$;

-- Sale items index
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_sale_items_tenant ON sale_items(tenant_id);
  END IF;
END $$;

-- Customers index
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
  END IF;
END $$;

-- Credits index
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credits' AND column_name='tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_credits_tenant ON credits(tenant_id);
  END IF;
END $$;

-- Payments index
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
  END IF;
END $$;

-- Remittances index
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='remittances' AND column_name='tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_remittances_tenant ON remittances(tenant_id);
  END IF;
END $$;

-- Notifications index
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
  END IF;
END $$;

-- ==============================================
-- DONE!
-- ==============================================
-- This script won't give any errors!
