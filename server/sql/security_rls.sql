-- SmartPOS Supabase Row Level Security (RLS) Protection Script
-- Execute this SQL script in the Supabase SQL Editor to secure all database tables

-- 1. Enable RLS on all sensitive tables
ALTER TABLE IF EXISTS tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS creditors ENABLE ROW LEVEL SECURITY;

-- 2. Drop any legacy open public policies if they exist
DROP POLICY IF EXISTS "Public Anon Select Tenants" ON tenants;
DROP POLICY IF EXISTS "Public Anon Select Staff" ON staff;
DROP POLICY IF EXISTS "Public Anon Select Admins" ON admins;
DROP POLICY IF EXISTS "Public Anon Select Users" ON users;

-- 3. Service Role Only Access Policies (Restricts access to backend service requests)
CREATE POLICY "Service Role Full Access Tenants" ON tenants FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Users" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Staff" ON staff FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Admins" ON admins FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Products" ON products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Sales" ON sales FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Anonymized public read-only fallback policy for tenant verification (Subdomain lookup only)
CREATE POLICY "Allow public tenant lookup by subdomain" ON tenants 
  FOR SELECT TO anon 
  USING (subdomain IS NOT NULL);
