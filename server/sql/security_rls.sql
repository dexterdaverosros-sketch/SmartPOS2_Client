-- ============================================================
-- SmartPOS Supabase Row Level Security (RLS) Protection Script
-- Aligned with supabase-migration.sql schema
-- ============================================================

-- 1. Enable RLS on all existing tables from supabase-migration.sql
ALTER TABLE IF EXISTS tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS non_inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS creditors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;

-- 2. Drop any legacy policies if re-running
DROP POLICY IF EXISTS "Service Role Full Access Tenants" ON tenants;
DROP POLICY IF EXISTS "Service Role Full Access Users" ON users;
DROP POLICY IF EXISTS "Service Role Full Access Staff" ON staff;
DROP POLICY IF EXISTS "Service Role Full Access Products" ON products;
DROP POLICY IF EXISTS "Service Role Full Access Sales" ON sales;
DROP POLICY IF EXISTS "Allow public tenant lookup by subdomain" ON tenants;

-- 3. Service Role Access Policies (Allows backend API with service key full access)
CREATE POLICY "Service Role Full Access Tenants" ON tenants FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Users" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Staff" ON staff FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Products" ON products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Sales" ON sales FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Anonymized public read-only lookup for store subdomains only
CREATE POLICY "Allow public tenant lookup by subdomain" ON tenants 
  FOR SELECT TO anon 
  USING (subdomain IS NOT NULL);
